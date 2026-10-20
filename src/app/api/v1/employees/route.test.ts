// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { employeeBaselinePermissions } from "@/services/authorization/employeeAccessPolicy";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), list: vi.fn(), dataSet: vi.fn(), create: vi.fn()
}));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/features/employees/services/employeeSupabaseRepository", () => ({ getEmployeeListFromSupabase: mocks.list }));
vi.mock("@/features/employees/services/employeeRepository", () => ({ getEmployeeDataSetAsync: mocks.dataSet }));
vi.mock("@/features/employees/services/employeeMutationService", () => ({ createEmployee: mocks.create }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { GET, POST } from "./route";

const employee: AuthenticatedUser = {
  id: "employee-account", displayName: "Nhân viên", username: "employee", email: "employee@example.com",
  status: "active", permissions: [...employeeBaselinePermissions]
};

describe("personnel API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user.mockResolvedValue(employee);
  });

  it("rejects an employee directory request before reading any personnel data", async () => {
    const response = await GET(new Request("http://localhost/api/v1/employees?page=invalid"));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("PERMISSION_DENIED");
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.dataSet).not.toHaveBeenCalled();
  });

  it("rejects employee creation before parsing or writing its payload", async () => {
    const response = await POST(new Request("http://localhost/api/v1/employees", { method: "POST", body: "invalid" }));
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns 401 when no session is present", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/v1/employees"))).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("allows an active HR account with employee.view", async () => {
    mocks.user.mockResolvedValue({ ...employee, permissions: ["employee.view"] });
    mocks.list.mockResolvedValue({ employees: [], filterOptions: {} });
    const response = await GET(new Request("http://localhost/api/v1/employees"));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it("rejects a disabled account even when it has HR permissions", async () => {
    mocks.user.mockResolvedValue({ ...employee, status: "disabled", permissions: ["employee.view"] });
    expect((await GET(new Request("http://localhost/api/v1/employees"))).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
