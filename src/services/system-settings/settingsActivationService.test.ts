import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configurableNavigationPaths, defaultSystemSettings } from "@/config/systemSettings";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const mocks = vi.hoisted(() => ({ client: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.client }));
vi.mock("./systemSettingsService", () => ({ invalidateSystemSettingsCache: mocks.invalidate }));

import {
  activateSystemSettings,
  activationGroupKeys,
  activationPermissions,
  readSettingsActivationState,
  requireSettingsActivationPermission,
  settingsActivationSchema
} from "./settingsActivationService";
import { SETTINGS_VERSION_MAX } from "./systemSettingsCommands";

const actorId = "c0bb811a-200d-49df-bb8a-151df97826c4";
const requestId = "58e42962-1abb-45a5-81cf-96ed34c4923f";
const user: AuthenticatedUser = {
  id: actorId, username: "admin", displayName: "Quản trị", email: "admin@example.invalid",
  status: "active", permissions: [...activationPermissions]
};
type Row = { group_key: string; value: unknown; version: unknown };
function rows(): Row[] {
  return Object.entries(defaultSystemSettings).map(([group_key, value], index) => ({ group_key, value: structuredClone(value), version: index + 2 }));
}
function payload() {
  return {
    requestId,
    groups: Object.fromEntries(activationGroupKeys.map((group) => [group, structuredClone(defaultSystemSettings[group])])),
    expectedVersions: { branding: 2, organization: 4, localization: 5, modules: 8 }, changeType: "publish" as const
  };
}
function database(data = rows()) {
  const read = vi.fn().mockResolvedValue({ data, error: null });
  const probe = vi.fn().mockResolvedValue({ data: [], error: null });
  const rpc = vi.fn().mockResolvedValue({ data: { requestId, versions: { branding: 3, organization: 5, localization: 6, modules: 9 } }, error: null });
  const settingsQuery = { select: vi.fn().mockReturnThis(), abortSignal: read };
  const receiptQuery = { select: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), abortSignal: probe };
  const raw = {
    from: vi.fn((table: string) => table === "system_settings" ? settingsQuery : receiptQuery),
    rpc: vi.fn().mockReturnValue({ abortSignal: rpc })
  };
  mocks.client.mockReturnValue(raw as unknown as SupabaseClient);
  return { raw, read, probe, rpc, settingsQuery, receiptQuery };
}

beforeEach(() => { vi.clearAllMocks(); mocks.client.mockReturnValue(null); });
afterEach(() => { vi.useRealTimers(); });

