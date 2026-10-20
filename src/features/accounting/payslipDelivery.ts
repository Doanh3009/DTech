import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { publishNotificationEvent } from "@/features/shared-platforms/services/notificationRepository";
import { AppError } from "@/lib/api/errors";

type Delivery = { id: string; payslip_id: string; recipient_account_id: string; actor_account_id: string; channel: "notification" | "chat" };

async function deliverChat(client: SupabaseClient, delivery: Delivery, periodLabel: string) {
  const actorId = delivery.actor_account_id, recipientId = delivery.recipient_account_id;
  const directKey = [actorId, recipientId].sort().join(":");
  const lookup = await client.from("conversations").select("id").eq("direct_key", directKey).maybeSingle();
  if (lookup.error) throw new Error("CHAT_READ_FAILED");
  let conversation = lookup.data;
  if (!conversation) {
    const { data: created, error: createError } = await client.from("conversations").insert({ type: "direct", direct_key: directKey, created_by: actorId }).select("id").maybeSingle();
    if (createError && createError.code !== "23505") throw new Error("CHAT_CREATE_FAILED");
    conversation = created;
    if (!conversation) {
      const result = await client.from("conversations").select("id").eq("direct_key", directKey).maybeSingle();
      if (result.error) throw new Error("CHAT_READ_FAILED");
      conversation = result.data;
    }
  }
  if (!conversation?.id) throw new Error("CHAT_CREATE_FAILED");
  // Repeating a delivery repairs an interrupted conversation setup safely.
  const { error: memberError } = await client.from("conversation_members").upsert([
    { conversation_id: conversation.id, account_id: actorId, role: "owner" },
    { conversation_id: conversation.id, account_id: recipientId, role: "member" }
  ], { onConflict: "conversation_id,account_id", ignoreDuplicates: true });
  if (memberError) throw new Error("CHAT_MEMBERS_FAILED");
  const { error: messageError } = await client.from("messages").insert({
    conversation_id: conversation.id, sender_account_id: actorId,
    body: `Phiếu lương tháng ${periodLabel} của bạn đã được phát hành.`,
    metadata: { payslipId: delivery.payslip_id, payslipPeriod: periodLabel, payslipDeliveryId: delivery.id }
  });
  if (messageError && messageError.code !== "23505") throw new Error("CHAT_MESSAGE_FAILED");
  if (messageError) {
    const { count, error } = await client.from("messages").select("id", { count: "exact", head: true }).eq("metadata->>payslipDeliveryId", delivery.id).eq("conversation_id", conversation.id).eq("sender_account_id", actorId);
    if (error || !count) throw new Error("CHAT_DUPLICATE_NOT_VERIFIED");
  }
  const { error: updateError } = await client.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversation.id);
  if (updateError) throw new Error("CHAT_UPDATE_FAILED");
}

