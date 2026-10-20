import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

vi.mock("server-only", () => ({}));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));

const fixtures = vi.hoisted(() => ({
  accounts: [] as Array<{ id: string; display_name: string; employee_id: string | null }>,
  employees: [] as Array<{ id: string; employee_code: string; full_name: string; department_id: string }>,
  departments: [] as Array<{ id: string; name: string }>
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServiceClient: () => ({
    from(table: string) {
      const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: { id: "self", display_name: "Tôi" }, error: null }),
        range: async (from: number, to: number) => ({ data: fixtures.accounts.slice(from, to + 1), error: null }),
        in: async (_column: string, ids: string[]) => ({
          data: (table === "employees" ? fixtures.employees : fixtures.departments).filter((row) => ids.includes(row.id)),
          error: null
        })
      };
      return query;
    }
  })
}));

import { listChatAccounts } from "./service";

const user: AuthenticatedUser = { id: "self", displayName: "Tôi", username: "self", email: "self@example.com", status: "active", permissions: ["chat.access"] };

describe("chat directory", () => {
  it("includes all active accounts across pages, even without an employee profile", async () => {
    fixtures.accounts = Array.from({ length: 501 }, (_, index) => ({
      id: `account-${index}`,
      display_name: index === 0 ? "Tên tài khoản" : `Người dùng ${index}`,
      employee_id: index === 0 ? "employee-1" : null
    }));
    fixtures.employees = [{ id: "employee-1", employee_code: "NV001", full_name: "Nguyễn Văn A", department_id: "department-1" }];
    fixtures.departments = [{ id: "department-1", name: "Kỹ thuật" }];

    const accounts = await listChatAccounts(user);

    expect(accounts).toHaveLength(501);
    expect(accounts[0]).toMatchObject({ name: "Nguyễn Văn A", employeeCode: "NV001", department: "Kỹ thuật" });
    expect(accounts[500]).toMatchObject({ name: "Người dùng 500", roleLabel: "Tài khoản hệ thống" });
  });
});
