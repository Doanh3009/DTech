import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSystemSettings } from "@/config/systemSettings";
import { AppError } from "@/lib/api/errors";
import {
  executeSettingsCommand,
  isSettingsCommandTableMissing,
  SETTINGS_VERSION_MAX,
  settingsCommandError,
  settingsVersionSchema,
  type SettingsCommandInput
} from "./systemSettingsCommands";

const actorId = "11df2f7d-e7db-47c8-95de-d6c5eb73be23";
const requestId = "13c07806-2e9a-4641-9ca7-7cb008b8cb54";
const input = (): SettingsCommandInput => ({
  actorId, requestId,
  groups: { branding: { ...defaultSystemSettings.branding, systemName: "Doanh nghiệp thử nghiệm" } },
  expectedVersions: { branding: 7 }, changeType: "publish"
});

function database(response: unknown = { data: { requestId, versions: { branding: 8 } }, error: null }) {
  const rpcSignal = vi.fn().mockResolvedValue(response);
  const probeSignal = vi.fn().mockResolvedValue({ data: [], error: null });
  const probe = { select: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), abortSignal: probeSignal };
  const raw = { rpc: vi.fn().mockReturnValue({ abortSignal: rpcSignal }), from: vi.fn().mockReturnValue(probe) };
  return { client: raw as unknown as SupabaseClient, raw, probe, rpcSignal, probeSignal };
}

afterEach(() => { vi.useRealTimers(); });

