// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";

const mocks = vi.hoisted(() => ({ user: vi.fn(), sensitive: vi.fn(), archive: vi.fn(), audit: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/features/employees/services/employeeMutationService", () => ({ updateSensitiveProfile: mocks.sensitive, archiveEmployee: mocks.archive }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { PATCH } from "./[id]/sensitive/route";
import { POST } from "./[id]/archive/route";

const id = "11111111-1111-4111-8111-111111111111";
const actor: AuthenticatedUser = { id: "actor", displayName: "HR", username: "hr", email: "hr@example.com", status: "active", permissions: ["employee.edit_sensitive", "employee.archive"] };
const variants = [
  { name: "sensitive", method: "PATCH", handler: PATCH, permission: "employee.edit_sensitive" as Permission, mutation: mocks.sensitive, valid: { rowVersion: 4, bankName: null, reason: "Điều chỉnh hồ sơ" } },
  { name: "archive", method: "POST", handler: POST, permission: "employee.archive" as Permission, mutation: mocks.archive, valid: { rowVersion: 4, reason: "Lưu hồ sơ" } }
];

describe.each(variants)("employee $name API", ({ name, method, handler, permission, mutation, valid }) => {
  async function request(body: unknown, employeeId = id) {
    return handler(new Request(`http://localhost/api/v1/employees/${employeeId}/${name}`, { method, body: typeof body === "string" ? body : JSON.stringify(body), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: employeeId }) });
  }
  beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue(actor); mutation.mockResolvedValue(5); });

  it.each([null, { ...actor, status: "disabled" }, { ...actor, permissions: ["employee.view"] }])("authenticates before parsing request data", async (user) => {
    mocks.user.mockResolvedValue(user);
    expect((await request("malformed")).status).toBe(user === null ? 401 : 403);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("validates malformed JSON and UUID before mutation", async () => {
    expect((await request("malformed")).status).toBe(400);
    expect((await request(valid, "invalid")).status).toBe(400);
    expect(mutation).not.toHaveBeenCalled();
  });

  it.each([{ reason: "Valid reason" }, { rowVersion: 4, reason: "ab" }, { rowVersion: 4, reason: "Valid reason", unknown: true }])("rejects invalid version/reason/keys", async (body) => {
    expect((await request(body)).status).toBe(400);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("uses exactly its own business permission and returns the atomic receipt", async () => {
    mocks.user.mockResolvedValue({ ...actor, permissions: [permission] });
    const response = await request(valid);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({ employeeId: id, rowVersion: 5 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mutation).toHaveBeenCalledExactlyOnceWith(id, valid, actor.id);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each([["CONFLICT", 409], ["PERMISSION_DENIED", 403], ["NETWORK_ERROR", 503]] as const)("preserves command error %s", async (code, status) => {
    mutation.mockRejectedValue(new AppError(code));
    expect((await request(valid)).status).toBe(status);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
