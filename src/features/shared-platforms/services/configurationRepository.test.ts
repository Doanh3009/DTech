import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import type { systemNoticeSchema } from "@/features/shared-platforms/schemas";

const { getSupabaseServiceClient, resolvePlatformIdentity, publishNotificationEvent, recordAuditLog } = vi.hoisted(() => ({
  getSupabaseServiceClient: vi.fn(), resolvePlatformIdentity: vi.fn(), publishNotificationEvent: vi.fn(), recordAuditLog: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("./platformIdentity", () => ({ resolvePlatformIdentity }));
vi.mock("./notificationRepository", () => ({ publishNotificationEvent }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog }));

import { createDelegation, createSystemNotice, listActiveSystemNotices, publishApprovalWorkflow } from "./configurationRepository";

const user: AuthenticatedUser = {
  id: "account-admin", username: "test.admin", email: "admin@example.com", displayName: "Admin", status: "active",
  permissions: ["notification.system_notice.manage", "approval.workflow.manage", "approval.delegation.manage"]
};
type NoticeInput = z.infer<typeof systemNoticeSchema>;
const noticeInput: NoticeInput = {
  title: "Thông báo kiểm thử", message: "Nội dung thông báo", startAt: "2026-10-08T00:00:00Z", endAt: "2026-10-09T00:00:00Z",
  audienceType: "specific_roles", audienceIds: ["role-employee", "role-supervisor"], priority: "normal", status: "active"
};
type PlannedResult = { table: string; data: unknown; error?: { code: string; message: string } };
const readError = { code: "PGRST201", message: "Ambiguous relationship" };

function database(results: PlannedResult[]) {
  const calls: { table: string; selection?: string; inserted: boolean; filters: [string, string, unknown][] }[] = [];
  const client = {
    from(table: string) {
      const planned = results.shift();
      expect(planned?.table).toBe(table);
      const call = { table, filters: [] as [string, string, unknown][], selection: undefined as string | undefined, inserted: false };
      calls.push(call);
      const response = () => {
        // The real schema has account_id and assigned_by pointing to app_accounts.
        if (table === "account_roles" && call.selection?.includes("app_accounts") && !call.selection.includes("!account_roles_account_id_fkey!inner")) {
          return { data: null, error: readError };
        }
        let data = planned?.data;
        if (Array.isArray(data)) {
          data = data.filter((row: Record<string, unknown>) => call.filters.every(([method, column, expected]) => {
            const actual = column.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, row);
            if (actual === undefined) return true;
            return method === "eq" ? actual === expected : method === "in" ? (expected as unknown[]).includes(actual) : true;
          }));
        }
        return { data, error: planned?.error ?? null };
      };
      const query = {
        select(selection: string) { call.selection = selection; return query; },
        insert() { call.inserted = true; return query; }, order() { return query; },
        eq(column: string, value: unknown) { call.filters.push(["eq", column, value]); return query; },
        in(column: string, values: unknown[]) { call.filters.push(["in", column, values]); return query; },
        lte() { return query; }, gte() { return query; },
        single: async () => response(), maybeSingle: async () => response(),
        then(onFulfilled: (value: unknown) => unknown) { return Promise.resolve(response()).then(onFulfilled); }
      };
      return query;
    }
  };
  getSupabaseServiceClient.mockReturnValue(client);
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  resolvePlatformIdentity.mockResolvedValue({ accountId: user.id, employeeId: "employee-admin", displayName: user.displayName });
  publishNotificationEvent.mockResolvedValue({ eventId: "event-1", created: 1 });
});

