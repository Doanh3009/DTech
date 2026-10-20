import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
const state = vi.hoisted(() => ({ client: undefined as unknown, flush: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => state.client }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: state.audit }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup: vi.fn() }));
vi.mock("./payslipDelivery", () => ({ flushPayslipDeliveries: state.flush }));
import { actOnPayroll } from "./service";
type Row = Record<string, unknown>;
const user = { id: "10000000-0000-4000-8000-000000000001", email: "accountant@example.test", permissions: ["payroll.view", "payroll.create", "payroll.edit", "payroll.lock", "payslip.publish"] } as AuthenticatedUser;
const employeeId = "20000000-0000-4000-8000-000000000001";
function database({ missingRecipient = false, failRecipientRead = 0, status = "locked", rowVersion = 3 } = {}) {
  const period: Row = { id: "payroll-1", period_month: "2026-09-01", timesheet_period_id: "timesheet-1", status, row_version: rowVersion, updated_at: "2026-10-16T00:00:00Z" };
  const line: Row = { id: "line-1", payroll_period_id: period.id, employee_id: employeeId, is_included: true, base_salary: 10_000_000, allowance: 1_000_000, bonus: 0, deduction: 0, net_salary: 11_000_000, work_days: 22, row_version: 1, calculation_snapshot: { salaryHistoryId: "salary-1" }, employees: { employee_code: "NV01", full_name: "Nguyễn Minh Anh" } };
  const tables: Record<string, Row[]> = { payroll_periods: [period], payroll_lines: [line], payslips: [], payslip_deliveries: [], app_accounts: [{ id: user.id, status: "active", employee_id: "actor-employee" }, ...missingRecipient ? [] : [{ id: "recipient-1", status: "active", employee_id: employeeId }]] };
  let recipientReads = 0;
  const operations: Array<{ name: string; values?: Row }> = [];
  const client = {
    from(table: string) {
      const filters: Array<[string, unknown]> = []; let selection = "";
      const selected = () => (tables[table] ?? []).filter(row => filters.every(([key, value]) => key.includes(".") ? key === "payroll_lines.payroll_period_id" && (row.payroll_lines as Row)?.payroll_period_id === value : row[key] === value));
      const read = () => ({ data: selected(), error: null });
      const query = {
        select(value: string) { selection = value; return query; }, eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        order() { return query; }, limit() { return query; },
        async maybeSingle() { return { data: selected()[0] ?? null, error: null }; },
        async range(from: number, to: number) {
          if (table === "app_accounts" && selection === "id,employee_id" && filters.some(([key]) => key === "status")) {
            recipientReads++; operations.push({ name: "read-recipients" });
            if (recipientReads === failRecipientRead) return { data: null, error: { message: "Recipient lookup failed" } };
          }
          return { ...read(), data: selected().slice(from, to + 1) };
        },
        then(resolve: (value: { data: Row[]; error: null }) => unknown) { return Promise.resolve(read()).then(resolve); }
      };
      return query;
    },
    rpc: vi.fn(async (name: string, values?: Row) => {
      operations.push({ name, values });
      if (name === "inspect_payroll_inputs") return { data: { timesheetId: "timesheet-1", timesheetStatus: "locked", timesheetVersion: 1, calculatedTimesheetVersion: 1, payBasis: "actual", employees: [{ employeeId, employeeCode: "NV01", employeeName: "Nguyễn Minh Anh", salaryHistoryId: "salary-1", scheduledWorkdays: 22, actualWorkdays: 22, dailyCount: 30, dailyWorkdays: 22 }], openHighExceptions: 0 }, error: null };
      if (name === "publish_payroll_period" || name === "publish_employee_payslip") {
        period.status = "published"; period.row_version = Number(period.row_version) + 1;
        tables.payslips.push({ id: "slip-1", payroll_line_id: "line-1", status: "published", version: 1, payroll_lines: { payroll_period_id: period.id } });
        return { data: 1, error: null };
      }
      if (name === "operate_payroll_period") { period.status = values?.p_action === "review" ? "reviewed" : values?.p_action === "lock" ? "locked" : "calculated"; period.row_version = Number(period.row_version) + 1; }
      if (name === "approve_payroll_salary") { period.status = "locked"; period.row_version = Number(period.row_version) + 2; }
      if (name === "amend_payroll_salary") { period.status = "calculated"; period.row_version = Number(period.row_version) + 2; }
      return { data: null, error: null };
    })
  };
  state.client = client;
  return { client, operations, period, tables };
}
beforeEach(() => { vi.clearAllMocks(); state.flush.mockResolvedValue({ delivered: 2, failed: 0 }); state.audit.mockResolvedValue(undefined); });
describe("payroll publication preflight and real transitions", () => {
  it("uses one atomic salary approval RPC without publishing or sending", async () => {
    const { client } = database({ status: "calculated" });
    expect(await actOnPayroll(user, "payroll-1", { action: "approve_salary", rowVersion: 3 })).toMatchObject({ status: "locked", rowVersion: 5 });
    expect(client.rpc).toHaveBeenCalledWith("approve_payroll_salary", { p_period_id: "payroll-1", p_row_version: 3, p_actor_id: user.id });
    expect(client.rpc.mock.calls.some(([name]) => name === "publish_payroll_period" || name === "operate_payroll_period")).toBe(false);
    expect(state.flush).not.toHaveBeenCalled();
  });
  it("edits approved unsent payroll through the atomic amend RPC", async () => {
    const { client } = database();
    const values = { action: "update_line" as const, rowVersion: 3, lineId: "line-1", lineRowVersion: 1, baseSalary: 10000000, allowance: 1500000, bonus: 0, deduction: 0, reason: "Bổ sung phụ cấp" };
    expect(await actOnPayroll(user, "payroll-1", values)).toMatchObject({ status: "calculated", rowVersion: 5 });
    expect(client.rpc).toHaveBeenCalledWith("amend_payroll_salary", { p_period_id: "payroll-1", p_row_version: 3, p_actor_id: user.id, p_values: values });
    expect(state.flush).not.toHaveBeenCalled();
  });
  it("rejects salary approval for a viewer", async () => {
    const { client } = database({ status: "calculated" });
    await expect(actOnPayroll({ ...user, permissions: ["payroll.view"] }, "payroll-1", { action: "approve_salary", rowVersion: 3 })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(client.rpc.mock.calls.every(([name]) => name === "inspect_payroll_inputs")).toBe(true);
  });
  it("blocks bulk publication before the RPC when an employee has no active recipient account", async () => {
    const { client, period } = database({ missingRecipient: true });
    await expect(actOnPayroll(user, "payroll-1", { action: "publish", rowVersion: 3 })).rejects.toMatchObject({ code: "VALIDATION_ERROR", message: expect.stringContaining("Nguyễn Minh Anh") });
    expect(client.rpc.mock.calls.some(([name]) => name === "publish_payroll_period")).toBe(false);
    expect(period.status).toBe("locked"); expect(state.flush).not.toHaveBeenCalled();
  });
  it("does not commit any snapshot after a recipient lookup failure", async () => {
    const { client, period } = database({ failRecipientRead: 1 });
    await expect(actOnPayroll(user, "payroll-1", { action: "publish", rowVersion: 3 })).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(client.rpc.mock.calls.some(([name]) => name === "publish_payroll_period")).toBe(false);
    expect(period.status).toBe("locked");
  });
  it("publishes only after recipient validation and flushes durable deliveries afterward", async () => {
    const { client, operations } = database();
    const result = await actOnPayroll(user, "payroll-1", { action: "publish", rowVersion: 3 });
    expect(result.status).toBe("published"); expect(result.lines[0].payslipId).toBe("slip-1");
    const publishIndex = operations.findIndex(item => item.name === "publish_payroll_period");
    expect(operations.slice(0, publishIndex).filter(item => item.name === "read-recipients")).toHaveLength(1);
    expect(state.flush).toHaveBeenCalledWith(client, "payroll-1");
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "payroll.publish", after: { payslipVersion: 1 } }));
  });
  it("preserves a committed snapshot if delivery fails and retries without publishing a new version", async () => {
    const { client, period } = database(); state.flush.mockRejectedValueOnce(new Error("Delivery unavailable"));
    await expect(actOnPayroll(user, "payroll-1", { action: "publish", rowVersion: 3 })).rejects.toThrow("Delivery unavailable");
    expect(period.status).toBe("published");
    await actOnPayroll(user, "payroll-1", { action: "retry_delivery", rowVersion: 4, employeeId });
    expect(client.rpc.mock.calls.filter(([name]) => name === "publish_payroll_period")).toHaveLength(1);
    expect(client.rpc).toHaveBeenCalledWith("retry_payroll_deliveries", { p_period_id: "payroll-1", p_actor_id: user.id, p_employee_id: employeeId });
    expect(state.flush).toHaveBeenLastCalledWith(client, "payroll-1", employeeId);
  });
  it("keeps the same recipient guard for a single employee", async () => {
    const { client } = database({ missingRecipient: true });
    await expect(actOnPayroll(user, "payroll-1", { action: "publish_employee", rowVersion: 3, employeeId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(client.rpc.mock.calls.some(([name]) => name === "publish_employee_payslip")).toBe(false);
  });
  it("rejects a stale row version without invoking a mutation", async () => {
    const { client } = database();
    await expect(actOnPayroll(user, "payroll-1", { action: "lock", rowVersion: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(client.rpc.mock.calls.every(([name]) => name === "inspect_payroll_inputs")).toBe(true);
  });
  it("uses persisted review and lock mutations rather than local progress updates", async () => {
    const { client } = database({ status: "calculated" });
    const reviewed = await actOnPayroll(user, "payroll-1", { action: "review", rowVersion: 3 });
    expect(reviewed).toMatchObject({ status: "reviewed", rowVersion: 4 });
    const locked = await actOnPayroll(user, "payroll-1", { action: "lock", rowVersion: 4 });
    expect(locked).toMatchObject({ status: "locked", rowVersion: 5 });
    expect(client.rpc.mock.calls.filter(([name]) => name === "operate_payroll_period").map(([, values]) => values?.p_action)).toEqual(["review", "lock"]);
  });
  it("does not publish or retry for a viewer lacking send permission", async () => {
    const { client } = database();
    await expect(actOnPayroll({ ...user, permissions: ["payroll.view"] }, "payroll-1", { action: "publish", rowVersion: 3 })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(client.rpc.mock.calls.every(([name]) => name === "inspect_payroll_inputs")).toBe(true);
    expect(state.flush).not.toHaveBeenCalled();
  });
});
