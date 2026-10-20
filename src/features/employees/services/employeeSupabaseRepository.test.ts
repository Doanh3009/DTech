import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));

import { getEmployeeListFromSupabase } from "./employeeSupabaseRepository";

type Row = Record<string, unknown>;
type Result = { data: Row[]; count: number; error: null };
const basicPermissions: Permission[] = ["employee.view"];
const sensitivePermissions: Permission[] = [...basicPermissions, "employee.view_sensitive"];
const departments = [{ id: "department-1", code: "HR", name: "Nhân sự", active: true }];
const positions = [{ id: "position-1", code: "NV", name: "Nhân viên", active: true }];
const employmentTypes = [{ id: "type-1", code: "OFFICE", name: "Văn phòng", worker_category: "office", active: true }];

function employee(number: number, extra: Row = {}): Row {
  return {
    id: `employee-${number}`, employee_code: `NV${String(number).padStart(4, "0")}`,
    full_name: `Nhân viên ${number}`, personal_phone: "0901234567", normalized_phone: "84901234567",
    country: "Việt Nam", department_id: "department-1", position_id: "position-1", employment_type_id: "type-1",
    join_date: "2026-01-01", employment_status: "active", profile_status: "complete", profile_completeness: 90,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", row_version: 1,
    linked_accounts: [], ...extra
  };
}

function mockDatabase(employees: Row[], sensitive: Row[] = [], catalogGate?: Promise<void>) {
  const tables: Record<string, Row[]> = { employees, employee_sensitive_profiles: sensitive, departments, positions, employment_types: employmentTypes };
  const executed: string[] = [];
  getSupabaseServiceClient.mockReturnValue({
    from(table: string) {
      const predicates: Array<(row: Row) => boolean> = [];
      let count = false;
      let sortColumn: string | undefined;
      const execute = async (start = 0, end = Number.MAX_SAFE_INTEGER): Promise<Result> => {
        executed.push(table);
        if (catalogGate && table === "departments") await catalogGate;
        const rows = (tables[table] ?? []).filter((row) => predicates.every((match) => match(row)));
        if (sortColumn) rows.sort((first, second) => String(first[sortColumn!]).localeCompare(String(second[sortColumn!])));
        return { data: rows.slice(start, end + 1), count: count ? rows.length : 0, error: null };
      };
      const query = {
        select: (_columns: string, options?: { count?: string }) => { count = options?.count === "exact"; return query; },
        eq: (column: string, value: unknown) => { predicates.push((row) => row[column] === value); return query; },
        neq: (column: string, value: unknown) => { predicates.push((row) => row[column] !== value); return query; },
        order: (column: string) => { sortColumn = column; return query; },
        range: (start: number, end: number) => execute(start, end),
        then(onFulfilled: (value: Result) => unknown, onRejected?: (reason: unknown) => unknown) {
          return execute().then(onFulfilled, onRejected);
        }
      };
      return query;
    }
  });
  return executed;
}

beforeEach(() => getSupabaseServiceClient.mockReset());

describe("employee roster reads", () => {
  it("keeps exact pagination and filter totals while resolving either account relationship shape", async () => {
    const executed = mockDatabase([
      employee(1, { linked_accounts: [{ employee_id: "employee-1" }] }),
      employee(2, { linked_accounts: { employee_id: "employee-2" } }),
      employee(3, { linked_accounts: null }),
      employee(4, { profile_status: "archived" }),
      employee(5, { employment_status: "terminated" })
    ]);

    const first = await getEmployeeListFromSupabase({ page: 1, pageSize: 2, status: "active" }, basicPermissions);
    expect(first?.employees).toMatchObject({ total: 3, page: 1, pageSize: 2, pageCount: 2 });
    expect(first?.employees.items.map((item) => ({ id: item.id, hasAccount: item.hasAccount, department: item.departmentName })))
      .toEqual([{ id: "employee-1", hasAccount: true, department: "Nhân sự" }, { id: "employee-2", hasAccount: true, department: "Nhân sự" }]);

    const second = await getEmployeeListFromSupabase({ page: 2, pageSize: 2, status: "active" }, basicPermissions);
    expect(second?.employees.items).toMatchObject([{ id: "employee-3", hasAccount: false }]);
    expect(executed).not.toContain("app_accounts");
    expect(executed).not.toContain("employee_sensitive_profiles");
  });

  it("preserves accent-insensitive and department search with structured filters", async () => {
    mockDatabase([
      employee(1, { full_name: "Trần Thị Ánh" }),
      employee(2, { full_name: "Trần Thị Ánh", department_id: "department-2" }),
      employee(3, { full_name: "Trần Thị Ánh", profile_status: "archived" })
    ]);

    const name = await getEmployeeListFromSupabase({ page: 1, pageSize: 10, q: "tran thi anh", departmentId: "department-1" }, basicPermissions);
    expect(name?.employees).toMatchObject({ total: 1, items: [{ id: "employee-1", fullName: "Trần Thị Ánh" }] });

    const department = await getEmployeeListFromSupabase({ page: 1, pageSize: 10, q: "nhan su" }, basicPermissions);
    expect(department?.employees.items.map((item) => item.id)).toEqual(["employee-1"]);
  });

  it("searches past a database batch boundary without losing the last matching employee", async () => {
    mockDatabase(Array.from({ length: 501 }, (_, index) => employee(index + 1)));

    const result = await getEmployeeListFromSupabase({ page: 51, pageSize: 10, q: "nhan vien" }, basicPermissions);
    expect(result?.employees).toMatchObject({ total: 501, pageCount: 51, items: [{ id: "employee-501" }] });
  });

  it("starts permitted sensitive search before a slow catalog finishes and never exposes its values", async () => {
    let releaseCatalog!: () => void;
    const gate = new Promise<void>((resolve) => { releaseCatalog = resolve; });
    const executed = mockDatabase([employee(1)], [{ employee_id: "employee-1", national_id_number: "079012345678", updated_at: "2026-01-01T00:00:00Z" }], gate);

    const pending = getEmployeeListFromSupabase({ page: 1, pageSize: 10, q: "079012345678" }, sensitivePermissions);
    expect(executed).toContain("employees");
    expect(executed).toContain("employee_sensitive_profiles");
    releaseCatalog();
    const result = await pending;
    expect(result?.employees.items.map((item) => item.id)).toEqual(["employee-1"]);
    expect(JSON.stringify(result?.employees.items)).not.toContain("079012345678");
  });

  it("does not read or match sensitive search fields without permission", async () => {
    const executed = mockDatabase([employee(1)], [{ employee_id: "employee-1", national_id_number: "079012345678", updated_at: "2026-01-01T00:00:00Z" }]);

    const result = await getEmployeeListFromSupabase({ page: 1, pageSize: 10, q: "079012345678" }, basicPermissions);
    expect(result?.employees.items).toEqual([]);
    expect(executed).not.toContain("employee_sensitive_profiles");
  });
});