async function flushBatch(client: SupabaseClient, periodId: string, employeeId?: string) {
  const claimToken = crypto.randomUUID();
  const { data: claimed, error: claimError } = await client.rpc("claim_payslip_deliveries", { p_period_id: periodId, p_claim_token: claimToken, p_employee_id: employeeId ?? null });
  if (claimError || !claimed) throw new AppError("SERVER_ERROR", "Chưa thể gửi thông báo phiếu lương. Vui lòng gửi lại.");
  const rows = claimed as Delivery[];
  const recipientIds = [...new Set(rows.map(delivery => delivery.recipient_account_id))];
  // Account ownership can change after publication. Recheck at delivery time
  // rather than trusting the recipient captured when the outbox was queued.
  const recipients = new Map<string, { employeeId: string; status: string }>();
  let recipientReadFailed = false;
  if (recipientIds.length) {
    try {
      const { data, error } = await client.from("app_accounts").select("id,employee_id,status").in("id", recipientIds);
      recipientReadFailed = Boolean(error);
      for (const account of data ?? []) recipients.set(String(account.id), { employeeId: String(account.employee_id), status: String(account.status) });
    } catch { recipientReadFailed = true; }
  }
  let delivered = 0, failed = 0;
  const cancelDelivery = async (delivery: Delivery) => {
    const { error } = await client.from("payslip_deliveries").update({ status: "cancelled", last_error: null, delivered_at: null, claim_token: null, lease_until: null, updated_at: new Date().toISOString() }).eq("id", delivery.id).eq("claim_token", claimToken).eq("status", "processing").select("id").maybeSingle();
    if (error) throw new AppError("SERVER_ERROR", "Không thể cập nhật trạng thái gửi phiếu.");
    // Zero rows means revocation or another claim won the race. Neither is a
    // successful delivery, and neither must overwrite the newer receipt.
  };
  const processDelivery = async (delivery: Delivery) => {
    let lastError: string | null = null;
    try {
      const { data: slip, error: slipError } = await client.from("payslips").select("id,employee_id,status,snapshot,version").eq("id", delivery.payslip_id).maybeSingle();
      if (slipError) throw new Error("PAYSLIP_READ_FAILED");
      if (!slip || slip.status !== "published") {
        await cancelDelivery(delivery);
        return;
      }
      if (recipientReadFailed) throw new Error("RECIPIENT_READ_FAILED");
      const recipient = recipients.get(delivery.recipient_account_id);
      if (!recipient || recipient.status !== "active" || !slip.employee_id || recipient.employeeId !== String(slip.employee_id)) throw new Error("RECIPIENT_UNAVAILABLE");
      if (delivery.channel === "chat" && delivery.actor_account_id === delivery.recipient_account_id) {
        // Self chat is not a transport. The separate notification row is the
        // receipt for the accountant's own slip, including any failure there.
        await cancelDelivery(delivery);
        return;
      }
      const snapshot = slip.snapshot as Record<string, unknown>;
      const month = String(snapshot.periodMonth ?? "").slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("PAYSLIP_PERIOD_INVALID");
      const periodLabel = `${month.slice(5, 7)}/${month.slice(0, 4)}`;
      if (delivery.channel === "chat") await deliverChat(client, delivery, periodLabel);
      else {
        const result = await publishNotificationEvent({ eventKey: "payslip.published", aggregateType: "payslip", aggregateId: delivery.payslip_id, actorAccountId: delivery.actor_account_id, idempotencyKey: `payslip-delivery:${delivery.id}`, recipients: [delivery.recipient_account_id], values: { period_month: month }, deepLink: `/personal/payslips/${delivery.payslip_id}`, priority: "important" }, client);
        // A disabled/missing template is not proof of delivery.
        if (result.created === 0) {
          const { count, error } = await client.from("notifications").select("id", { count: "exact", head: true }).eq("event_id", result.eventId).eq("recipient_account_id", delivery.recipient_account_id);
          if (error || !count) throw new Error("NOTIFICATION_NOT_CREATED");
        }
      }
    } catch (reason) {
      lastError = reason instanceof Error && reason.message === "RECIPIENT_UNAVAILABLE" ? "Không có tài khoản phù hợp để nhận phiếu lương" : delivery.channel === "chat" ? "Chưa gửi được tin nhắn" : "Chưa gửi được thông báo";
    }
    const { data: receipt, error: receiptError } = await client.from("payslip_deliveries").update({ status: lastError ? "failed" : "delivered", last_error: lastError, delivered_at: lastError ? null : new Date().toISOString(), claim_token: null, lease_until: null, updated_at: new Date().toISOString() }).eq("id", delivery.id).eq("claim_token", claimToken).eq("status", "processing").select("id").maybeSingle();
    if (receiptError) throw new AppError("SERVER_ERROR", "Phiếu lương đã phát hành nhưng chưa lưu được biên nhận gửi. Vui lòng kiểm tra và gửi lại.");
    if (!receipt) return;
    if (lastError) failed += 1; else delivered += 1;
  };
  let cursor = 0;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(8, rows.length) }, async () => {
    while (cursor < rows.length) await processDelivery(rows[cursor++]);
  }));
  const rejected = workers.find(worker => worker.status === "rejected");
  if (rejected?.status === "rejected") throw rejected.reason;
  return { delivered, failed, remaining: claimed.length === 40 };
}

export async function flushPayslipDeliveries(client: SupabaseClient, periodId: string, employeeId?: string) {
  const started = Date.now();
  let delivered = 0, failed = 0, remaining = false;
  // Large payrolls retain pending rows for a further explicit retry; never
  // equate publication with successful delivery or hold the request forever.
  for (let batch = 0; batch < 10; batch += 1) {
    const result = await flushBatch(client, periodId, employeeId);
    delivered += result.delivered; failed += result.failed; remaining = result.remaining;
    if (!remaining || failed || Date.now() - started >= 20_000) break;
  }
  return { delivered, failed, remaining };
}
