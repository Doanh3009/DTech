import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSystemSettings } from "@/config/systemSettings";

const mocks = vi.hoisted(() => ({ client: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog: mocks.audit }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { listSettingsVersions, publishSettingsGroup, readSettingsGroup, resetLocalSystemSettingsForTests, restoreSettingsVersion } from "./systemSettingsService";
import { SETTINGS_VERSION_MAX } from "./systemSettingsCommands";

const actorId = "8e5e98f9-5e75-47ab-8560-2c7759eb8558";
const value = () => ({ ...defaultSystemSettings.branding, systemName: "Thương hiệu mới" });

function database() {
  const read = vi.fn().mockResolvedValue({
    data: Object.entries(defaultSystemSettings).map(([group_key, stored]) => ({ group_key, value: structuredClone(stored), version: 4 })),
    error: null
  });
  const version = vi.fn().mockResolvedValue({ data: { version: 4 }, error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const history = vi.fn().mockResolvedValue({ data: [], error: null });
  const probe = vi.fn().mockResolvedValue({ data: [], error: null });
  const command = vi.fn().mockImplementation(async (params: { p_request_id: string; p_expected_versions: Record<string, number> }) => ({
    data: { requestId: params.p_request_id, versions: Object.fromEntries(Object.entries(params.p_expected_versions).map(([key, expected]) => [key, expected + 1])) },
    error: null
  }));
  const raw = {
    rpc: vi.fn((_name: string, params: { p_request_id: string; p_expected_versions: Record<string, number> }) => ({ abortSignal: () => command(params) })),
    from: vi.fn((table: string) => table === "system_settings" ? {
      select: (columns: string) => columns === "version" ? { eq: () => ({ maybeSingle: version }) } : { abortSignal: read },
      upsert
    } : table === "system_settings_commands" ? {
      select: () => ({ limit: () => ({ abortSignal: probe }) })
    } : { insert, select: () => ({ order: () => ({ limit: history }) }) })
  };
  mocks.client.mockReturnValue(raw);
  return { raw, read, version, upsert, insert, probe, command, history };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLocalSystemSettingsForTests();
  mocks.client.mockReturnValue(null);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("single-group atomic settings publishing", () => {
  it("uses one CAS command without separate settings, history or audit writes", async () => {
    const { raw, upsert, insert, probe } = database();
    const result = await publishSettingsGroup({ group: "branding", value: value(), actorId });
    expect(result).toEqual({ value: value(), version: 5 });
    expect(raw.rpc).toHaveBeenCalledExactlyOnceWith("publish_system_settings_command", {
      p_actor_id: actorId, p_request_id: expect.any(String), p_groups: { branding: value() },
      p_expected_versions: { branding: 4 }, p_change_type: "publish"
    });
    expect((await readSettingsGroup("branding")).systemName).toBe(value().systemName);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(raw.from.mock.calls.map(([table]) => table)).not.toContain("settings_versions");
  });

  it("uses the same atomic command for restore", async () => {
    const { raw, upsert, insert } = database();
    await publishSettingsGroup({ group: "branding", value: value(), actorId, changeType: "restore" });
    expect(raw.rpc).toHaveBeenCalledWith("publish_system_settings_command", expect.objectContaining({ p_change_type: "restore" }));
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("uses zero as expected version only when the group does not exist", async () => {
    const { raw, version } = database();
    version.mockResolvedValue({ data: null, error: null });
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).resolves.toMatchObject({ version: 1 });
    expect(raw.rpc).toHaveBeenCalledWith("publish_system_settings_command", expect.objectContaining({ p_expected_versions: { branding: 0 } }));
  });

  it("rejects invalid input before reading or writing the database", async () => {
    const { raw } = database();
    await expect(publishSettingsGroup({ group: "branding", value: { ...value(), unknown: true }, actorId })).rejects.toThrow();
    expect(raw.from).not.toHaveBeenCalled();
    expect(raw.rpc).not.toHaveBeenCalled();
  });

  it("does not issue any command after an unconfirmed version lookup", async () => {
    const { raw, version, upsert, insert } = database();
    version.mockResolvedValue({ data: null, error: { code: "UNAVAILABLE" } });
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(raw.rpc).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each([undefined, null, "4", 0, -1, 1.5, SETTINGS_VERSION_MAX + 1, Number.NaN])("rejects an invalid or exhausted stored version %s before any write", async (storedVersion) => {
    const { raw, version, upsert, insert } = database();
    version.mockResolvedValue({ data: { version: storedVersion }, error: null });
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(raw.rpc).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each([
    ["SETTINGS_VERSION_CONFLICT", "CONFLICT"],
    ["SETTINGS_REQUEST_CONFLICT", "CONFLICT"],
    ["SETTINGS_ACTOR_FORBIDDEN", "PERMISSION_DENIED"],
    ["SETTINGS_INVALID_INPUT", "VALIDATION_ERROR"],
    ["unconfirmed", "NETWORK_ERROR"]
  ])("propagates %s without split writes and invalidates its earlier snapshot", async (message, code) => {
    const { command, read, upsert, insert } = database();
    command.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).rejects.toMatchObject({ code });
    expect((await readSettingsGroup("branding")).systemName).toBe(defaultSystemSettings.branding.systemName);
    expect(read).toHaveBeenCalledTimes(2);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("never falls back after transport failure or exposes diagnostic text", async () => {
    const { command, probe, upsert, insert } = database();
    command.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).rejects.not.toThrow(/synthetic-secret-never-log/);
    expect(probe).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects a receipt that cannot confirm this exact command", async () => {
    const { command, upsert, insert, read } = database();
    command.mockResolvedValue({ data: { requestId: "b8eb3640-3c74-488e-8299-8673c860d472", versions: { branding: 5 } }, error: null });
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await readSettingsGroup("branding");
    expect(read).toHaveBeenCalledTimes(2);
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each(["PGRST205", "42P01"])("keeps legacy compatibility only after both RPC and command table are confirmed missing (%s)", async (code) => {
    const { command, probe, upsert, insert } = database();
    command.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    probe.mockResolvedValue({ data: null, error: { code } });
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).resolves.toMatchObject({ version: 5 });
    expect(upsert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ group_key: "branding", value: value(), version: 5, updated_by: actorId }));
    expect(insert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ group_key: "branding", snapshot: value(), version: 5, change_type: "publish", created_by: actorId }));
    expect(mocks.audit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ actorId, action: "system_settings.publish", metadata: { version: 5 } }));
  });

  it.each([
    { data: [], error: null },
    { data: null, error: null },
    { data: null, error: { code: "42501" } },
    { data: null, error: { code: "UNAVAILABLE" } }
  ])("never falls back when rollout readiness is unconfirmed or already migrated: %j", async (response) => {
    const { command, probe, upsert, insert } = database();
    command.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    probe.mockResolvedValue(response);
    await expect(publishSettingsGroup({ group: "branding", value: value(), actorId })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("persisted settings version history", () => {
  it.each([
    { data: null, error: { code: "UNAVAILABLE" } },
    { data: null, error: null }
  ])("never substitutes process-local history for an unconfirmed database history: %j", async (response) => {
    const { history, raw } = database();
    await publishSettingsGroup({ group: "branding", value: value(), actorId });
    history.mockResolvedValue(response);
    await expect(listSettingsVersions()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(restoreSettingsVersion("7ecec061-cf01-4c6b-ae4c-64e8cacb886d", actorId)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(raw.rpc).toHaveBeenCalledOnce();
  });

  it("preserves an authoritative empty history rather than showing local entries", async () => {
    database();
    await publishSettingsGroup({ group: "branding", value: value(), actorId });
    await expect(listSettingsVersions()).resolves.toEqual([]);
  });

  it("rejects missing production credentials instead of exposing process-local history", async () => {
    database();
    await publishSettingsGroup({ group: "branding", value: value(), actorId });
    mocks.client.mockReturnValue(null);
    vi.stubEnv("NODE_ENV", "production");
    await expect(listSettingsVersions()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("continues to support local development history", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await publishSettingsGroup({ group: "branding", value: value(), actorId });
    await expect(listSettingsVersions()).resolves.toEqual([expect.objectContaining({ group: "branding", version: 2, snapshot: value() })]);
  });
});
