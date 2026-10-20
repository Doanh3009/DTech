// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const state = vi.hoisted(() => ({ select: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => ({ from: state.from }) }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: vi.fn() }));

import { listAllEmployeeContracts } from "./organizationService";

const hr: AuthenticatedUser = { id: "hr", email: "hr@example.com", username: "hr", displayName: "HR", status: "active", permissions: ["contract.view"] };

describe("employee contract department relationships", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.from.mockReturnValue({ select: state.select });
    state.select.mockImplementation((query: string) => ({
      order: async () => query.includes("departments!employees_department_id_fkey(name)")
        ? { data: [{ id: "contract", employee_id: "employee", contract_number: "HD01", contract_type: "Chính thức", start_date: "2026-09-01", status: "active", attachment_file_id: "private-file", employees: { employee_code: "NV01", full_name: "Nhân viên", departments: { name: "Kỹ thuật" }, positions: { name: "Kỹ sư" } } }], error: null }
        : { data: null, error: { code: "PGRST201", message: "Multiple employee/department relationships" } }
    }));
  });

  it("loads the employee's department when an additional manager relationship exists", async () => {
    const contracts = await listAllEmployeeContracts(hr);
    expect(contracts[0]).toMatchObject({ employeeCode: "NV01", departmentName: "Kỹ thuật", positionName: "Kỹ sư" });
    expect(contracts[0].attachmentFileId).toBeUndefined();
    expect(state.from).toHaveBeenCalledOnce();
  });

  it("denies personal self-service accounts before querying contracts", async () => {
    await expect(listAllEmployeeContracts({ ...hr, permissions: ["attendance.self.view"] })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(state.from).not.toHaveBeenCalled();
  });
});
