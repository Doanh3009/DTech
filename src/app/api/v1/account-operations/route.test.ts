// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";

const state = vi.hoisted(() => ({
  user: vi.fn(), provision: vi.fn(), remove: vi.fn(), status: vi.fn(), roles: vi.fn(),
  list: vi.fn(), recover: vi.fn(), normalize: vi.fn(), audit: vi.fn(), read: vi.fn()
}));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: state.user }));
vi.mock("@/features/employees/services/employeeMutationService", () => ({
  provisionAccount: state.provision, deleteAccount: state.remove, setAccountStatus: state.status, replaceAccountRoles: state.roles
}));
vi.mock("@/features/employees/services/accountLifecycleService", () => ({ listPendingAccountOperations: state.list, recoverAccountOperation: state.recover }));
vi.mock("@/services/authorization/employeeAccountRoleService", () => ({ normalizeEmployeeAccountRoles: state.normalize }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: state.audit }));
vi.mock("@/features/employees/services/employeeRepository", () => ({ getEmployeeDataSetAsync: state.read }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { GET } from "./route";
import { POST as RECOVER } from "./[id]/route";
import { DELETE } from "../accounts/[id]/route";
import { PATCH as STATUS } from "../accounts/[id]/status/route";
import { PATCH as ROLES } from "../accounts/[id]/roles/route";
import { POST as PROVISION } from "../employees/[id]/accounts/route";

const id = "20000000-0000-4000-8000-000000000002";
const actorId = "20000000-0000-4000-8000-000000000001";
const requestId = "10000000-0000-4000-8000-000000000001";
const roleId = "30000000-0000-4000-8000-000000000001";
const user: AuthenticatedUser = { id: actorId, username: "operator", displayName: "Operator", email: "operator@example.invalid", status: "active", permissions: ["account.create", "account.delete", "account.enable", "account.disable", "account.assign_role"] };
const params = (value = id) => ({ params: Promise.resolve({ id: value }) });
function request(method: string, body: unknown) {
  return new Request("http://localhost/api/v1/account-operations", { method, headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
const receipt = { requestId, accountId: id, employeeId: id, kind: "provision", state: "completed" };

beforeEach(() => {
  vi.clearAllMocks();
  state.user.mockResolvedValue(user);
  state.normalize.mockImplementation(async (ids: string[]) => [...new Set(ids)]);
  state.provision.mockResolvedValue(receipt);
  state.remove.mockResolvedValue({ ...receipt, kind: "delete" });
  state.status.mockResolvedValue({ id, status: "disabled" });
  state.roles.mockResolvedValue(undefined);
  state.list.mockResolvedValue([]);
  state.recover.mockResolvedValue(receipt);
});

describe("account lifecycle API boundaries", () => {
  const commands = [
    { name: "provision", call: (body: unknown, target = id) => PROVISION(request("POST", body), params(target)), body: { requestId, username: "worker", roleIds: [roleId] } },
    { name: "delete", call: (body: unknown, target = id) => DELETE(request("DELETE", body), params(target)), body: { requestId } },
    { name: "status", call: (body: unknown, target = id) => STATUS(request("PATCH", body), params(target)), body: { status: "disabled", reason: "Thu hồi quyền" } },
    { name: "roles", call: (body: unknown, target = id) => ROLES(request("PATCH", body), params(target)), body: { roleIds: [roleId] } },
    { name: "recover", call: (body: unknown, target = requestId) => RECOVER(request("POST", body), params(target)), body: { action: "resume" } }
  ];

  it.each(commands)("$name authenticates before parsing malformed JSON", async ({ call }) => {
    state.user.mockResolvedValue(null);
    expect((await call("invalid JSON")).status).toBe(401);
    expect(state.provision).not.toHaveBeenCalled(); expect(state.remove).not.toHaveBeenCalled();
  });
  it.each(commands)("$name authorizes before parsing malformed JSON", async ({ call }) => {
    state.user.mockResolvedValue({ ...user, permissions: [] });
    expect((await call("invalid JSON")).status).toBe(403);
  });
  it.each(commands)("$name rejects malformed JSON with 400", async ({ call }) => {
    expect((await call("invalid JSON")).status).toBe(400);
  });
  it.each(commands)("$name validates the route UUID before mutation", async ({ call, body }) => {
    expect((await call(body, "bad-id")).status).toBe(400);
    expect(state.provision).not.toHaveBeenCalled(); expect(state.remove).not.toHaveBeenCalled();
    expect(state.status).not.toHaveBeenCalled(); expect(state.roles).not.toHaveBeenCalled(); expect(state.recover).not.toHaveBeenCalled();
  });
  it.each(commands)("$name denies disabled accounts", async ({ call, body }) => {
    state.user.mockResolvedValue({ ...user, status: "disabled" });
    expect((await call(body)).status).toBe(403);
  });
  it("requires the separate deletion permission", async () => {
    state.user.mockResolvedValue({ ...user, permissions: ["account.disable"] });
    expect((await DELETE(request("DELETE", { requestId }), params())).status).toBe(403);
    expect(state.remove).not.toHaveBeenCalled();
  });
  it("requires an immutable request ID for provisioning and deletion", async () => {
    expect((await PROVISION(request("POST", { username: "worker", roleIds: [roleId] }), params())).status).toBe(400);
    expect((await DELETE(request("DELETE", {}), params())).status).toBe(400);
  });
  it("does not accept an actor injected into a command body", async () => {
    expect((await PROVISION(request("POST", { requestId, username: "worker", roleIds: [roleId], actorId: id }), params())).status).toBe(400);
    expect((await DELETE(request("DELETE", { requestId, actorId: id }), params())).status).toBe(400);
    expect(state.provision).not.toHaveBeenCalled(); expect(state.remove).not.toHaveBeenCalled();
  });
  it("returns provisioning receipt without post-commit reads or audit writes", async () => {
    const response = await PROVISION(request("POST", { requestId, username: "Worker", roleIds: [roleId, roleId] }), params());
    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual(receipt);
    expect(state.provision).toHaveBeenCalledWith(id, { requestId, username: "worker", roleIds: [roleId] }, actorId);
    expect(state.read).not.toHaveBeenCalled(); expect(state.audit).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("returns deletion receipt only after the lifecycle service confirms completion", async () => {
    const response = await DELETE(request("DELETE", { requestId }), params());
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ ...receipt, kind: "delete" });
    expect(state.remove).toHaveBeenCalledExactlyOnceWith(id, requestId, actorId);
    expect(state.audit).not.toHaveBeenCalled();
  });
  it("preserves an uncertain deletion as 503", async () => {
    state.remove.mockRejectedValue(new AppError("NETWORK_ERROR"));
    expect((await DELETE(request("DELETE", { requestId }), params())).status).toBe(503);
  });
  it("validates status-specific authorization", async () => {
    state.user.mockResolvedValue({ ...user, permissions: ["account.enable"] });
    expect((await STATUS(request("PATCH", { status: "disabled", reason: "Thu hồi" }), params())).status).toBe(403);
    state.user.mockResolvedValue({ ...user, permissions: ["account.disable"] });
    expect((await STATUS(request("PATCH", { status: "active" }), params())).status).toBe(403);
    expect(state.status).not.toHaveBeenCalled();
  });
  it("returns minimal status receipt and preserves unknown outcomes", async () => {
    const response = await STATUS(request("PATCH", { status: "disabled", reason: "Thu hồi" }), params());
    expect((await response.json()).data).toEqual({ accountId: id, status: "disabled" });
    state.status.mockResolvedValue({ id: actorId, status: "disabled" });
    expect((await STATUS(request("PATCH", { status: "disabled", reason: "Thu hồi" }), params())).status).toBe(503);
    expect(state.audit).not.toHaveBeenCalled();
  });
  it("returns normalized role receipt without post-commit data reads", async () => {
    const response = await ROLES(request("PATCH", { roleIds: [roleId, roleId] }), params());
    expect((await response.json()).data).toEqual({ accountId: id, roleIds: [roleId] });
    expect(state.roles).toHaveBeenCalledWith(id, { roleIds: [roleId] }, actorId);
    expect(state.read).not.toHaveBeenCalled(); expect(state.audit).not.toHaveBeenCalled();
  });
  it("returns only pending operations supplied by the authorized service", async () => {
    const response = await GET();
    expect(response.status).toBe(200); expect((await response.json()).data).toEqual({ operations: [] });
    expect(state.list).toHaveBeenCalledExactlyOnceWith(actorId);
  });
  it.each([null, { ...user, permissions: [] }, { ...user, status: "disabled" }])("denies an unauthorized operation list", async (account) => {
    state.user.mockResolvedValue(account);
    expect((await GET()).status).toBe(account === null ? 401 : 403);
    expect(state.list).not.toHaveBeenCalled();
  });
  it.each<Permission>(["account.create", "account.delete"])("allows the operation list with %s", async (permission) => {
    state.user.mockResolvedValue({ ...user, permissions: [permission] });
    expect((await GET()).status).toBe(200);
  });
  it("uses the request session for recovery and rejects body actors/unknown actions", async () => {
    const response = await RECOVER(request("POST", { action: "resume", password: "original-password" }), params(requestId));
    expect(response.status).toBe(200);
    expect(state.recover).toHaveBeenCalledExactlyOnceWith(requestId, actorId, "resume", "original-password");
    expect((await RECOVER(request("POST", { action: "reset" }), params(requestId))).status).toBe(400);
    expect((await RECOVER(request("POST", { action: "resume", actorId: id }), params(requestId))).status).toBe(400);
  });
});
