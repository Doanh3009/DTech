import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
const publishNotificationEvent = vi.hoisted(() => vi.fn());
vi.mock("@/features/shared-platforms/services/notificationRepository", () => ({ publishNotificationEvent }));
import { flushPayslipDeliveries } from "./payslipDelivery";

type Row = Record<string, unknown>;
type Call = { table: string; action: string; value?: unknown; filters: Record<string, unknown>; options?: unknown };
const delivery = (channel: "chat" | "notification" = "notification", id = "delivery"): Row => ({ id, payslip_id: "slip", recipient_account_id: "recipient", actor_account_id: "actor", channel });

function database(rows: Row[] = [delivery()], options: { revoked?: boolean; missing?: boolean; noConversation?: boolean; createRace?: boolean; lookupError?: boolean; memberError?: boolean; messageError?: string; duplicateMessageMissing?: boolean; updateError?: boolean; receiptError?: boolean; receiptLost?: boolean; existingNotification?: number; claimError?: boolean; laterRows?: Row[]; accountMissing?: boolean; accountInactive?: boolean; accountRelinked?: boolean; accountReadError?: boolean; accountReadReject?: boolean } = {}) {
  const calls: Call[] = [];
  let lookupCount = 0;
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
  rpc.mockResolvedValueOnce({ data: rows, error: options.claimError ? { message: "private upstream error" } : null });
  if (options.laterRows) rpc.mockResolvedValueOnce({ data: options.laterRows, error: null });
  const client = {
    rpc,
    from(table: string) {
      const call: Call = { table, action: "select", filters: {} }; calls.push(call);
      const result = async () => {
        if (table === "payslips") return { data: options.missing ? null : { id: "slip", employee_id: "employee", status: options.revoked ? "revoked" : "published", version: 1, snapshot: { periodMonth: "2026-09-01" } }, error: null };
        if (table === "app_accounts") {
          if (options.accountReadReject) throw new Error("private fetch details");
          return { data: options.accountMissing ? [] : (call.filters.id as string[]).map(id => ({ id, employee_id: options.accountRelinked ? "different-employee" : "employee", status: options.accountInactive ? "inactive" : "active" })), error: options.accountReadError ? { message: "private account details" } : null };
        }
        if (table === "payslip_deliveries") return { data: options.receiptLost ? null : { id: call.filters.id }, error: options.receiptError ? { message: "private database detail" } : null };
        if (table === "notifications") return { count: options.existingNotification ?? 0, error: null };
        if (table === "conversation_members") return { error: options.memberError ? { message: "private member error" } : null };
        if (table === "messages") return call.action === "select" ? { count: options.duplicateMessageMissing ? 0 : 1, error: null } : { error: options.messageError ? { code: options.messageError, message: "private message error" } : null };
        if (table === "conversations") {
          if (call.action === "insert") return { data: options.createRace ? null : { id: "conversation" }, error: options.createRace ? { code: "23505" } : null };
          if (call.action === "update") return { error: options.updateError ? { message: "private update error" } : null };
          lookupCount += 1;
          return { data: options.noConversation && lookupCount === 1 ? null : { id: "conversation" }, error: options.lookupError ? { message: "private lookup error" } : null };
        }
        throw new Error(`Unexpected table ${table}`);
      };
      const query = {
        select(_selection?: string, settings?: unknown) { call.options = settings; return query; },
        insert(value: unknown) { call.action = "insert"; call.value = value; return query; },
        upsert(value: unknown, settings?: unknown) { call.action = "upsert"; call.value = value; call.options = settings; return query; },
        update(value: unknown) { call.action = "update"; call.value = value; return query; },
        eq(key: string, value: unknown) { call.filters[key] = value; return query; },
        in(key: string, value: unknown) { call.filters[key] = value; return query; },
        maybeSingle: result,
        then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) { return result().then(onFulfilled, onRejected); }
      };
      return query;
    }
  };
  return { client: client as unknown as SupabaseClient, calls, rpc };
}

beforeEach(() => { publishNotificationEvent.mockReset(); publishNotificationEvent.mockResolvedValue({ eventId: "event", created: 1 }); });
const receipts = (calls: Call[]) => calls.filter(call => call.table === "payslip_deliveries");

