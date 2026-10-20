import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/features/shared-platforms/services/notificationRepository", () => ({ publishNotificationEvent: vi.fn() }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup: vi.fn() }));

import { getPayroll, listEmployeeSalaries, listPayroll, listPayslips, listSalaries, listSalaryEmployees } from "./service";

type Row = Record<string, unknown>;
type Query = { table: string; selection?: string; orders: { column: string; ascending: boolean }[]; filters: { column: string; value: unknown; list?: boolean }[]; range?: number[] };
const user: AuthenticatedUser = { id: "11111111-1111-4111-8111-111111111111", email: "accounting@example.com", username: "accounting", displayName: "Accounting", status: "active", permissions: ["salary.view", "salary.history.view", "payroll.view", "payslip.self.view"] };
const id = (index: number) => String(index).padStart(6, "0");
function valueAt(row: Row, path: string): unknown { return path.split(".").reduce<unknown>((value, part) => value && typeof value === "object" ? (value as Row)[part] : undefined, row); }
function database(tables: Record<string, Row[]>, errorPage?: { table: string; from: number }) {
  const queries: Query[] = [];
  const client = {
    rpc: vi.fn(async () => ({ data: {}, error: null })),
    from(table: string) {
      const request: Query = { table, orders: [], filters: [] };
      queries.push(request);
      const selectedRows = () => (tables[table] ?? []).filter(row => request.filters.every(filter => filter.list ? (filter.value as unknown[]).includes(valueAt(row, filter.column)) : valueAt(row, filter.column) === filter.value)).sort((a, b) => {
        for (const order of request.orders) {
          const first = valueAt(a, order.column), second = valueAt(b, order.column);
          const compared = first === second ? 0 : String(first) < String(second) ? -1 : 1;
          if (compared) return order.ascending ? compared : -compared;
        }
        return 0;
      });
      const query = {
        select(selection: string) { request.selection = selection; return query; },
        eq(column: string, value: unknown) { request.filters.push({ column, value }); return query; },
        in(column: string, value: unknown[]) { request.filters.push({ column, value, list: true }); return query; },
        order(column: string, options?: { ascending?: boolean }) { request.orders.push({ column, ascending: options?.ascending !== false }); return query; },
        limit() { return query; },
        async maybeSingle() { return { data: selectedRows()[0] ?? null, error: null }; },
        async range(from: number, to: number) {
          request.range = [from, to];
          if (errorPage?.table === table && errorPage.from === from) return { data: null, error: { message: "Page read failed" } };
          return { data: selectedRows().slice(from, to + 1), error: null };
        }
      };
      return query;
    }
  };
  getSupabaseServiceClient.mockReturnValue(client);
  return queries;
}
const salaryRows = (count: number, employeeId?: string) => Array.from({ length: count }, (_, index) => ({ id: id(index), employee_id: employeeId ?? `employee-${id(index)}`, effective_date: "2026-12-01", changed_at: "2026-12-01T00:00:00Z", base_salary: 1000, allowance: 100, bonus: 50, deduction: 10, reason: "Salary fixture", employees: { employee_code: `NV${id(index)}`, full_name: "Employee" } }));
const period = { id: "period-1", period_month: "2026-12-01", status: "calculated", row_version: 2, updated_at: "2026-12-01T00:00:00Z" };
const payrollRows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `line-${id(index)}`, employee_id: `employee-${id(index)}`, payroll_period_id: period.id, is_included: true, work_days: 20, base_salary: 1000, allowance: 100, bonus: 350, leave_cashout_amount: 250, deduction: 50, net_salary: 1400, row_version: 1, employees: { employee_code: `NV${id(index)}`, full_name: "Employee" } }));
const account = { id: user.id, employee_id: "self-employee" };

beforeEach(() => getSupabaseServiceClient.mockReset());