describe("settings activation state", () => {
  it("reads settings and their versions in one uncached query", async () => {
    const stored = rows();
    stored[0].value = { ...defaultSystemSettings.branding, systemName: "Tên đã lưu" };
    stored[0].version = 14;
    const { raw, read, settingsQuery, receiptQuery } = database(stored);
    const state = await readSettingsActivationState();
    expect(settingsQuery.select).toHaveBeenCalledExactlyOnceWith("group_key,value,version");
    expect(read).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(raw.from.mock.calls).toEqual([["system_settings"], ["system_settings_commands"]]);
    expect(receiptQuery.select).toHaveBeenCalledWith("request_id");
    expect(receiptQuery.limit).toHaveBeenCalledWith(0);
    expect(state).toMatchObject({ settings: { branding: { systemName: "Tên đã lưu" } }, versions: { branding: 14 }, ready: true });
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("does not share mutable snapshots across reads", async () => {
    const stored = rows(); database(stored);
    const state = await readSettingsActivationState();
    state.settings.branding.systemName = "Changed only in caller";
    state.settings.modules.warehouse = false;
    state.versions.branding = 999;
    const next = await readSettingsActivationState();
    expect(next.settings.branding.systemName).toBe(defaultSystemSettings.branding.systemName);
    expect(next.settings.modules.warehouse).toBe(true);
    expect(next.versions.branding).toBe(2);
    expect(stored[0].value).toEqual(defaultSystemSettings.branding);
  });

  it("normalizes saved navigation/dashboard layouts while keeping their source versions", async () => {
    const stored = rows();
    stored.find((row) => row.group_key === "navigation")!.value = {
      hiddenItems: ["/employees", "/retired"], itemOrder: ["/projects", "/retired", "/projects"],
      defaultLandingPage: "/dashboard", groupsExpanded: false
    };
    stored.find((row) => row.group_key === "dashboard")!.value = {
      presetOrder: ["management", "retired"],
      presets: [{ profile: "management", landingPage: "/dashboard", enabledWidgets: ["quick_actions", "retired", "quick_actions"] }]
    };
    database(stored);
    const state = await readSettingsActivationState();
    expect(state.settings.navigation.itemOrder).toHaveLength(configurableNavigationPaths.length);
    expect(state.settings.navigation.itemOrder[0]).toBe("/projects");
    expect(state.settings.navigation.hiddenItems).toEqual(["/employees"]);
    expect(state.settings.navigation.defaultLandingPage).toBe("/applications");
    expect(state.settings.dashboard.presets.find((preset) => preset.profile === "management")!.enabledWidgets).toEqual(["quick_actions"]);
    expect(state.versions.navigation).toBe(stored.find((row) => row.group_key === "navigation")!.version);
    expect(state.versions.dashboard).toBe(stored.find((row) => row.group_key === "dashboard")!.version);
  });

  it("defaults only absent non-activation groups with version zero and ignores unknown groups", async () => {
    const stored = rows().filter((row) => activationGroupKeys.includes(row.group_key as typeof activationGroupKeys[number]));
    stored.push({ group_key: "future_setting", value: { synthetic: true }, version: 1 });
    database(stored);
    const state = await readSettingsActivationState();
    expect(state.settings.appearance).toEqual(defaultSystemSettings.appearance);
    expect(state.versions.appearance).toBe(0);
    expect(state.settings).not.toHaveProperty("future_setting");
    expect(state.versions).not.toHaveProperty("future_setting");
  });

  it.each(activationGroupKeys)("rejects missing %s rather than activating defaults", async (group) => {
    database(rows().filter((row) => row.group_key !== group));
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 503 });
  });

  it.each([0, -1, 1.5, "2", null, SETTINGS_VERSION_MAX + 2])("rejects invalid stored version %s", async (version) => {
    const stored = rows(); stored[0].version = version; database(stored);
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("allows a maximum persisted version to be read without coercing it into a writable version", async () => {
    const stored = rows(); stored[0].version = SETTINGS_VERSION_MAX + 1; database(stored);
    expect((await readSettingsActivationState()).versions.branding).toBe(SETTINGS_VERSION_MAX + 1);
    expect(settingsActivationSchema.safeParse({ ...payload(), expectedVersions: { ...payload().expectedVersions, branding: SETTINGS_VERSION_MAX + 1 } }).success).toBe(false);
  });

  it("rejects malformed stored group values even for a cosmetic group", async () => {
    const stored = rows(); stored.find((row) => row.group_key === "appearance")!.value = { primaryColor: "synthetic-secret-never-log" }; database(stored);
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    await expect(readSettingsActivationState()).rejects.not.toThrow(/synthetic-secret-never-log/);
  });

  it("rejects ambiguous duplicate recognized groups", async () => {
    const stored = rows(); stored.push({ ...stored[0], version: 99 }); database(stored);
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it.each(["PGRST205", "42P01"])("returns ready:false when the additive receipt table is not installed (%s)", async (code) => {
    const { probe } = database(); probe.mockResolvedValue({ data: null, error: { code } });
    const state = await readSettingsActivationState();
    expect(state.ready).toBe(false);
    expect(state.versions.branding).toBe(2);
  });

  it.each([
    { data: null, error: { code: "42501" } },
    { data: null, error: { code: "UNAVAILABLE", message: "synthetic-secret-never-log" } },
    { data: null, error: null },
    { data: { unexpected: true }, error: null }
  ])("rejects an unconfirmed readiness result %j", async (probeResult) => {
    const { probe } = database(); probe.mockResolvedValue(probeResult);
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it.each([
    { data: null, error: { message: "synthetic-secret-never-log" } },
    { data: null, error: null },
    { data: {}, error: null }
  ])("rejects failed or malformed source query %j", async (response) => {
    const { read, probe } = database(); read.mockResolvedValue(response);
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(probe).not.toHaveBeenCalled();
  });

  it("redacts thrown database errors and clears the read timeout", async () => {
    vi.useFakeTimers();
    const { read } = database(); read.mockRejectedValue(new Error("synthetic-secret-never-log"));
    await expect(readSettingsActivationState()).rejects.not.toThrow(/synthetic-secret-never-log/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fails closed when no service client exists", async () => {
    await expect(readSettingsActivationState()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 503 });
  });
});

describe("activation input and actor", () => {
  it.each(activationPermissions)("requires permission %s before reaching the database", async (permission) => {
    const denied = { ...user, permissions: user.permissions.filter((item) => item !== permission) };
    await expect(activateSystemSettings(denied, payload())).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it("requires an active authenticated actor with a UUID account ID", async () => {
    expect(() => requireSettingsActivationPermission(null)).toThrow();
    await expect(activateSystemSettings(null, payload())).rejects.toMatchObject({ code: "AUTHENTICATION_REQUIRED" });
    await expect(activateSystemSettings({ ...user, status: "disabled" }, payload())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(activateSystemSettings({ ...user, id: "not-an-account-uuid" }, payload())).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it.each([
    ["caller-supplied actor", (value: ReturnType<typeof payload>) => ({ ...value, actorId: actorId })],
    ["unknown group", (value: ReturnType<typeof payload>) => ({ ...value, groups: { ...value.groups, appearance: defaultSystemSettings.appearance } })],
    ["unknown snapshot field", (value: ReturnType<typeof payload>) => ({ ...value, groups: { ...value.groups, branding: { ...defaultSystemSettings.branding, secret: "synthetic-secret-never-log" } } })],
    ["restore from setup", (value: ReturnType<typeof payload>) => ({ ...value, changeType: "restore" })],
    ["invalid request ID", (value: ReturnType<typeof payload>) => ({ ...value, requestId: "invalid" })],
    ["negative version", (value: ReturnType<typeof payload>) => ({ ...value, expectedVersions: { ...value.expectedVersions, modules: -1 } })],
    ["string version", (value: ReturnType<typeof payload>) => ({ ...value, expectedVersions: { ...value.expectedVersions, modules: "8" } })],
    ["missing version", (value: ReturnType<typeof payload>) => ({ ...value, expectedVersions: { branding: 2 } })],
    ["extra version", (value: ReturnType<typeof payload>) => ({ ...value, expectedVersions: { ...value.expectedVersions, appearance: 1 } })]
  ])("rejects %s before querying or invalidating cache", async (_label, mutate) => {
    await expect(activateSystemSettings(user, mutate(payload()))).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });

  it.each(["accounting", "operations", "messaging"])("requires explicit %s activation rather than legacy defaults", async (flag) => {
    const value = payload(); delete (value.groups.modules as unknown as Record<string, unknown>)[flag];
    await expect(activateSystemSettings(user, value)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("defaults changeType to publish, preserves disabled flags and rejects incomplete groups", () => {
    const value = payload(); delete (value as { changeType?: string }).changeType;
    (value.groups.modules as unknown as Record<string, unknown>).warehouse = false;
    expect(settingsActivationSchema.parse(value)).toMatchObject({ changeType: "publish", groups: { modules: { warehouse: false } } });
    delete (value.groups as Record<string, unknown>).organization;
    expect(settingsActivationSchema.safeParse(value).success).toBe(false);
  });
});

describe("activation transaction integration", () => {
  it("binds actor to the authenticated user, issues exactly one RPC, then rereads values/versions", async () => {
    const stored = rows();
    const versions = { branding: 3, organization: 5, localization: 6, modules: 9 };
    for (const row of stored) if (row.group_key in versions) row.version = versions[row.group_key as keyof typeof versions];
    const { raw, read } = database(stored);
    const result = await activateSystemSettings(user, payload());
    expect(raw.rpc).toHaveBeenCalledExactlyOnceWith("publish_system_settings_command", {
      p_actor_id: actorId, p_request_id: requestId, p_groups: payload().groups,
      p_expected_versions: payload().expectedVersions, p_change_type: "publish"
    });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ requestId, ready: true, versions });
    expect(raw.from.mock.calls.map(([table]) => table)).not.toContain("settings_versions");
    expect(raw.from.mock.calls.map(([table]) => table)).not.toContain("audit_logs");
  });

  it.each([
    ["SETTINGS_VERSION_CONFLICT", "CONFLICT"], ["SETTINGS_REQUEST_CONFLICT", "CONFLICT"],
    ["SETTINGS_ACTOR_FORBIDDEN", "PERMISSION_DENIED"], ["SETTINGS_INVALID_INPUT", "VALIDATION_ERROR"]
  ])("propagates %s and invalidates cached settings without reading a false success", async (message, code) => {
    const { rpc, read } = database(); rpc.mockResolvedValue({ data: null, error: { code: "P0001", message } });
    await expect(activateSystemSettings(user, payload())).rejects.toMatchObject({ code });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
  });

  it("invalidates after an uncertain transport result and retains the request identity on retry", async () => {
    const { rpc, raw } = database(); rpc.mockRejectedValueOnce(new Error("synthetic-secret-never-log"));
    const value = payload();
    await expect(activateSystemSettings(user, value)).rejects.not.toThrow(/synthetic-secret-never-log/);
    await activateSystemSettings(user, value);
    expect(mocks.invalidate).toHaveBeenCalledTimes(2);
    expect(raw.rpc.mock.calls[0]).toEqual(raw.rpc.mock.calls[1]);
  });

  it("does not return success for an invalid receipt even after the RPC resolved", async () => {
    const { rpc, read } = database(); rpc.mockResolvedValue({ data: { requestId, versions: { branding: 3 } }, error: null });
    await expect(activateSystemSettings(user, payload())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
  });

  it("does not use the legacy fallback when the activation migration is missing", async () => {
    const { rpc, raw } = database(); rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(activateSystemSettings(user, payload())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(raw.from).not.toHaveBeenCalled();
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it("reports an unavailable reread after commit without issuing a second write", async () => {
    const { raw, read } = database(); read.mockResolvedValue({ data: null, error: { code: "UNAVAILABLE" } });
    await expect(activateSystemSettings(user, payload())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(raw.rpc).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });

  it("does not invalidate before any command is attempted when client is unavailable", async () => {
    await expect(activateSystemSettings(user, payload())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