describe("durable payslip delivery processing", () => {
  it("delivers notification to the exact published slip with a stable idempotency key", async () => {
    const { client, calls, rpc } = database();
    expect(await flushPayslipDeliveries(client, "period", "employee")).toEqual({ delivered: 1, failed: 0, remaining: false });
    expect(rpc).toHaveBeenCalledWith("claim_payslip_deliveries", expect.objectContaining({ p_period_id: "period", p_employee_id: "employee" }));
    expect(publishNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({ aggregateId: "slip", recipients: ["recipient"], idempotencyKey: "payslip-delivery:delivery", deepLink: "/personal/payslips/slip", values: { period_month: "2026-09" } }), client);
    expect(receipts(calls)[0]).toMatchObject({ value: { status: "delivered", last_error: null, claim_token: null }, filters: { id: "delivery", status: "processing" } });
  });
  it("counts an already-created idempotent notification as delivered", async () => {
    publishNotificationEvent.mockResolvedValue({ eventId: "event", created: 0 });
    const { client, calls } = database([delivery()], { existingNotification: 1 });
    expect((await flushPayslipDeliveries(client, "period")).delivered).toBe(1);
    expect(calls.find(call => call.table === "notifications")?.filters).toEqual({ event_id: "event", recipient_account_id: "recipient" });
  });
  it("does not mark a missing or disabled notification template as delivered", async () => {
    publishNotificationEvent.mockResolvedValue({ eventId: "event", created: 0 });
    const { client, calls } = database();
    expect((await flushPayslipDeliveries(client, "period")).failed).toBe(1);
    expect(receipts(calls)[0].value).toMatchObject({ status: "failed", last_error: "Chưa gửi được thông báo", delivered_at: null });
  });
  it("stores a safe failed receipt when notification transport rejects", async () => {
    publishNotificationEvent.mockRejectedValue(new Error("secret/token/SQL detail"));
    const { client, calls } = database();
    expect((await flushPayslipDeliveries(client, "period")).failed).toBe(1);
    expect(JSON.stringify(receipts(calls))).not.toContain("secret");
  });
  it("cancels a revoked or removed slip before sending", async () => {
    for (const options of [{ revoked: true }, { missing: true }]) {
      const { client, calls } = database([delivery()], options);
      expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 0, failed: 0, remaining: false });
      expect(receipts(calls)[0].value).toMatchObject({ status: "cancelled" });
    }
    expect(publishNotificationEvent).not.toHaveBeenCalled();
  });
  it("fails before sending when the claim cannot be acquired", async () => {
    const { client, calls } = database([], { claimError: true });
    await expect(flushPayslipDeliveries(client, "period")).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(calls).toEqual([]);
    expect(publishNotificationEvent).not.toHaveBeenCalled();
  });
  it("keeps lost receipt acknowledgements recoverable through the claim lease", async () => {
    const { client, calls } = database([delivery()], { receiptError: true });
    await expect(flushPayslipDeliveries(client, "period")).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(receipts(calls)[0].filters.claim_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(receipts(calls)[0].filters.status).toBe("processing");
  });
  it("repairs conversation membership and uses the delivery row as message key", async () => {
    const { client, calls } = database([delivery("chat")], { noConversation: true });
    expect((await flushPayslipDeliveries(client, "period")).delivered).toBe(1);
    expect(calls.find(call => call.table === "conversation_members")).toMatchObject({ action: "upsert", options: { onConflict: "conversation_id,account_id", ignoreDuplicates: true } });
    expect(calls.find(call => call.table === "messages")?.value).toMatchObject({ metadata: { payslipId: "slip", payslipDeliveryId: "delivery", payslipPeriod: "09/2026" } });
  });
  it("handles a concurrent direct-conversation creation", async () => {
    const { client, calls } = database([delivery("chat")], { noConversation: true, createRace: true });
    expect((await flushPayslipDeliveries(client, "period")).delivered).toBe(1);
    expect(calls.filter(call => call.table === "conversations" && call.action === "select")).toHaveLength(2);
  });
  it("treats a repeated message key as successful without duplicating delivery", async () => {
    const { client } = database([delivery("chat")], { messageError: "23505" });
    expect((await flushPayslipDeliveries(client, "period")).delivered).toBe(1);
  });
  it("does not accept another uniqueness violation as proof the message was delivered", async () => {
    const { client } = database([delivery("chat")], { messageError: "23505", duplicateMessageMissing: true });
    expect((await flushPayslipDeliveries(client, "period")).failed).toBe(1);
  });
  it.each([{ lookupError: true }, { memberError: true }, { messageError: "NETWORK" }, { updateError: true }])("records chat failures for retry: %o", async options => {
    const { client, calls } = database([delivery("chat")], options);
    expect((await flushPayslipDeliveries(client, "period")).failed).toBe(1);
    expect(receipts(calls)[0].value).toMatchObject({ status: "failed", last_error: "Chưa gửi được tin nhắn" });
  });
  it("cancels self chat without claiming delivery so the notification remains the receipt", async () => {
    const { client, calls } = database([{ ...delivery("chat"), recipient_account_id: "actor" }]);
    expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 0, failed: 0, remaining: false });
    expect(calls.some(call => call.table === "conversations")).toBe(false);
    expect(receipts(calls)[0].value).toMatchObject({ status: "cancelled", delivered_at: null });
  });
  it("continues bounded batches for a payroll larger than 20 recipients", async () => {
    const { client, rpc } = database(Array.from({ length: 40 }, (_, index) => delivery("notification", `delivery-${index}`)), { laterRows: [delivery("notification", "last")] });
    expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 41, failed: 0, remaining: false });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("does not immediately retry failed rows in the same request", async () => {
    publishNotificationEvent.mockRejectedValue(new Error("Unavailable"));
    const { client, rpc } = database(Array.from({ length: 40 }, (_, index) => delivery("notification", `delivery-${index}`)));
    expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 0, failed: 40, remaining: true });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("does nothing when a concurrent worker already owns all pending deliveries", async () => {
    const { client } = database([]);
    expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 0, failed: 0, remaining: false });
    expect(publishNotificationEvent).not.toHaveBeenCalled();
  });
  it("does not claim delivery when revocation or lease loss removed the receipt claim", async () => {
    const { client, calls } = database([delivery()], { receiptLost: true });
    expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 0, failed: 0, remaining: false });
    expect(receipts(calls)[0].filters).toMatchObject({ id: "delivery", status: "processing" });
  });
  it("preserves a concurrent cancellation instead of recording a failed or successful delivery", async () => {
    const { client, calls } = database([delivery()], { revoked: true, receiptLost: true });
    expect(await flushPayslipDeliveries(client, "period")).toEqual({ delivered: 0, failed: 0, remaining: false });
    expect(receipts(calls)).toHaveLength(1);
    expect(receipts(calls)[0].value).toMatchObject({ status: "cancelled" });
    expect(publishNotificationEvent).not.toHaveBeenCalled();
  });
  it.each(["chat", "notification"] as const)("does not send %s to an inactive, missing or reassigned recipient", async channel => {
    for (const options of [{ accountInactive: true }, { accountMissing: true }, { accountRelinked: true }]) {
      const { client, calls } = database([delivery(channel)], options);
      expect((await flushPayslipDeliveries(client, "period")).failed).toBe(1);
      expect(calls.some(call => call.table === "conversations" || call.table === "messages")).toBe(false);
      expect(receipts(calls)[0].value).toMatchObject({ status: "failed", last_error: "Không có tài khoản phù hợp để nhận phiếu lương" });
    }
    expect(publishNotificationEvent).not.toHaveBeenCalled();
  });
  it.each([{ accountReadError: true }, { accountReadReject: true }])("stores recoverable safe failures when recipient status cannot be read: %o", async options => {
    const { client, calls } = database([delivery()], options);
    expect((await flushPayslipDeliveries(client, "period")).failed).toBe(1);
    expect(receipts(calls)[0].value).toMatchObject({ status: "failed", last_error: "Chưa gửi được thông báo", claim_token: null, lease_until: null });
    expect(publishNotificationEvent).not.toHaveBeenCalled();
    expect(JSON.stringify(receipts(calls))).not.toContain("private");
  });
  it("reads recipient account status once per batch, not once for every channel", async () => {
    const { client, calls } = database([delivery("chat", "chat"), delivery("notification", "notification")]);
    expect((await flushPayslipDeliveries(client, "period")).delivered).toBe(2);
    expect(calls.filter(call => call.table === "app_accounts")).toHaveLength(1);
    expect(calls.find(call => call.table === "app_accounts")?.filters.id).toEqual(["recipient"]);
  });
});