describe("accounting complete paged reads", () => {
  it("reads salary history beyond the database default cap with stable 500-row requests", async () => {
    const queries = database({ employee_salary_history: salaryRows(1051) });
    const records = await listSalaries(user);
    expect(records).toHaveLength(1051);
    expect(records.at(-1)?.id).toBe("000000");
    expect(queries.map(query => query.range)).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(queries.every(query => query.orders.at(-1)?.column === "id")).toBe(true);
  });

  it("keeps one latest salary per employee without history permission after loading every page", async () => {
    const newest = salaryRows(1051), older = newest.map(row => ({ ...row, id: `old-${row.id}`, effective_date: "2026-01-01" }));
    database({ employee_salary_history: [...older, ...newest] });
    const records = await listSalaries({ ...user, permissions: ["salary.view"] });
    expect(records).toHaveLength(1051);
    expect(records.every(record => record.effectiveDate === "2026-12-01")).toBe(true);
  });

  it("paginates employee history but limits salary-only access to one row", async () => {
    const queries = database({ employee_salary_history: [...salaryRows(1051, "employee-one"), ...salaryRows(4, "other")] });
    expect(await listEmployeeSalaries(user, "employee-one")).toHaveLength(1051);
    expect(await listEmployeeSalaries({ ...user, permissions: ["salary.view"] }, "employee-one")).toHaveLength(1);
    expect(queries.at(-1)?.range).toEqual([0, 0]);
    expect(queries.every(query => query.filters.some(filter => filter.column === "employee_id" && filter.value === "employee-one"))).toBe(true);
  });

  it("loads every eligible salary employee while keeping employment filters", async () => {
    database({ employees: Array.from({ length: 1051 }, (_, index) => ({ id: id(index), employee_code: `NV${id(index)}`, full_name: "Employee", employment_status: "active" })).concat([{ id: "ended", employee_code: "ENDED", full_name: "Ended", employment_status: "terminated" }]) });
    expect(await listSalaryEmployees(user)).toHaveLength(1051);
  });

  it("computes full period totals from more than 1000 included lines", async () => {
    const queries = database({ payroll_periods: [period], payroll_lines: [...payrollRows(1051), { ...payrollRows(1)[0], id: "excluded", is_included: false }] });
    expect(await listPayroll(user)).toMatchObject([{ lineCount: 1051, grossTotal: 1051 * 1450, deductionTotal: 1051 * 50, netTotal: 1051 * 1400 }]);
    expect(queries.filter(query => query.table === "payroll_lines").map(query => query.range)).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it("paginates period records too", async () => {
    database({ payroll_periods: Array.from({ length: 1001 }, (_, index) => ({ ...period, id: `period-${id(index)}` })), payroll_lines: [] });
    expect(await listPayroll(user)).toHaveLength(1001);
  });

  it("counts each undelivered published slip once across both channels and excludes revoked receipts", async () => {
    database({ payroll_periods: [{ ...period, status: "published" }], payroll_lines: [], payslip_deliveries: [
      { id: "notify", payroll_period_id: period.id, payslip_id: "slip-one", status: "failed", payslips: { status: "published" } },
      { id: "chat", payroll_period_id: period.id, payslip_id: "slip-one", status: "pending", payslips: { status: "published" } },
      { id: "done", payroll_period_id: period.id, payslip_id: "slip-two", status: "delivered", payslips: { status: "published" } },
      { id: "revoked", payroll_period_id: period.id, payslip_id: "slip-three", status: "failed", payslips: { status: "revoked" } }
    ] });
    expect(await listPayroll(user)).toMatchObject([{ pendingDeliveryCount: 1 }]);
  });

  it("loads every payroll line and its newest slip through a joined period filter", async () => {
    const lines = payrollRows(1051);
    const slips = lines.flatMap(line => [1, 2].map(version => ({ id: `slip-${line.id}-v${version}`, payroll_line_id: line.id, status: version === 2 ? "published" : "revoked", version, payroll_lines: { payroll_period_id: period.id } })));
    const queries = database({ payroll_periods: [period], payroll_lines: lines, payslips: slips });
    const detail = await getPayroll(user, period.id);
    expect(detail.lineCount).toBe(1051);
    expect(detail.grossTotal).toBe(1051 * 1450);
    expect(detail.lines.every(line => line.bonus === 100 && line.leaveCashoutAmount === 250 && line.payslipVersion === 2 && line.payslipStatus === "published")).toBe(true);
    const slipQueries = queries.filter(query => query.table === "payslips");
    expect(slipQueries).toHaveLength(5);
    expect(slipQueries.every(query => query.selection?.includes("payroll_lines!inner") && query.filters.some(filter => filter.column === "payroll_lines.payroll_period_id" && filter.value === period.id) && !query.filters.some(filter => filter.list))).toBe(true);
  });

  it("keeps self payslip ownership and publication filters on every page", async () => {
    const slips = Array.from({ length: 1051 }, (_, index) => ({ id: `slip-${id(index)}`, employee_id: account.employee_id, status: "published", version: 1, created_at: "2026-12-01T00:00:00Z", snapshot: {} }));
    const queries = database({ app_accounts: [account], payslips: [...slips, { ...slips[0], id: "private-other", employee_id: "other" }, { ...slips[0], id: "revoked-self", status: "revoked" }] });
    expect(await listPayslips(user, "self")).toHaveLength(1051);
    expect(queries.filter(query => query.table === "payslips").every(query => query.filters.some(filter => filter.column === "employee_id" && filter.value === account.employee_id) && query.filters.some(filter => filter.column === "status" && filter.value === "published"))).toBe(true);
  });

  it("loads all administrative payslips without adding self filters", async () => {
    const queries = database({ app_accounts: [account], payslips: Array.from({ length: 1051 }, (_, index) => ({ id: id(index), employee_id: `employee-${index}`, status: "revoked", created_at: "2026-12-01T00:00:00Z", snapshot: {} })) });
    expect(await listPayslips(user)).toHaveLength(1051);
    expect(queries.filter(query => query.table === "payslips").every(query => query.filters.length === 0)).toBe(true);
  });

  it("rejects a later page failure without returning partial salary data or payroll totals", async () => {
    database({ employee_salary_history: salaryRows(1051) }, { table: "employee_salary_history", from: 500 });
    await expect(listSalaries(user)).rejects.toMatchObject({ code: "SERVER_ERROR" });
    database({ payroll_periods: [period], payroll_lines: payrollRows(1051) }, { table: "payroll_lines", from: 500 });
    await expect(listPayroll(user)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("rejects permission before any database query", async () => {
    await expect(listSalaries({ ...user, permissions: [] })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });
});
