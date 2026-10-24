// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({ user: vi.fn(), patch: vi.fn(), dataSet: vi.fn(), detail: vi.fn(), audit: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/features/employees/services/employeeMutationService", () => ({ patchEmployee: mocks.patch }));
vi.mock("@/features/employees/services/employeeRepository", () => ({ getEmployeeDataSetAsync: mocks.dataSet }));
vi.mock("@/features/employees/services/employeeService", () => ({ getEmployeeDetail: mocks.detail }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { PATCH } from "./route";

const employeeId = "11111111-1111-4111-8111-111111111111";
const actor: AuthenticatedUser = { id: "actor", displayName: "HR", username: "hr", email: "hr@example.com", status: "active", permissions: ["employee.edit", "employee.offboard"] };
const lifecycle = { rowVersion: 3, employmentStatus: "terminated", terminationDate: "2026-10-22", terminationReason: "Theo nguyện vọng" };
function request(body: unknown, id = employeeId) {
  return PATCH(new Request(`http://localhost/api/v1/employees/${id}`, { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id }) });
}
function permissions(values: Permission[]) { mocks.user.mockResolvedValue({ ...actor, permissions: values }); }

describe("employee profile command API", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue(actor); mocks.patch.mockResolvedValue(4); });

  it.each([null, { ...actor, status: "disabled" }, { ...actor, permissions: ["employee.view"] }])("checks the session and write permissions before parsing", async (user) => {
    mocks.user.mockResolvedValue(user);
    const response = await request("invalid json");
    expect(response.status).toBe(user === null ? 401 : 403);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    expect((await request("invalid json")).status).toBe(400);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("rejects an invalid employee UUID", async () => {
    expect((await request({ rowVersion: 3, note: "Cập nhật" }, "invalid")).status).toBe(400);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it.each([{ fullName: "Nguyễn Văn An" }, { rowVersion: 3 }, { rowVersion: 3, nationalIdNumber: "123456789" }, { rowVersion: 3, employmentStatus: "terminated" }])("rejects invalid command inputs before mutation", async (input) => {
    expect((await request(input)).status).toBe(400);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("allows lifecycle-only offboarding with employee.offboard", async () => {
    permissions(["employee.offboard"]);
    expect((await request(lifecycle)).status).toBe(200);
    expect(mocks.patch).toHaveBeenCalledWith(employeeId, lifecycle, actor.id);
  });

  it("rejects mixed profile changes without employee.edit", async () => {
    permissions(["employee.offboard"]);
    expect((await request({ ...lifecycle, fullName: "Nguyễn Văn An" })).status).toBe(403);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it.each([lifecycle, { rowVersion: 3, terminationDate: null }, { rowVersion: 3, terminationReason: "Điều chỉnh lý do" }])("requires offboard permission for termination fields", async (input) => {
    permissions(["employee.edit"]);
    expect((await request(input)).status).toBe(403);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("does not grant general status changes to an offboard-only account", async () => {
    permissions(["employee.offboard"]);
    expect((await request({ rowVersion: 3, employmentStatus: "active" })).status).toBe(403);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it("returns the committed receipt without post-commit reads or separate audit writes", async () => {
    mocks.dataSet.mockRejectedValue(new Error("must not read after commit"));
    mocks.audit.mockRejectedValue(new Error("must not audit after commit"));
    const response = await request({ rowVersion: 3, personalEmail: null });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { employeeId, rowVersion: 4 } });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.dataSet).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("preserves a CAS conflict from the command", async () => {
    mocks.patch.mockRejectedValue(new AppError("CONFLICT"));
    const response = await request({ rowVersion: 3, note: "Cập nhật" });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CONFLICT");
    expect(mocks.patch).toHaveBeenCalledOnce();
  });
});
