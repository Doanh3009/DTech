import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/features/shared-platforms/services/notificationRepository", () => ({ publishNotificationEvent: vi.fn() }));

import { getEmployeeLeaveBalance, listAllLeaveBalances } from "./leaveRepository";

type Row = Record<string, unknown>;
type Filter = { column: string; operation: string; value: unknown };
type Read = { table: string; columns: string; filters: Filter[]; orders: string[]; from: number; to: number };
type Database = Record<"employees" | "leave_types" | "departments" | "leave_ledger" | "leave_requests", Row[]>;
const user: AuthenticatedUser = {
  id: "account-hr", displayName: "Nhân sự", username: "hr", email: "hr@example.com", status: "active",
  permissions: ["leave.balance.view_all"]
};

function employee(number: number, extra: Row = {}): Row {
  return {
    id: `employee-${String(number).padStart(4, "0")}`, employee_code: `NV${String(number).padStart(4, "0")}`,
    full_name: `Nhân viên ${number}`, department_id: "department-1", employment_status: "active", ...extra
  };
}

function leaveType(id = "annual", extra: Row = {}): Row {
  return { id, name: "Phép năm", active: true, deducts_balance: true, ...extra };
}

function ledger(id: string, employeeId: string, leaveTypeId: string, transactionType: string, amount: number | string, extra: Row = {}): Row {
  return {
    id, employee_id: employeeId, leave_year: 2026, leave_type_id: leaveTypeId,
    transaction_type: transactionType, amount, reference_type: "test", reference_id: id,
    effective_date: "2026-01-01", reason: "Kiểm thử", created_at: "2026-01-01T00:00:00Z", ...extra
  };
}

function request(id: string, employeeId: string, leaveTypeId: string, days: number | string, extra: Row = {}): Row {
  return {
    id, employee_id: employeeId, leave_type_id: leaveTypeId, status: "submitted",
    start_date: "2026-06-01", end_date: extra.start_date ?? "2026-06-01", calculated_days: days, ...extra
  };
}

function database(extra: Partial<Database> = {}): Database {
  return {
    employees: [employee(1)], leave_types: [leaveType()], departments: [{ id: "department-1", name: "Nhân sự" }],
    leave_ledger: [], leave_requests: [], ...extra
  };
}

