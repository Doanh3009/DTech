import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));

import { listProjects } from "./projectRepository";

type Row = Record<string, unknown>;
type Query = { table: string; columns: string; filters: Array<[string, unknown]> };
const accountId = "11111111-1111-4111-8111-111111111111";
const user: AuthenticatedUser = { id: accountId, displayName: "Giám sát", username: "supervisor", email: "supervisor@example.com", status: "active", permissions: ["project.view"] };

function mockDatabase(options: { accounts?: Row[]; accountError?: boolean } = {}) {
  const queries: Query[] = [];
  const tables: Record<string, Row[]> = {
    app_accounts: options.accounts ?? [{ id: accountId, employee_id: "employee-1", primary_email: user.email }],
    projects: [
      { id: "assigned", code: "A", name: "Được phân công", status: "active", row_version: 1 },
      { id: "managed", code: "M", name: "Được quản lý", status: "active", row_version: 1, project_manager_employee_id: "employee-1" },
      { id: "created", code: "C", name: "Đã tạo", status: "active", row_version: 1, created_by: accountId },
      { id: "inactive", code: "I", name: "Phân công hết hiệu lực", status: "active", row_version: 1 },
      { id: "outside", code: "O", name: "Ngoài phạm vi", status: "active", row_version: 1 }
    ].map((project) => ({ ...project, start_date: "2026-09-01" })),
    project_assignments: [
      { project_id: "assigned", employee_id: "employee-1", status: "active" },
      { project_id: "inactive", employee_id: "employee-1", status: "inactive" },
      { project_id: "outside", employee_id: "employee-2", status: "active" }
    ],
    worksites: [{ id: "worksite-1", project_id: "assigned" }]
  };
  const client = {
    from(table: string) {
      const entry: Query = { table, columns: "", filters: [] };
      queries.push(entry);
      const result = (single = false) => {
        const data = (tables[table] ?? []).filter((row) => entry.filters.every(([column, value]) => row[column] === value));
        return { data: single ? data[0] ?? null : data, error: table === "app_accounts" && options.accountError ? { code: "UNAVAILABLE" } : null };
      };
      const query = {
        select(columns: string) { entry.columns = columns; return query; },
        eq(column: string, value: unknown) { entry.filters.push([column, value]); return query; },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => result(true),
        then(onFulfilled: (value: ReturnType<typeof result>) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve(result()).then(onFulfilled, onRejected);
        }
      };
      return query;
    }
  };
  getSupabaseServiceClient.mockReturnValue(client);
  return queries;
}

beforeEach(() => getSupabaseServiceClient.mockReset());

describe("project read scope", () => {
  it("keeps assigned, managed and created projects while resolving both identity IDs in one lookup", async () => {
    const queries = mockDatabase();

    const projects = await listProjects(user);

    expect(projects.map((project) => project.id)).toEqual(["assigned", "managed", "created"]);
    expect(projects[0]).toMatchObject({ currentPeople: 1, worksiteCount: 1 });
    expect(queries.filter((query) => query.table === "app_accounts")).toEqual([
      { table: "app_accounts", columns: "id,employee_id", filters: [["id", accountId]] }
    ]);
    expect(queries.find((query) => query.columns === "project_id")?.filters).toContainEqual(["status", "active"]);
  });

  it("uses the email branch for a legacy account identifier", async () => {
    const queries = mockDatabase();

    expect((await listProjects({ ...user, id: "legacy-supervisor" })).map((project) => project.id)).toEqual(["assigned", "managed", "created"]);
    expect(queries.filter((query) => query.table === "app_accounts")).toEqual([
      { table: "app_accounts", columns: "id,employee_id", filters: [["primary_email", user.email]] }
    ]);
  });

  it("keeps created projects for an account without an employee link", async () => {
    mockDatabase({ accounts: [{ id: accountId, employee_id: null, primary_email: user.email }] });

    expect((await listProjects(user)).map((project) => project.id)).toEqual(["created"]);
  });

  it("preserves the employee-only email fallback when the identifier cannot resolve the account", async () => {
    const queries = mockDatabase({ accounts: [{ id: "another-account", employee_id: "employee-1", primary_email: user.email }] });

    expect((await listProjects(user)).map((project) => project.id)).toEqual(["assigned", "managed"]);
    expect(queries.filter((query) => query.table === "app_accounts")).toHaveLength(2);
  });

  it.each(["project_monitoring.view_all", "worker_attendance.view_all"] as const)("preserves company scope for %s", async (permission) => {
    const queries = mockDatabase();

    expect(await listProjects({ ...user, permissions: [permission] })).toHaveLength(5);
    expect(queries.filter((query) => query.table === "app_accounts")).toHaveLength(0);
  });

  it("fails closed when the account lookup fails", async () => {
    mockDatabase({ accountError: true });

    await expect(listProjects(user)).rejects.toMatchObject({ code: "SERVER_ERROR" });
  });
});