describe("atomic settings command", () => {
  it("sends exactly one RPC with fixed actor, request ID, versions and change type", async () => {
    const { client, raw, rpcSignal } = database();
    const command = input(); const before = structuredClone(command);
    await expect(executeSettingsCommand(client, command)).resolves.toEqual({ requestId, versions: { branding: 8 } });
    expect(raw.rpc).toHaveBeenCalledExactlyOnceWith("publish_system_settings_command", {
      p_actor_id: actorId, p_request_id: requestId,
      p_groups: command.groups, p_expected_versions: { branding: 7 }, p_change_type: "publish"
    });
    expect(rpcSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(raw.from).not.toHaveBeenCalled();
    expect(command).toEqual(before);
  });

  it("passes restore without inventing a separate write path", async () => {
    const { client, raw } = database();
    await executeSettingsCommand(client, { ...input(), changeType: "restore" });
    expect(raw.rpc).toHaveBeenCalledWith("publish_system_settings_command", expect.objectContaining({ p_change_type: "restore" }));
    expect(raw.from).not.toHaveBeenCalled();
  });

  it("keeps identical request identity and body on a retry", async () => {
    const { client, raw, rpcSignal } = database();
    rpcSignal.mockRejectedValueOnce(new Error("unconfirmed transport"));
    const command = input();
    await expect(executeSettingsCommand(client, command)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(executeSettingsCommand(client, command)).resolves.toEqual({ requestId, versions: { branding: 8 } });
    expect(raw.rpc.mock.calls[0]).toEqual(raw.rpc.mock.calls[1]);
  });

  it.each([
    ["SETTINGS_VERSION_CONFLICT", "CONFLICT", 409],
    ["SETTINGS_REQUEST_CONFLICT", "CONFLICT", 409],
    ["SETTINGS_ACTOR_FORBIDDEN", "PERMISSION_DENIED", 403],
    ["SETTINGS_INVALID_INPUT", "VALIDATION_ERROR", 400],
    ["synthetic-secret-never-log", "NETWORK_ERROR", 503]
  ])("maps %s without falling back to split writes", async (message, code, status) => {
    const { client, raw } = database({ data: null, error: { code: "P0001", message } });
    await expect(executeSettingsCommand(client, input(), true)).rejects.toMatchObject({ code, status });
    expect(raw.from).not.toHaveBeenCalled();
    expect(settingsCommandError({ message }).message).not.toContain("synthetic-secret-never-log");
  });

  it.each([
    null,
    { requestId: "invalid", versions: { branding: 8 } },
    { requestId: "9f5d4502-96f3-4f86-bc9d-a7fed74657e1", versions: { branding: 8 } },
    { requestId, versions: {} },
    { requestId, versions: { organization: 8 } },
    { requestId, versions: { branding: 8, organization: 3 } },
    { requestId, versions: { branding: 7 } },
    { requestId, versions: { branding: 9 } },
    { requestId, versions: { branding: "8" } },
    { requestId, versions: { branding: -1 } },
    { requestId, versions: { branding: 8.5 } },
    { requestId, versions: { branding: SETTINGS_VERSION_MAX + 2 } },
    { requestId, versions: { branding: 8 }, unexpected: "synthetic-secret-never-log" }
  ])("does not accept an unconfirmed receipt %j", async (data) => {
    const { client, raw } = database({ data, error: null });
    await expect(executeSettingsCommand(client, input(), true)).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 503 });
    expect(raw.from).not.toHaveBeenCalled();
  });

  it("requires an exact receipt for every group even if key order differs", async () => {
    const { client } = database({ data: { requestId, versions: { modules: 3, branding: 8 } }, error: null });
    const command = input();
    command.groups.modules = structuredClone(defaultSystemSettings.modules);
    command.expectedVersions.modules = 2;
    await expect(executeSettingsCommand(client, command)).resolves.toEqual({ requestId, versions: { modules: 3, branding: 8 } });
  });

  it("accepts version one for a newly created group and the largest supported receipt version", async () => {
    const { client, rpcSignal } = database({ data: { requestId, versions: { branding: 1 } }, error: null });
    await expect(executeSettingsCommand(client, { ...input(), expectedVersions: { branding: 0 } })).resolves.toMatchObject({ versions: { branding: 1 } });
    rpcSignal.mockResolvedValue({ data: { requestId, versions: { branding: SETTINGS_VERSION_MAX + 1 } }, error: null });
    await expect(executeSettingsCommand(client, { ...input(), expectedVersions: { branding: SETTINGS_VERSION_MAX } })).resolves.toMatchObject({ versions: { branding: SETTINGS_VERSION_MAX + 1 } });
  });

  it("redacts transport diagnostics and clears its timeout on rejection", async () => {
    vi.useFakeTimers();
    const { client, rpcSignal } = database();
    rpcSignal.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(executeSettingsCommand(client, input())).rejects.not.toThrow(/synthetic-secret-never-log/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves a deliberate AppError and clears its timeout on success", async () => {
    vi.useFakeTimers();
    const { client, rpcSignal } = database();
    const error = new AppError("CONFLICT");
    rpcSignal.mockRejectedValueOnce(error);
    await expect(executeSettingsCommand(client, input())).rejects.toBe(error);
    await executeSettingsCommand(client, input());
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("unmigrated settings fallback", () => {
  it.each(["PGRST205", "42P01"])("returns null only when both command and table are missing (%s)", async (code) => {
    const { client, raw, probeSignal } = database({ data: null, error: { code: "PGRST202" } });
    probeSignal.mockResolvedValue({ data: null, error: { code } });
    await expect(executeSettingsCommand(client, input(), true)).resolves.toBeNull();
    expect(raw.from).toHaveBeenCalledExactlyOnceWith("system_settings_commands");
  });

  it("never falls back when callers require the command", async () => {
    const { client, raw, probeSignal } = database({ data: null, error: { code: "PGRST202" } });
    probeSignal.mockResolvedValue({ data: null, error: { code: "PGRST205" } });
    await expect(executeSettingsCommand(client, input())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(raw.from).not.toHaveBeenCalled();
  });

  it.each([
    { data: [], error: null },
    { data: null, error: { code: "42501", message: "permission denied" } },
    { data: null, error: { code: "NETWORK_ERROR" } },
    { data: null, error: null }
  ])("treats a migrated table or unconfirmed probe as a broken rollout: %j", async (probe) => {
    const { client, probeSignal } = database({ data: null, error: { code: "PGRST202" } });
    probeSignal.mockResolvedValue(probe);
    await expect(executeSettingsCommand(client, input(), true)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("does not turn a failed schema probe into a legacy write", async () => {
    const { client, probeSignal } = database({ data: null, error: { code: "PGRST202" } });
    probeSignal.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(executeSettingsCommand(client, input(), true)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it.each(["42501", "PGRST203", "PGRST204", "P0001"])("does not probe or fall back for RPC error code %s", async (code) => {
    const { client, raw } = database({ data: null, error: { code, message: "synthetic-secret-never-log" } });
    await expect(executeSettingsCommand(client, input(), true)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(raw.from).not.toHaveBeenCalled();
  });
});

describe("settings command primitives", () => {
  it.each([0, 1, SETTINGS_VERSION_MAX])("accepts expected version %s", (value) => {
    expect(settingsVersionSchema.safeParse(value).success).toBe(true);
  });
  it.each([-1, 1.5, "1", null, SETTINGS_VERSION_MAX + 1, Number.NaN])("rejects expected version %s", (value) => {
    expect(settingsVersionSchema.safeParse(value).success).toBe(false);
  });
  it.each([null, { code: "42501" }, { code: "PGRST202" }, {}])("does not infer a missing table from %j", (error) => {
    expect(isSettingsCommandTableMissing(error)).toBe(false);
  });
});