describe("system notice recipients", () => {
  it("delivers once per active role member through the recipient foreign key", async () => {
    const calls = database([
      { table: "account_roles", data: [
        { account_id: "active-member", role_id: "role-employee", recipient: { status: "active" } },
        { account_id: "active-member", role_id: "role-supervisor", recipient: { status: "active" } },
        { account_id: "disabled-member", role_id: "role-employee", recipient: { status: "disabled" } },
        { account_id: "other-member", role_id: "role-other", recipient: { status: "active" } }
      ] },
      { table: "system_notices", data: { id: "notice-1" } }
    ]);
    await expect(createSystemNotice(user, noticeInput)).resolves.toEqual({ id: "notice-1" });
    expect(publishNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({ recipients: ["active-member"], aggregateId: "notice-1" }), expect.anything());
    expect(calls[0].filters).toContainEqual(["eq", "recipient.status", "active"]);
  });

  it("excludes disabled accounts from notices for all users", async () => {
    database([
      { table: "app_accounts", data: [{ id: "active-member", status: "active" }, { id: "disabled-member", status: "disabled" }] },
      { table: "system_notices", data: { id: "notice-1" } }
    ]);
    await createSystemNotice(user, { ...noticeInput, audienceType: "all_users", audienceIds: [] });
    expect(publishNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({ recipients: ["active-member"] }), expect.anything());
  });

  it("targets only active accounts linked to employees in selected departments", async () => {
    database([
      { table: "employees", data: [{ id: "employee-a", department_id: "department-a" }, { id: "employee-b", department_id: "department-b" }] },
      { table: "app_accounts", data: [
        { id: "active-member", employee_id: "employee-a", status: "active" },
        { id: "disabled-member", employee_id: "employee-a", status: "disabled" },
        { id: "other-member", employee_id: "employee-b", status: "active" }
      ] },
      { table: "system_notices", data: { id: "notice-1" } }
    ]);
    await createSystemNotice(user, { ...noticeInput, audienceType: "specific_departments", audienceIds: ["department-a"] });
    expect(publishNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({ recipients: ["active-member"] }), expect.anything());
  });

  it("accepts a genuinely empty department audience", async () => {
    database([{ table: "employees", data: [] }, { table: "system_notices", data: { id: "notice-1" } }]);
    await createSystemNotice(user, { ...noticeInput, audienceType: "specific_departments", audienceIds: ["department-a"] });
    expect(publishNotificationEvent).toHaveBeenCalledWith(expect.objectContaining({ recipients: [] }), expect.anything());
  });

  it.each([
    ["all_users", [{ table: "app_accounts", data: null, error: readError }]],
    ["specific_roles", [{ table: "account_roles", data: null, error: readError }]],
    ["specific_departments", [{ table: "employees", data: null, error: readError }]],
    ["specific_departments", [{ table: "employees", data: [{ id: "employee-a" }] }, { table: "app_accounts", data: null, error: readError }]]
  ] as [NoticeInput["audienceType"], PlannedResult[]][])("reports failed %s recipient reads as a server error", async (audienceType, recipientResults) => {
    const calls = database([...recipientResults]);
    await expect(createSystemNotice(user, { ...noticeInput, audienceType })).rejects.toMatchObject({ code: "SERVER_ERROR", status: 500 });
    expect(calls.some((call) => call.inserted)).toBe(false);
    expect(publishNotificationEvent).not.toHaveBeenCalled();
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("keeps drafts unpublished", async () => {
    database([{ table: "system_notices", data: { id: "notice-1" } }]);
    await createSystemNotice(user, { ...noticeInput, status: "draft" });
    expect(publishNotificationEvent).not.toHaveBeenCalled();
  });

  it("requires notice management permission before accessing the database", async () => {
    await expect(createSystemNotice({ ...user, permissions: [] }, noticeInput)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });
});

describe("configuration lookup failures", () => {
  it.each(["account_roles", "employees"])("reports failed %s audience membership reads", async (table) => {
    database([
      { table: "system_notices", data: [{ id: "notice-1", audience_type: "specific_roles", audience_ids: ["role-employee"] }] },
      { table: "account_roles", data: [], ...(table === "account_roles" ? { error: readError } : {}) },
      { table: "employees", data: { department_id: "department-a" }, ...(table === "employees" ? { error: readError } : {}) }
    ]);
    await expect(listActiveSystemNotices(user)).rejects.toMatchObject({ code: "SERVER_ERROR", status: 500 });
  });

  it.each(["specific_user", "specific_role"] as const)("reports a failed %s approver lookup as a server error", async (approverSource) => {
    database([{ table: approverSource === "specific_user" ? "app_accounts" : "roles", data: null, error: readError }]);
    await expect(publishApprovalWorkflow(user, {
      code: "TEST_FLOW", name: "Quy trình kiểm thử", domainType: "LEAVE", steps: [{ stepName: "Duyệt", approverSource, resolverConfig: approverSource === "specific_user" ? { accountId: "account-a" } : { roleCode: "employee" } }]
    })).rejects.toMatchObject({ code: "SERVER_ERROR", status: 500 });
  });

  it("reports failed delegation account reads as a server error", async () => {
    database([{ table: "app_accounts", data: null, error: readError }]);
    await expect(createDelegation(user, { fromAccountId: "account-a", toAccountId: "account-b", startAt: noticeInput.startAt, endAt: noticeInput.endAt, scope: "LEAVE", reason: "Ủy quyền kiểm thử" })).rejects.toMatchObject({ code: "SERVER_ERROR", status: 500 });
  });
});
