import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseServiceClient, recordAuditLog } = vi.hoisted(() => ({
  getSupabaseServiceClient: vi.fn(),
  recordAuditLog: vi.fn()
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));
vi.mock("@/services/audit/auditLog", () => ({ recordAuditLog }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));

import { defaultSystemSettings } from "@/config/systemSettings";
import {
  publishSettingsGroup,
  readPresentationSettings,
  readSettingsGroup,
  readSystemSettings,
  resetLocalSystemSettingsForTests
} from "./systemSettingsService";

type ReadResponse = { data: Array<{ group_key: string; value: unknown }> | null; error: unknown };
const rows = (name = "Kiểm thử", warehouse = false): ReadResponse => ({
  data: [
    { group_key: "branding", value: { ...defaultSystemSettings.branding, systemName: name } },
    { group_key: "modules", value: { ...defaultSystemSettings.modules, warehouse } }
  ],
  error: null
});

function mockDatabase(read = vi.fn().mockResolvedValue(rows())) {
  const version = vi.fn().mockResolvedValue({ data: { version: 1 }, error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  getSupabaseServiceClient.mockReturnValue({
    rpc: () => ({ abortSignal: async () => ({ data: null, error: { code: "PGRST202" } }) }),
    from: (table: string) => table === "system_settings_commands"
      ? { select: () => ({ limit: () => ({ abortSignal: async () => ({ data: null, error: { code: "PGRST205" } }) }) }) }
      : table === "system_settings" ? {
      select: (columns: string) => columns === "version"
        ? { eq: () => ({ maybeSingle: version }) }
        : { abortSignal: read },
      upsert
    } : { insert }
  });
  return { read, version, upsert, insert };
}

describe("system settings verified cache", () => {
  let now: number;
  beforeEach(() => {
    resetLocalSystemSettingsForTests();
    getSupabaseServiceClient.mockReset();
    recordAuditLog.mockReset();
    now = 100_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("shares a verified read across requests without sharing mutable state", async () => {
    const { read } = mockDatabase();
    const first = await readSystemSettings();
    first.branding.systemName = "Changed locally";
    first.modules.warehouse = true;
    expect((await readSystemSettings()).branding.systemName).toBe("Kiểm thử");
    expect((await readSettingsGroup("modules")).warehouse).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("coalesces simultaneous cold reads", async () => {
    let finish!: (value: ReadResponse) => void;
    const { read } = mockDatabase(vi.fn(() => new Promise<ReadResponse>((resolve) => { finish = resolve; })));
    const first = readSystemSettings();
    const second = readSettingsGroup("modules");
    finish(rows());
    expect((await first).modules.warehouse).toBe(false);
    expect((await second).warehouse).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("rejects cold database failures and throttles retries without caching enabled defaults", async () => {
    const { read } = mockDatabase(vi.fn().mockResolvedValue({ data: null, error: { code: "UNAVAILABLE" } }));
    await expect(readSystemSettings()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 503 });
    await expect(readSettingsGroup("modules")).rejects.toMatchObject({ status: 503 });
    const fallback = await readPresentationSettings();
    expect(fallback.branding.systemName).toBe(defaultSystemSettings.branding.systemName);
    expect(Object.entries(fallback.modules).filter(([key]) => key !== "industryPreset").every(([, enabled]) => enabled === false)).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("recovers from failure on the next retry instead of persisting fallback state", async () => {
    const { read } = mockDatabase(vi.fn()
      .mockResolvedValueOnce({ data: null, error: new Error("offline") })
      .mockResolvedValueOnce(rows("Đã khôi phục")));
    await readPresentationSettings();
    now += 1_001;
    expect((await readSystemSettings()).branding.systemName).toBe("Đã khôi phục");
    expect((await readSettingsGroup("modules")).warehouse).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["missing", []],
    ["malformed", [{ group_key: "modules", value: { warehouse: true } }]],
    ["unknown flags", [{ group_key: "modules", value: { ...defaultSystemSettings.modules, new_module: true } }]]
  ])("rejects %s activation rather than filling it from defaults", async (_name, data) => {
    mockDatabase(vi.fn().mockResolvedValue({ data, error: null }));
    await expect(readSettingsGroup("modules")).rejects.toMatchObject({ status: 503 });
    expect((await readPresentationSettings()).modules.human_resources).toBe(false);
  });

  it("preserves explicit disabled flags in compatible older configurations", async () => {
    const legacy = { ...defaultSystemSettings.modules };
    delete legacy.accounting;
    delete legacy.operations;
    delete legacy.messaging;
    legacy.warehouse = false;
    mockDatabase(vi.fn().mockResolvedValue({ data: [{ group_key: "modules", value: legacy }], error: null }));
    expect((await readSettingsGroup("modules")).warehouse).toBe(false);
    expect((await readSettingsGroup("modules")).accounting).toBeUndefined();
  });

  it("waits for verification when the positive cache expires", async () => {
    let finish!: (value: ReadResponse) => void;
    const { read } = mockDatabase(vi.fn()
      .mockResolvedValueOnce(rows("Trước", true))
      .mockImplementationOnce(() => new Promise<ReadResponse>((resolve) => { finish = resolve; })));
    expect((await readSystemSettings()).modules.warehouse).toBe(true);
    now += 30_000;
    const pending = readSystemSettings();
    const settled = vi.fn();
    void pending.then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    finish(rows("Sau", false));
    expect((await pending).modules.warehouse).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("never authorizes from stale settings during an outage but preserves presentation branding", async () => {
    mockDatabase(vi.fn()
      .mockResolvedValueOnce(rows("Doanh nghiệp A", true))
      .mockRejectedValue(new Error("connection refused")));
    await readSystemSettings();
    now += 30_001;
    await expect(readSettingsGroup("modules")).rejects.toMatchObject({ status: 503 });
    const presentation = await readPresentationSettings();
    expect(presentation.branding.systemName).toBe("Doanh nghiệp A");
    expect(presentation.modules.warehouse).toBe(false);
    presentation.branding.systemName = "Mutated";
    expect((await readPresentationSettings()).branding.systemName).toBe("Doanh nghiệp A");
    now += 60_000;
    await expect(readSystemSettings()).rejects.toMatchObject({ status: 503 });
  });

  it("rejects a timed out settings request", async () => {
    vi.useFakeTimers();
    mockDatabase(vi.fn((signal: AbortSignal) => new Promise<ReadResponse>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })));
    const pending = expect(readSystemSettings()).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(2_000);
    await pending;
  });

  it("allows explicit local development settings without a database", async () => {
    getSupabaseServiceClient.mockReturnValue(null);
    vi.stubEnv("NODE_ENV", "development");
    expect((await readSystemSettings()).modules).toEqual(defaultSystemSettings.modules);
  });

  it("does not treat missing production credentials as a local development instance", async () => {
    getSupabaseServiceClient.mockReturnValue(null);
    vi.stubEnv("NODE_ENV", "production");
    await expect(readSystemSettings()).rejects.toMatchObject({ status: 503 });
    expect((await readPresentationSettings()).modules.warehouse).toBe(false);
  });

  it("does not extend module verification by publishing a cosmetic setting", async () => {
    const { read } = mockDatabase(vi.fn()
      .mockResolvedValueOnce(rows("Trước", true))
      .mockResolvedValueOnce(rows("Sau", false)));
    await readSystemSettings();
    now += 29_000;
    await publishSettingsGroup({ group: "appearance", value: defaultSystemSettings.appearance, actorId: "admin" });
    now += 1_001;
    expect((await readSettingsGroup("modules")).warehouse).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("never acknowledges an in-memory publish when production credentials disappear", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockDatabase();
    await readSystemSettings();
    getSupabaseServiceClient.mockReturnValue(null);
    await expect(publishSettingsGroup({ group: "appearance", value: defaultSystemSettings.appearance, actorId: "admin" })).rejects.toMatchObject({ status: 503 });
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("stops a publish when its version lookup fails", async () => {
    const { version, upsert, insert } = mockDatabase();
    version.mockResolvedValue({ data: null, error: { code: "UNAVAILABLE" } });
    await expect(publishSettingsGroup({ group: "appearance", value: defaultSystemSettings.appearance, actorId: "admin" })).rejects.toMatchObject({ status: 503 });
    expect(upsert).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])("discards an earlier in-flight %s after a newer publish", async (outcome) => {
    let finish!: (value: ReadResponse) => void;
    let rejectRead!: (error: Error) => void;
    const { read } = mockDatabase(vi.fn()
      .mockResolvedValueOnce(rows("Initial", true))
      .mockImplementationOnce(() => new Promise<ReadResponse>((resolve, reject) => { finish = resolve; rejectRead = reject; })));
    await readSystemSettings();
    let finishPublish!: (value: { error: null }) => void;
    const { upsert } = mockDatabase(read);
    upsert.mockImplementationOnce(() => new Promise((resolve) => { finishPublish = resolve; }));
    const publish = publishSettingsGroup({ group: "modules", value: { ...defaultSystemSettings.modules, warehouse: false }, actorId: "admin" });
    await vi.waitFor(() => expect(upsert).toHaveBeenCalled());
    now += 30_001;
    const pending = readSystemSettings();
    finishPublish({ error: null });
    await publish;
    // The expired snapshot forces another verified read after the generation change.
    read.mockResolvedValue(rows("Verified after publish", false));
    if (outcome === "success") finish(rows("Earlier response", true));
    else rejectRead(new Error("Obsolete read failure"));
    expect((await pending).modules.warehouse).toBe(false);
    expect((await readSettingsGroup("modules")).warehouse).toBe(false);
  });
});