function mockDatabase(tables: Database, failure?: { table: string; from?: number }) {
  const reads: Read[] = [];
  const employees = new Map(tables.employees.map((row) => [row.id, row]));
  const types = new Map(tables.leave_types.map((row) => [row.id, row]));
  const valueAt = (row: Row, column: string) => {
    if (column.startsWith("employees.")) return employees.get(row.employee_id)?.[column.slice("employees.".length)];
    if (column.startsWith("leave_types.")) return types.get(row.leave_type_id)?.[column.slice("leave_types.".length)];
    return row[column];
  };
  getSupabaseServiceClient.mockReturnValue({
    from(table: keyof Database) {
      const filters: Filter[] = [];
      const orders: string[] = [];
      let columns = "*";
      const execute = async (from = 0, to = 999) => {
        reads.push({ table, columns, filters: [...filters], orders: [...orders], from, to });
        if (failure?.table === table && (failure.from ?? 0) === from) return { data: null, error: { message: "Database read failed" } };
        const rows = tables[table].filter((row) => filters.every(({ column, operation, value }) => {
          const actual = valueAt(row, column);
          if (operation === "eq") return actual === value;
          if (operation === "in") return (value as unknown[]).includes(actual);
          if (operation === "gte") return String(actual) >= String(value);
          if (operation === "lte") return String(actual) <= String(value);
          throw new Error(`Unsupported predicate: ${operation}`);
        })).sort((first, second) => {
          for (const column of orders) {
            const comparison = String(first[column]).localeCompare(String(second[column]));
            if (comparison) return comparison;
          }
          return 0;
        });
        // Match Supabase's default maximum of 1,000 rows, including unpaged reads.
        return { data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null };
      };
      const filter = (column: string, operation: string, value: unknown) => { filters.push({ column, operation, value }); return query; };
      const query = {
        select: (value: string) => { columns = value; return query; },
        eq: (column: string, value: unknown) => filter(column, "eq", value),
        in: (column: string, value: unknown[]) => filter(column, "in", value),
        gte: (column: string, value: unknown) => filter(column, "gte", value),
        lte: (column: string, value: unknown) => filter(column, "lte", value),
        order: (column: string) => { orders.push(column); return query; },
        range: execute,
        single: async () => { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
        maybeSingle: async () => { const result = await execute(); return { ...result, data: result.data?.[0] ?? null }; },
        then(onFulfilled: (value: Awaited<ReturnType<typeof execute>>) => unknown, onRejected?: (reason: unknown) => unknown) {
          return execute().then(onFulfilled, onRejected);
        }
      };
      return query;
    }
  });
  return reads;
}

beforeEach(() => getSupabaseServiceClient.mockReset());

describe("all leave balance batch reads", () => {
  it("denies access before obtaining a database client", async () => {
    await expect(listAllLeaveBalances({ ...user, permissions: [] }, 2026)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(getSupabaseServiceClient).not.toHaveBeenCalled();
  });

  it("reports an unavailable database", async () => {
    getSupabaseServiceClient.mockReturnValue(null);
    await expect(listAllLeaveBalances(user, 2026)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it("matches the individual balance accounting and identity fields for every eligible pair", async () => {
    const first = String(employee(1).id);
    const second = String(employee(2).id);
    const third = String(employee(3).id);
    const reads = mockDatabase(database({
      employees: [employee(3, { employment_status: "pending_onboarding", department_id: "missing" }), employee(2, { employment_status: "probation" }), employee(1), employee(4, { employment_status: "terminated" })],
      leave_types: [leaveType("bonus", { name: "Phép thưởng" }), leaveType(), leaveType("unpaid", { deducts_balance: false }), leaveType("inactive", { active: false })],
      leave_ledger: [
        ledger("a-grant", first, "annual", "grant", "12"), ledger("b-carry", first, "annual", "carryover", 2),
        ledger("c-add", first, "annual", "adjustment_add", 1.5), ledger("d-subtract", first, "annual", "adjustment_subtract", -0.5),
        ledger("e-usage", first, "annual", "leave_usage", -3), ledger("f-half", first, "annual", "leave_usage", -0.5),
        ledger("g-reversal", first, "annual", "leave_reversal", 1), ledger("h-expiry", first, "annual", "expiry", -2),
        ledger("i-future-effective", first, "annual", "grant", 0.5, { effective_date: "2027-01-01" }),
        ledger("previous-year", first, "annual", "grant", 99, { leave_year: 2025 }),
        ledger("second-grant", second, "bonus", "grant", 6), ledger("second-usage", second, "bonus", "leave_usage", -1),
        ledger("terminated", String(employee(4).id), "annual", "grant", 99),
        ledger("unpaid", first, "unpaid", "grant", 99), ledger("inactive", first, "inactive", "grant", 99)
      ],
      leave_requests: [
        request("year-start", first, "annual", "0.5", { start_date: "2026-01-01" }),
        request("year-end", first, "annual", 1.5, { status: "pending_approval", start_date: "2026-12-31", end_date: "2027-01-02" }),
        ...["draft", "approved", "rejected", "withdrawn", "cancelled"].map((status) => request(status, first, "annual", 9, { status })),
        request("previous-start", first, "annual", 9, { start_date: "2025-12-31", end_date: "2026-01-02" }),
        request("next-start", first, "annual", 9, { start_date: "2027-01-01" }),
        request("second-pending", second, "bonus", 2.5, { status: "pending_approval" }),
        request("terminated", String(employee(4).id), "annual", 9),
        request("unpaid", first, "unpaid", 9), request("inactive", first, "inactive", 9)
      ]
    }));

    const balances = await listAllLeaveBalances(user, 2026);
    expect(reads).toHaveLength(5);
    // Types with actual ledger history remain visible after deactivation or a
    // policy change to no longer deduct balance. The selected-type UI keeps
    // their historical balance accessible instead of hiding it.
    expect(balances).toHaveLength(12);
    expect([...new Set(balances.map((balance) => balance.leaveTypeId))].sort()).toEqual(["annual", "bonus", "inactive", "unpaid"]);
    expect(balances.some((balance) => balance.employeeId === employee(4).id)).toBe(false);
    expect(balances[0]).toEqual({
      employeeId: first, employeeCode: "NV0001", employeeName: "Nhân viên 1", departmentName: "Nhân sự",
      year: 2026, leaveTypeId: "annual", leaveTypeName: "Phép năm", granted: 12.5, carryover: 2,
      adjustments: 1, used: 2.5, officialRemaining: 11, pending: 2, availableAfterPending: 9
    });
    expect(balances.find((balance) => balance.employeeId === first && balance.leaveTypeId === "inactive")).toMatchObject({ granted: 99, pending: 9, availableAfterPending: 90 });
    expect(balances.find((balance) => balance.employeeId === first && balance.leaveTypeId === "unpaid")).toMatchObject({ granted: 99, pending: 0, availableAfterPending: 99 });
    expect(balances.find((balance) => balance.employeeId === third)).toMatchObject({ departmentName: "—", officialRemaining: 0, pending: 0 });
    for (const balance of balances) {
      await expect(getEmployeeLeaveBalance(balance.employeeId, 2026, balance.leaveTypeId)).resolves.toEqual(balance);
    }
  });

  it("filters the ledger by leave year and pending requests by start year", async () => {
    const id = String(employee(1).id);
    mockDatabase(database({
      leave_ledger: [ledger("old", id, "annual", "grant", 12), ledger("new", id, "annual", "grant", 4, { leave_year: 2027, effective_date: "2026-12-01" })],
      leave_requests: [
        request("old-start", id, "annual", 2, { start_date: "2026-12-31", end_date: "2027-01-02" }),
        request("new-start", id, "annual", 0.5, { start_date: "2027-01-01" }),
        request("approved", id, "annual", 3, { status: "approved", start_date: "2027-06-01" })
      ]
    }));
    await expect(listAllLeaveBalances(user, 2027)).resolves.toMatchObject([{ year: 2027, granted: 4, officialRemaining: 4, pending: 0.5, availableAfterPending: 3.5 }]);
  });

  it("uses the submitted deduction policy when the current type configuration changes", async () => {
    const id = String(employee(1).id);
    mockDatabase(database({
      leave_types: [leaveType(), leaveType("legacy", { active: false, deducts_balance: false })],
      leave_ledger: [ledger("annual-grant", id, "annual", "grant", 12), ledger("legacy-grant", id, "legacy", "grant", 5)],
      leave_requests: [
        request("now-deducting", id, "annual", 2, { request_snapshot: { leaveTypeSnapshot: { deductsBalance: false } } }),
        request("formerly-deducting", id, "legacy", 1.5, { request_snapshot: { leaveTypeSnapshot: { deductsBalance: true } } })
      ]
    }));
    const balances = await listAllLeaveBalances(user, 2026);
    expect(balances).toMatchObject([
      { leaveTypeId: "annual", officialRemaining: 12, pending: 0, availableAfterPending: 12 },
      { leaveTypeId: "legacy", officialRemaining: 5, pending: 1.5, availableAfterPending: 3.5 }
    ]);
    for (const balance of balances) await expect(getEmployeeLeaveBalance(id, 2026, balance.leaveTypeId)).resolves.toEqual(balance);
  });

  it("records year-end cashout as a reduction of balance without counting it as leave used or carrying it forward", async () => {
    const id = String(employee(1).id);
    mockDatabase(database({ leave_ledger: [
      ledger("grant", id, "annual", "grant", 12),
      ledger("usage", id, "annual", "leave_usage", -4),
      ledger("cashout", id, "annual", "adjustment_subtract", -8, { reference_type: "leave_year_end_cashout", effective_date: "2026-12-31" })
    ] }));
    const settled = await listAllLeaveBalances(user, 2026);
    expect(settled).toMatchObject([{ granted: 12, carryover: 0, adjustments: -8, used: 4, officialRemaining: 0, pending: 0, availableAfterPending: 0 }]);
    await expect(getEmployeeLeaveBalance(id, 2026, "annual")).resolves.toEqual(settled[0]);
    await expect(listAllLeaveBalances(user, 2027)).resolves.toMatchObject([{ granted: 0, carryover: 0, adjustments: 0, used: 0, officialRemaining: 0 }]);
  });

  it("returns all balances for 100 employees and three types with eight paged reads", async () => {
    const employees = Array.from({ length: 100 }, (_, index) => employee(index + 1));
    const types = Array.from({ length: 3 }, (_, index) => leaveType(`type-${index}`, { name: `Phép ${index}` }));
    const entries: Row[] = [];
    const requests: Row[] = [];
    for (const employeeRow of employees) {
      for (const type of types) {
        const prefix = `${employeeRow.id}:${type.id}`;
        entries.push(ledger(`${prefix}:grant`, String(employeeRow.id), String(type.id), "grant", 12));
        entries.push(ledger(`${prefix}:usage`, String(employeeRow.id), String(type.id), "leave_usage", -2));
        for (let index = 0; index < 4; index++) requests.push(request(`${prefix}:${index}`, String(employeeRow.id), String(type.id), 0.5, { status: index % 2 ? "submitted" : "pending_approval" }));
      }
    }
    const reads = mockDatabase(database({ employees: [...employees].reverse(), leave_types: [...types].reverse(), leave_ledger: [...entries].reverse(), leave_requests: [...requests].reverse() }));

    const balances = await listAllLeaveBalances(user, 2026);
    expect(balances).toEqual(employees.flatMap((employeeRow) => types.map((type) => ({
      employeeId: employeeRow.id, employeeCode: employeeRow.employee_code, employeeName: employeeRow.full_name,
      departmentName: "Nhân sự", year: 2026, leaveTypeId: type.id, leaveTypeName: type.name,
      granted: 12, carryover: 0, adjustments: 0, used: 2, officialRemaining: 10, pending: 2, availableAfterPending: 8
    }))));
    expect(reads).toHaveLength(8);
    expect(reads.reduce<Record<string, number>>((counts, read) => ({ ...counts, [read.table]: (counts[read.table] ?? 0) + 1 }), {}))
      .toEqual({ employees: 1, leave_types: 1, departments: 1, leave_ledger: 2, leave_requests: 3 });
    expect(reads.filter((read) => read.table === "leave_requests").map(({ from, to }) => [from, to])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    for (const read of reads) {
      expect(read.to - read.from + 1).toBe(500);
      expect(read.orders.at(-1)).toBe("id");
      expect(read.filters.some((filter) => filter.column === "employee_id" || filter.column === "leave_type_id")).toBe(false);
    }
  });

  it("reads employees and department labels past Supabase's 1,000 row limit", async () => {
    const employees = Array.from({ length: 1001 }, (_, index) => employee(index + 1, { department_id: `department-${String(index).padStart(4, "0")}` }));
    const departments = employees.map((row, index) => ({ id: row.department_id, name: `Phòng ${index + 1}` }));
    const reads = mockDatabase(database({ employees: [...employees].reverse(), departments: [...departments].reverse() }));

    const balances = await listAllLeaveBalances(user, 2026);
    expect(balances).toHaveLength(1001);
    expect(balances.at(-1)).toMatchObject({ employeeCode: "NV1001", departmentName: "Phòng 1001", officialRemaining: 0 });
    expect(reads.filter((read) => read.table === "employees").map((read) => read.from)).toEqual([0, 500, 1000]);
    expect(reads.filter((read) => read.table === "departments").map((read) => read.from)).toEqual([0, 500, 1000]);
  });

  it("reads active balance types past the catalog limit", async () => {
    const types = Array.from({ length: 1001 }, (_, index) => leaveType(`type-${String(index).padStart(4, "0")}`, { name: `Phép ${String(index).padStart(4, "0")}` }));
    const lastType = types.at(-1)!;
    const reads = mockDatabase(database({ leave_types: [...types].reverse(), leave_ledger: [ledger("last-grant", String(employee(1).id), String(lastType.id), "grant", 7)] }));

    const balances = await listAllLeaveBalances(user, 2026);
    expect(balances).toHaveLength(1001);
    expect(balances.at(-1)).toMatchObject({ leaveTypeId: lastType.id, leaveTypeName: lastType.name, granted: 7 });
    expect(reads.filter((read) => read.table === "leave_types").map((read) => read.from)).toEqual([0, 500, 1000]);
  });

  it.each([500, 1001])("includes every ledger entry when the ledger contains %i rows", async (count) => {
    const id = String(employee(1).id);
    const entries = Array.from({ length: count }, (_, index) => ledger(`grant-${String(index).padStart(4, "0")}`, id, "annual", "grant", 0.5));
    const reads = mockDatabase(database({ leave_ledger: [...entries].reverse() }));

    await expect(listAllLeaveBalances(user, 2026)).resolves.toMatchObject([{ granted: count * 0.5, officialRemaining: count * 0.5 }]);
    expect(reads.filter((read) => read.table === "leave_ledger").map((read) => read.from)).toEqual(count === 500 ? [0, 500] : [0, 500, 1000]);
  });

  it.each(["employees", "leave_types"] as const)("returns an empty list when %s has no eligible rows", async (table) => {
    mockDatabase(database({ [table]: [] }));
    await expect(listAllLeaveBalances(user, 2026)).resolves.toEqual([]);
  });

  it.each(["employees", "leave_types", "departments", "leave_ledger", "leave_requests"] as const)("propagates errors from %s", async (table) => {
    mockDatabase(database(), { table });
    await expect(listAllLeaveBalances(user, 2026)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });

  it.each(["leave_ledger", "leave_requests"] as const)("rejects errors on later %s pages instead of returning a partial balance", async (table) => {
    const id = String(employee(1).id);
    const rows = Array.from({ length: 501 }, (_, index) => table === "leave_ledger"
      ? ledger(`row-${String(index).padStart(4, "0")}`, id, "annual", "grant", 0.5)
      : request(`row-${String(index).padStart(4, "0")}`, id, "annual", 0.5));
    const reads = mockDatabase(database({ [table]: rows }), { table, from: 500 });
    await expect(listAllLeaveBalances(user, 2026)).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(reads.filter((read) => read.table === table).map((read) => read.from)).toEqual([0, 500]);
  });
});
