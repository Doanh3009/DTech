import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseServiceClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient }));

import { defaultSystemSettings } from "@/config/systemSettings";
import { readSystemSettings, resetLocalSystemSettingsForTests } from "./systemSettingsService";

describe("system settings read cache", () => {
  beforeEach(() => {
    resetLocalSystemSettingsForTests();
    getSupabaseServiceClient.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("shares a successful database read across requests without sharing mutable state", async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ group_key: "branding", value: { ...defaultSystemSettings.branding, systemName: "Kiểm thử" } }],
      error: null
    });
    getSupabaseServiceClient.mockReturnValue({ from: () => ({ select: () => ({ abortSignal: select }) }) });

    const first = await readSystemSettings();
    first.branding.systemName = "Changed locally";
    expect((await readSystemSettings()).branding.systemName).toBe("Kiểm thử");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("briefly caches fallback settings when the database is unavailable", async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { code: "UNAVAILABLE" } });
    getSupabaseServiceClient.mockReturnValue({ from: () => ({ select: () => ({ abortSignal: select }) }) });

    expect((await readSystemSettings()).branding.systemName).toBe(defaultSystemSettings.branding.systemName);
    expect((await readSystemSettings()).branding.systemName).toBe(defaultSystemSettings.branding.systemName);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("returns stale settings immediately while refreshing an expired snapshot", async () => {
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let finishRefresh: ((value: { data: Array<{ group_key: string; value: unknown }>; error: null }) => void) | undefined;
    const select = vi.fn()
      .mockResolvedValueOnce({ data: [{ group_key: "branding", value: { ...defaultSystemSettings.branding, systemName: "Trước" } }], error: null })
      .mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    getSupabaseServiceClient.mockReturnValue({ from: () => ({ select: () => ({ abortSignal: select }) }) });

    expect((await readSystemSettings()).branding.systemName).toBe("Trước");
    now += 30_001;
    expect((await readSystemSettings()).branding.systemName).toBe("Trước");
    expect(select).toHaveBeenCalledTimes(2);

    finishRefresh?.({ data: [{ group_key: "branding", value: { ...defaultSystemSettings.branding, systemName: "Sau" } }], error: null });
    await vi.waitFor(async () => expect((await readSystemSettings()).branding.systemName).toBe("Sau"));
  });
});
