import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PatchEmployeeInput } from "@/features/employees/schemas/employeeSchemas";

const state = vi.hoisted(() => ({ available: true, client: { rpc: vi.fn(), from: vi.fn() }, response: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: () => state.available ? state.client : null }));
vi.mock("@/features/employees/services/employeeService", () => ({ normalizePhone: (value: string) => value.replace(/\s/g, "") }));
import { patchEmployee, replaceAccountRoles, setAccountStatus } from "./employeeMutationService";

describe("atomic employee profile command adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.available = true;
    state.response.mockResolvedValue({ data: 4, error: null });
    state.client.rpc.mockReturnValue({ abortSignal: state.response });
  });
  afterEach(() => vi.useRealTimers());

  it("sends mapped profile fields through exactly one RPC without direct writes", async () => {
    expect(await patchEmployee("employee", { rowVersion: 3, dateOfBirth: "1990-01-02", gender: "male", permanentAddress: " Địa chỉ thường trú ", maritalStatus: "Độc thân" }, "actor")).toBe(4);
    expect(state.client.rpc).toHaveBeenCalledExactlyOnceWith("patch_employee_profile_command", expect.objectContaining({
      p_employee_id: "employee", p_expected_row_version: 3, p_actor_id: "actor",
      p_patch: { date_of_birth: "1990-01-02", gender: "male", permanent_address: "Địa chỉ thường trú", marital_status: "Độc thân" }
    }));
    expect(state.client.from).not.toHaveBeenCalled();
    expect(state.response).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("preserves omitted fields and explicitly clears nullable fields", async () => {
    await patchEmployee("employee", { rowVersion: 3, fullName: "Tên được cập nhật", companyEmail: null, managerEmployeeId: null, personalPhone: null, dateOfBirth: null }, "actor");
    expect(state.client.rpc.mock.calls[0][1].p_patch).toEqual({ full_name: "Tên được cập nhật", company_email: null, manager_employee_id: null, personal_phone: null, normalized_phone: null, date_of_birth: null });
  });

  it("sends both phone and derived normalized phone", async () => {
    await patchEmployee("employee", { rowVersion: 3, personalPhone: "090 123 4567" }, "actor");
    expect(state.client.rpc.mock.calls[0][1].p_patch).toEqual({ personal_phone: "090 123 4567", normalized_phone: "0901234567" });
  });

  it("includes offboarding details but leaves account, archive and history effects to SQL", async () => {
    await patchEmployee("employee", { rowVersion: 3, employmentStatus: "terminated", terminationDate: "2026-10-22", terminationReason: "Hết hợp đồng" }, "actor");
    expect(state.client.rpc.mock.calls[0][1]).toEqual({ p_employee_id: "employee", p_expected_row_version: 3, p_actor_id: "actor", p_event_date: "2026-10-22", p_reason: "Hết hợp đồng", p_patch: { employment_status: "terminated", termination_date: "2026-10-22", termination_reason: "Hết hợp đồng" } });
    expect(state.client.from).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 0, -1, 1.5, 2_147_483_647, "3"])("rejects invalid CAS baseline %s before invoking SQL", async (rowVersion) => {
    await expect(patchEmployee("employee", { rowVersion, fullName: "Tên" } as PatchEmployeeInput, "actor")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a patch containing no profile changes", async () => {
    await expect(patchEmployee("employee", { rowVersion: 3, reason: "Không có thay đổi" }, "actor")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["EMPLOYEE_NOT_FOUND", "NOT_FOUND"], ["EMPLOYEE_VERSION_CONFLICT", "CONFLICT"], ["LAST_ACTIVE_ADMIN", "CONFLICT"],
    ["EMPLOYEE_REHIRE_REQUIRED", "CONFLICT"], ["EMPLOYEE_ACTOR_FORBIDDEN", "PERMISSION_DENIED"],
    ["EMPLOYEE_INVALID_PATCH", "VALIDATION_ERROR"], ["EMPLOYEE_INVALID_DATES", "VALIDATION_ERROR"], ["EMPLOYEE_OFFBOARD_DETAILS_REQUIRED", "VALIDATION_ERROR"]
  ])("maps %s to %s without a legacy fallback", async (message, code) => {
    state.response.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    await expect(patchEmployee("employee", { rowVersion: 3, fullName: "Tên" }, "actor")).rejects.toMatchObject({ code });
    expect(state.client.rpc).toHaveBeenCalledOnce();
    expect(state.client.from).not.toHaveBeenCalled();
  });

  it.each([
    ["23505", "CONFLICT"], ["23503", "VALIDATION_ERROR"], ["23514", "VALIDATION_ERROR"], ["23502", "VALIDATION_ERROR"],
    ["22007", "VALIDATION_ERROR"], ["PGRST202", "NETWORK_ERROR"], ["08006", "NETWORK_ERROR"], ["40P01", "NETWORK_ERROR"], ["P0001", "NETWORK_ERROR"]
  ])("maps database error %s to %s", async (databaseCode, code) => {
    state.response.mockResolvedValue({ data: null, error: { code: databaseCode, message: "server detail is private" } });
    await expect(patchEmployee("employee", { rowVersion: 3, fullName: "Tên" }, "actor")).rejects.toMatchObject({ code });
  });

  it.each([null, undefined, "4", 3, 5, 4.5, { rowVersion: 4 }])("does not acknowledge an invalid database receipt %s", async (data) => {
    state.response.mockResolvedValue({ data, error: null });
    await expect(patchEmployee("employee", { rowVersion: 3, fullName: "Tên" }, "actor")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.client.from).not.toHaveBeenCalled();
  });

  it("turns rejected transport into an uncertain outcome without retrying", async () => {
    state.response.mockRejectedValue(new Error("private network detail"));
    await expect(patchEmployee("employee", { rowVersion: 3, fullName: "Tên" }, "actor")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(state.client.rpc).toHaveBeenCalledOnce();
  });

  it("aborts a hung request after ten seconds and asks for reload", async () => {
    vi.useFakeTimers();
    state.response.mockImplementation((signal: AbortSignal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const pending = expect(patchEmployee("employee", { rowVersion: 3, fullName: "Tên" }, "actor")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
  });

  it("fails closed when the service client is unavailable", async () => {
    state.available = false;
    await expect(patchEmployee("employee", { rowVersion: 3, fullName: "Tên" }, "actor")).rejects.toMatchObject({ code: "SERVER_ERROR" });
    expect(state.client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["LAST_ACTIVE_ADMIN", "CONFLICT"], ["ACCOUNT_EMPLOYEE_INACTIVE", "CONFLICT"],
    ["ACCOUNT_ACTOR_FORBIDDEN", "PERMISSION_DENIED"], ["ACCOUNT_NOT_FOUND", "NOT_FOUND"],
    ["INVALID_STATUS", "VALIDATION_ERROR"], ["ROLE_REQUIRED", "VALIDATION_ERROR"],
    ["ROLE_NOT_FOUND", "VALIDATION_ERROR"], ["private detail", "NETWORK_ERROR"]
  ])("maps account lifecycle %s consistently for status and roles", async (message, code) => {
    state.client.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    await expect(setAccountStatus("account", { status: "active" }, "actor")).rejects.toMatchObject({ code });
    await expect(replaceAccountRoles("account", { roleIds: ["role"] }, "actor")).rejects.toMatchObject({ code });
    expect(state.client.from).not.toHaveBeenCalled();
  });
});
