import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  available: true, moduleEnabled: true, pepper: "unit-only-pepper-abcdefghijklmnopqrstuvwxyz",
  rpc: vi.fn(), rpcResponse: vi.fn(), abortSignal: vi.fn(),
  getUserById: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(),
  readSettings: vi.fn(), clientOptions: vi.fn(),
  operation: {} as Record<string, unknown>, calls: [] as string[]
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: () => ({ SESSION_HASH_PEPPER: state.pepper }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: (options: unknown) => {
  state.clientOptions(options);
  return state.available ? { rpc: state.rpc, auth: { admin: { getUserById: state.getUserById, createUser: state.createUser, deleteUser: state.deleteUser } } } : null;
} }));
vi.mock("@/lib/time/timezone", () => ({ getBusinessDateKey: () => "2026-10-22" }));
vi.mock("@/config/erpModules", () => ({ isErpModuleEnabled: () => state.moduleEnabled }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({ readSettingsGroup: (name: string) => state.readSettings(name) }));

import { deleteAccountLifecycle, listPendingAccountOperations, provisionAccountLifecycle, recoverAccountOperation } from "./accountLifecycleService";

const ids = {
  request: "10000000-0000-4000-8000-000000000001", actor: "20000000-0000-4000-8000-000000000001",
  otherActor: "20000000-0000-4000-8000-000000000002", employee: "30000000-0000-4000-8000-000000000001",
  account: "40000000-0000-4000-8000-000000000001", auth: "50000000-0000-4000-8000-000000000001",
  role: "60000000-0000-4000-8000-000000000001"
};
const password = "UnitOnly!123";
const fingerprint = (value = password) => createHmac("sha256", state.pepper).update(`dtech:credential-fingerprint:v1:${ids.request}\0`).update(value).digest("hex");
const generatedPassword = () => `Dt!${createHmac("sha256", state.pepper).update(`dtech:initial-password:v1:${ids.request}`).digest("base64url").slice(0, 28)}9a`;
const operation = (overrides: Record<string, unknown> = {}) => ({
  requestId: ids.request, kind: "provision", state: "prepared", accountId: ids.account,
  authUserId: ids.auth, employeeId: ids.employee, username: "unit_employee", loginEmail: "unit@example.invalid",
  credentialMode: "provided", credentialFingerprint: fingerprint(), roleIds: [ids.role], loginPhone: null,
  displayName: "Unit employee", actorId: ids.actor, createdAt: "2026-10-22T06:00:00.000Z", completedAt: null,
  ...overrides
});
const authUser = (overrides: Record<string, unknown> = {}) => ({
  id: ids.auth, email: "unit@example.invalid", app_metadata: { dtech_operation_id: ids.request }, ...overrides
});
const input = (overrides = {}) => ({ requestId: ids.request, username: "unit_employee", password, roleIds: [ids.role], loginEmail: "unit@example.invalid", ...overrides });
const authMissing = { data: { user: null }, error: { status: 404, code: "user_not_found" } };
const result = (overrides = {}) => ({ requestId: ids.request, accountId: ids.account, employeeId: ids.employee, kind: "provision", state: "completed", ...overrides });

describe("durable account lifecycle orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T06:05:00.000Z"));
    vi.clearAllMocks(); state.available = true; state.moduleEnabled = true;
    state.pepper = "unit-only-pepper-abcdefghijklmnopqrstuvwxyz"; state.operation = operation(); state.calls = [];
    state.readSettings.mockResolvedValue({ humanResourcesEnabled: true });
    state.abortSignal.mockImplementation((name: string, args: Record<string, unknown>, signal: AbortSignal) => state.rpcResponse(name, args, signal));
    state.rpc.mockImplementation((name: string, args: Record<string, unknown>) => {
      state.calls.push(name); return { abortSignal: (signal: AbortSignal) => state.abortSignal(name, args, signal) };
    });
    state.rpcResponse.mockImplementation(async (name: string) => ({ data: {
      ...state.operation,
      ...(name === "complete_account_provision" || name === "complete_account_deletion" ? { state: "completed" } : {}),
      ...(name === "cancel_account_provision" ? { state: "cleanup_required" } : {}),
      ...(name === "complete_account_provision_cleanup" ? { state: "cancelled" } : {})
    }, error: null }));
    state.getUserById.mockImplementation(async () => { state.calls.push("auth.get"); return { data: { user: authUser() }, error: null }; });
    state.createUser.mockImplementation(async () => { state.calls.push("auth.create"); return { data: { user: authUser() }, error: null }; });
    state.deleteUser.mockImplementation(async () => { state.calls.push("auth.delete"); return { data: { user: null }, error: null }; });
  });
  afterEach(() => vi.useRealTimers());

  it("prepares a durable request before Auth and returns a redacted completion result", async () => {
    expect(await provisionAccountLifecycle(ids.employee, input(), ids.actor)).toEqual(result());
    expect(state.calls).toEqual(["prepare_account_provision", "auth.get", "complete_account_provision"]);
    expect(state.rpc).toHaveBeenCalledWith("prepare_account_provision", {
      p_request_id: ids.request, p_actor_id: ids.actor, p_employee_id: ids.employee, p_username: "unit_employee",
      p_primary_email: "unit@example.invalid", p_phone: "", p_role_ids: [ids.role],
      p_credential_fingerprint: fingerprint(), p_credential_mode: "provided", p_event_date: "2026-10-22"
    });
    expect(state.clientOptions).toHaveBeenCalledWith({ timeoutMs: 10_000 });
    expect(state.abortSignal).toHaveBeenCalledWith("prepare_account_provision", expect.any(Object), expect.any(AbortSignal));
    expect(state.createUser).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("does not put a plaintext supplied password in database RPC arguments", async () => {
    await provisionAccountLifecycle(ids.employee, input(), ids.actor);
    expect(JSON.stringify(state.rpc.mock.calls)).not.toContain(password);
  });
  it.each([
    { status: 404, code: "unknown_error" }, { status: 404 }, { code: "user_not_found", status: 503 }, { status: 500, code: "unexpected_failure" }
  ])("does not treat an unconfirmed Auth lookup error as missing: %j", async (error) => {
    state.getUserById.mockResolvedValue({ data: { user: null }, error });
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.createUser).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalledWith("complete_account_provision", expect.anything());
  });
  it("does not create Auth after a rejected lookup transport", async () => {
    state.getUserById.mockRejectedValue(new Error("private network detail"));
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.createUser).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it.each([null, { ...authUser(), id: ids.otherActor }])("rejects a successful Auth lookup with an absent or mismatched user %j", async (user) => {
    state.getUserById.mockResolvedValue({ data: { user }, error: null });
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.createUser).not.toHaveBeenCalled();
  });
  it("creates only the reserved Auth ID after positive user_not_found and rereads it", async () => {
    state.getUserById.mockResolvedValueOnce(authMissing);
    expect(await provisionAccountLifecycle(ids.employee, input(), ids.actor)).toEqual(result());
    expect(state.createUser).toHaveBeenCalledExactlyOnceWith({
      id: ids.auth, email: "unit@example.invalid", password, email_confirm: true,
      app_metadata: { dtech_operation_id: ids.request }, user_metadata: { display_name: "Unit employee", username: "unit_employee" }
    });
    expect(state.getUserById).toHaveBeenNthCalledWith(1, ids.auth); expect(state.getUserById).toHaveBeenNthCalledWith(2, ids.auth);
    expect(state.calls).toEqual(["prepare_account_provision", "auth.create", "auth.get", "complete_account_provision"]);
  });
  it("recovers a create response lost after Auth commit without deleting or recreating identity", async () => {
    state.getUserById.mockResolvedValueOnce(authMissing);
    state.createUser.mockRejectedValue(new Error("response lost after commit"));
    expect(await provisionAccountLifecycle(ids.employee, input(), ids.actor)).toEqual(result());
    expect(state.createUser).toHaveBeenCalledOnce(); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("recovers a returned ambiguous Auth create error by rereading only the reserved ID", async () => {
    state.getUserById.mockResolvedValueOnce(authMissing);
    state.createUser.mockResolvedValue({ data: { user: null }, error: { status: 503, code: "unexpected_failure" } });
    expect(await provisionAccountLifecycle(ids.employee, input(), ids.actor)).toEqual(result());
    expect(state.getUserById).toHaveBeenLastCalledWith(ids.auth); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("keeps a prepared request if create and its followup lookup still show no identity", async () => {
    state.getUserById.mockResolvedValue(authMissing);
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalledWith("complete_account_provision", expect.anything());
  });
  it.each([
    ["email_exists", "CONFLICT"], ["user_already_exists", "CONFLICT"],
    ["weak_password", "CONFLICT"], ["email_address_invalid", "CONFLICT"], ["validation_failed", "CONFLICT"],
    ["unknown_failure", "NETWORK_ERROR"]
  ])("maps a confirmed absent identity after Auth create %s without deleting its reservation", async (authCode, code) => {
    state.getUserById.mockResolvedValue(authMissing);
    state.createUser.mockResolvedValue({ data: { user: null }, error: { status: 422, code: authCode } });
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code });
    expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalledWith("cancel_account_provision", expect.anything());
    expect(state.rpc).not.toHaveBeenCalledWith("complete_account_provision", expect.anything());
  });
  it("never compensates by deleting Auth after an uncertain database completion", async () => {
    state.rpcResponse.mockImplementation(async (name: string) => {
      if (name === "complete_account_provision") throw new Error("commit response lost");
      return { data: state.operation, error: null };
    });
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.createUser).not.toHaveBeenCalled();
  });
  it("aborts a hung complete RPC while retaining reserved Auth", async () => {
    state.rpcResponse.mockImplementation((name: string, _args: unknown, signal: AbortSignal) => name === "complete_account_provision"
      ? new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))))
      : Promise.resolve({ data: state.operation, error: null }));
    const pending = expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await vi.advanceTimersByTimeAsync(10_000); await pending; expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("repeated fixed requests use the same Auth ID and never reset its password", async () => {
    await provisionAccountLifecycle(ids.employee, input(), ids.actor); await provisionAccountLifecycle(ids.employee, input(), ids.actor);
    expect(state.getUserById.mock.calls).toEqual([[ids.auth], [ids.auth]]); expect(state.createUser).not.toHaveBeenCalled();
    expect(state.rpc.mock.calls.filter(([name]) => name === "prepare_account_provision").map(([, args]) => args.p_credential_fingerprint)).toEqual([fingerprint(), fingerprint()]);
  });
  it("rejects changed credentials before touching an existing Auth identity", async () => {
    await expect(recoverAccountOperation(ids.request, ids.actor, "resume", "OtherUnit!123")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.getUserById).not.toHaveBeenCalled(); expect(state.createUser).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it.each([
    { email: "someone-else@example.invalid" }, { app_metadata: { dtech_operation_id: ids.otherActor } },
    { deleted_at: "2026-10-22T06:00:00.000Z" }, { banned_until: "2026-10-23T06:00:00.000Z" }
  ])("rejects inconsistent reserved Auth identity %j without completing or deleting it", async (change) => {
    state.getUserById.mockResolvedValue({ data: { user: authUser(change) }, error: null });
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.rpc).not.toHaveBeenCalledWith("complete_account_provision", expect.anything()); expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("requires a supplied password to recover a provided credential request", async () => {
    await expect(recoverAccountOperation(ids.request, ids.actor, "resume")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.getUserById).not.toHaveBeenCalled();
  });
  it("returns the deterministic generated password only to its creator during the recovery window", async () => {
    state.operation = operation({ credentialMode: "generated", credentialFingerprint: fingerprint(generatedPassword()), state: "completed" });
    expect(await recoverAccountOperation(ids.request, ids.actor, "resume")).toEqual({ ...result(), temporaryPassword: generatedPassword() });
    expect(state.getUserById).not.toHaveBeenCalled(); expect(state.createUser).not.toHaveBeenCalled();
  });
  it.each([
    ["expired", "2026-10-22T05:49:59.000Z", ids.actor],
    ["future", "2026-10-22T06:06:00.000Z", ids.actor],
    ["different operator", "2026-10-22T06:00:00.000Z", ids.otherActor]
  ])("does not expose the generated password for %s recovery", async (_name, createdAt, who) => {
    state.operation = operation({ credentialMode: "generated", credentialFingerprint: fingerprint(generatedPassword()), state: "completed", createdAt });
    expect(await recoverAccountOperation(ids.request, who, "resume")).toEqual(result());
  });
  it("blocks new provisioning with the HR module disabled before any database or Auth change", async () => {
    state.moduleEnabled = false;
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(state.rpc).not.toHaveBeenCalled(); expect(state.getUserById).not.toHaveBeenCalled();
  });
  it("blocks resuming prepared provisioning with HR disabled while allowing a completed receipt", async () => {
    state.moduleEnabled = false;
    await expect(recoverAccountOperation(ids.request, ids.actor, "resume", password)).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(state.getUserById).not.toHaveBeenCalled(); state.operation = operation({ state: "completed" });
    expect(await recoverAccountOperation(ids.request, ids.actor, "resume", password)).toEqual(result());
  });

  describe("durable deletion and cancellation", () => {
    beforeEach(() => { state.operation = operation({ kind: "delete", state: "cleanup_required", credentialMode: null, credentialFingerprint: null }); });
    it("prepares the access tombstone before deleting Auth and completing cleanup", async () => {
      expect(await deleteAccountLifecycle(ids.account, ids.request, ids.actor)).toEqual(result({ kind: "delete" }));
      expect(state.calls).toEqual(["prepare_account_deletion", "auth.get", "auth.delete", "complete_account_deletion"]);
      expect(state.deleteUser).toHaveBeenCalledExactlyOnceWith(ids.auth);
    });
    it("does not delete Auth when deletion preparation fails", async () => {
      state.rpcResponse.mockResolvedValue({ data: null, error: { message: "LAST_ACTIVE_ADMIN", code: "P0001" } });
      await expect(deleteAccountLifecycle(ids.account, ids.request, ids.actor)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.getUserById).not.toHaveBeenCalled();
    });
    it.each([{ status: 503, code: "unexpected_failure" }, { status: 404, code: "not_user_not_found" }])("retains cleanup after an unconfirmed Auth DELETE error %j", async (error) => {
      state.deleteUser.mockResolvedValue({ data: { user: null }, error });
      await expect(deleteAccountLifecycle(ids.account, ids.request, ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
      expect(state.rpc).not.toHaveBeenCalledWith("complete_account_deletion", expect.anything());
    });
    it("retains cleanup after a rejected Auth DELETE transport", async () => {
      state.deleteUser.mockRejectedValue(new Error("lost delete response"));
      await expect(deleteAccountLifecycle(ids.account, ids.request, ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
      expect(state.rpc).not.toHaveBeenCalledWith("complete_account_deletion", expect.anything());
    });
    it("resumes deletion with positive Auth absence and completes without another delete", async () => {
      state.getUserById.mockResolvedValue(authMissing);
      expect(await recoverAccountOperation(ids.request, ids.actor, "resume")).toEqual(result({ kind: "delete" }));
      expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.rpc).toHaveBeenCalledWith("complete_account_deletion", { p_request_id: ids.request, p_actor_id: ids.actor });
    });
    it("accepts positive user_not_found from an idempotent Auth DELETE retry", async () => {
      state.deleteUser.mockResolvedValue(authMissing);
      expect(await deleteAccountLifecycle(ids.account, ids.request, ids.actor)).toEqual(result({ kind: "delete" }));
    });
    it("deletes and completes cleanup with HR disabled", async () => {
      state.moduleEnabled = false;
      expect(await deleteAccountLifecycle(ids.account, ids.request, ids.actor)).toEqual(result({ kind: "delete" }));
      expect(state.readSettings).not.toHaveBeenCalled();
    });
    it("does not touch Auth again for a completed deletion", async () => {
      state.operation = operation({ kind: "delete", state: "completed" });
      expect(await recoverAccountOperation(ids.request, ids.actor, "resume")).toEqual(result({ kind: "delete" }));
      expect(state.getUserById).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
    });
    it("cannot cancel a deletion after access was revoked", async () => {
      await expect(recoverAccountOperation(ids.request, ids.actor, "cancel")).rejects.toMatchObject({ code: "CONFLICT" });
      expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.rpc).toHaveBeenCalledOnce();
    });
    it("persists provision cancellation intent before deleting its reserved Auth identity", async () => {
      state.operation = operation(); state.moduleEnabled = false;
      expect(await recoverAccountOperation(ids.request, ids.actor, "cancel")).toEqual(result({ state: "cancelled" }));
      expect(state.calls).toEqual(["get_account_lifecycle_operation", "cancel_account_provision", "auth.get", "auth.delete", "complete_account_provision_cleanup"]);
      expect(state.readSettings).not.toHaveBeenCalled();
    });
    it("does not touch Auth if cancellation intent could not be persisted", async () => {
      state.operation = operation(); state.rpcResponse.mockImplementation(async (name: string) => {
        if (name === "cancel_account_provision") throw new Error("lost cancel response");
        return { data: state.operation, error: null };
      });
      await expect(recoverAccountOperation(ids.request, ids.actor, "cancel")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
      expect(state.getUserById).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
    });
    it("never cancels or deletes an already completed provision", async () => {
      state.operation = operation({ state: "completed" });
      await expect(recoverAccountOperation(ids.request, ids.actor, "cancel")).rejects.toMatchObject({ code: "CONFLICT" });
      expect(state.rpc).toHaveBeenCalledOnce(); expect(state.deleteUser).not.toHaveBeenCalled();
    });
    it("rejects a completed receipt unexpectedly returned by cancellation before any Auth call", async () => {
      state.operation = operation(); state.rpcResponse.mockImplementation(async (name: string) => ({ data: { ...state.operation, ...(name === "cancel_account_provision" ? { state: "completed" } : {}) }, error: null }));
      await expect(recoverAccountOperation(ids.request, ids.actor, "cancel")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
      expect(state.getUserById).not.toHaveBeenCalled(); expect(state.deleteUser).not.toHaveBeenCalled();
    });
    it("does not delete a mismatched Auth identity during provision cancellation", async () => {
      state.operation = operation(); state.getUserById.mockResolvedValue({ data: { user: authUser({ app_metadata: {} }) }, error: null });
      await expect(recoverAccountOperation(ids.request, ids.actor, "cancel")).rejects.toMatchObject({ code: "CONFLICT" });
      expect(state.deleteUser).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalledWith("complete_account_provision_cleanup", expect.anything());
    });
    it("returns a cancelled provision without revisiting Auth", async () => {
      state.operation = operation({ state: "cancelled" });
      expect(await recoverAccountOperation(ids.request, ids.actor, "cancel")).toEqual(result({ state: "cancelled" }));
      expect(state.getUserById).not.toHaveBeenCalled(); expect(state.rpc).toHaveBeenCalledOnce();
    });
  });

  it("strips private receipt fields from the pending operation list", async () => {
    state.rpcResponse.mockResolvedValue({ data: [state.operation], error: null });
    expect(await listPendingAccountOperations(ids.actor)).toEqual([{
      requestId: ids.request, kind: "provision", state: "prepared", accountId: ids.account, employeeId: ids.employee,
      username: "unit_employee", credentialMode: "provided", createdAt: "2026-10-22T06:00:00.000Z"
    }]);
  });
  it.each([null, {}, [{ ...operation(), requestId: "invalid" }], [{ ...operation(), state: "completed" }]])("rejects an invalid pending operations list %j", async (data) => {
    state.rpcResponse.mockResolvedValue({ data, error: null });
    await expect(listPendingAccountOperations(ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
  it.each(["requestId", "employeeId"])("rejects a mismatched preparation receipt %s before Auth", async (key) => {
    state.rpcResponse.mockResolvedValue({ data: { ...state.operation, [key]: ids.otherActor }, error: null });
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.getUserById).not.toHaveBeenCalled();
  });
  it.each(["requestId", "accountId", "employeeId", "authUserId"])("rejects a mismatched completion receipt %s without deleting Auth", async (key) => {
    state.rpcResponse.mockImplementation(async (name: string) => ({ data: { ...state.operation, ...(name === "complete_account_provision" ? { state: "completed", [key]: ids.otherActor } : {}) }, error: null }));
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("rejects an invalid request before database work", async () => {
    await expect(provisionAccountLifecycle(ids.employee, input({ requestId: "invalid" }), ids.actor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("fails closed without a configured service client", async () => {
    state.available = false;
    await expect(deleteAccountLifecycle(ids.account, ids.request, ids.actor)).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("does not prepare credentials with a missing server pepper", async () => {
    state.pepper = "short";
    await expect(provisionAccountLifecycle(ids.employee, input(), ids.actor)).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
