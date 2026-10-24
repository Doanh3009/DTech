// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/time/timezone", () => ({ getBusinessDateKey: () => "2026-10-22" }));

import { executeArchiveEmployeeCommand, executeEmployeeSensitiveCommand } from "./employeeAuxiliaryCommands";

const id = "11111111-1111-4111-8111-111111111111";
const actor = "22222222-2222-4222-8222-222222222222";
const input = { rowVersion: 4, reason: "Đối chiếu hồ sơ", bankName: "Ngân hàng" };
const rpc = vi.fn();
const abortSignal = vi.fn();
const client = { rpc } as unknown as SupabaseClient;

beforeEach(() => { vi.clearAllMocks(); rpc.mockReturnValue({ abortSignal }); abortSignal.mockResolvedValue({ data: 5, error: null }); });
afterEach(() => { vi.useRealTimers(); });

describe("employee auxiliary database adapters", () => {
  it("sends only changed sensitive fields and the original employee version", async () => {
    expect(await executeEmployeeSensitiveCommand(client, id, { ...input, bankName: null }, actor)).toBe(5);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("patch_employee_sensitive_command", {
      p_employee_id: id, p_expected_row_version: 4, p_patch: { bank_name: null },
      p_actor_id: actor, p_event_date: "2026-10-22", p_reason: "Đối chiếu hồ sơ"
    });
    expect(abortSignal.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it("sends archive through one command", async () => {
    expect(await executeArchiveEmployeeCommand(client, id, { rowVersion: 4, reason: "Lưu hồ sơ" }, actor)).toBe(5);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("archive_employee_command", {
      p_employee_id: id, p_expected_row_version: 4, p_actor_id: actor,
      p_event_date: "2026-10-22", p_reason: "Lưu hồ sơ"
    });
  });

  it.each([
    ["EMPLOYEE_NOT_FOUND", "NOT_FOUND"], ["EMPLOYEE_ACTOR_FORBIDDEN", "PERMISSION_DENIED"],
    ["EMPLOYEE_VERSION_CONFLICT", "CONFLICT"], ["EMPLOYEE_ALREADY_ARCHIVED", "CONFLICT"],
    ["LAST_ACTIVE_ADMIN", "CONFLICT"], ["EMPLOYEE_INVALID_PATCH", "VALIDATION_ERROR"],
    ["EMPLOYEE_INVALID_DATES", "VALIDATION_ERROR"]
  ])("maps %s and never retries or falls back to direct writes", async (message, code) => {
    abortSignal.mockResolvedValue({ data: null, error: { message } });
    await expect(executeEmployeeSensitiveCommand(client, id, input, actor)).rejects.toMatchObject({ code });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("maps a duplicate national identity without leaking its database details", async () => {
    abortSignal.mockResolvedValue({ data: null, error: { code: "23505", message: "sensitive duplicate detail" } });
    await expect(executeEmployeeSensitiveCommand(client, id, input, actor)).rejects.toMatchObject({ code: "CONFLICT", message: "Mã hoặc thông tin định danh đã tồn tại." });
  });

  it.each([null, "5", 4, 6, {}, [5]])("rejects an invalid command receipt %j as an uncertain outcome", async (data) => {
    abortSignal.mockResolvedValue({ data, error: null });
    await expect(executeEmployeeSensitiveCommand(client, id, input, actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("keeps a missing migration unavailable without legacy fallback", async () => {
    abortSignal.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Not installed" } });
    await expect(executeArchiveEmployeeCommand(client, id, { rowVersion: 4, reason: "Lưu hồ sơ" }, actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("maps a transport exception to an uncertain outcome", async () => {
    abortSignal.mockRejectedValue(new Error("Network unavailable"));
    await expect(executeEmployeeSensitiveCommand(client, id, input, actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("aborts a stalled database call after ten seconds", async () => {
    vi.useFakeTimers();
    abortSignal.mockImplementation((signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    }));
    const assertion = expect(executeEmployeeSensitiveCommand(client, id, input, actor)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(abortSignal.mock.calls[0][0].aborted).toBe(true);
  });

  it("rejects malformed callers before invoking the RPC", async () => {
    await expect(executeEmployeeSensitiveCommand(client, id, { ...input, rowVersion: 0 }, actor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(executeArchiveEmployeeCommand(client, id, { rowVersion: 4, reason: "" }, actor)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
