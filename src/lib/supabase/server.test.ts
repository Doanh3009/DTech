import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ createClient: vi.fn(), env: {} as Record<string, unknown> }));
vi.mock("@supabase/supabase-js", () => ({ createClient: state.createClient }));
vi.mock("@/lib/env", () => ({ getServerEnv: () => state.env }));
import { getSupabaseServiceClient } from "./server";

describe("Supabase service client deadlines", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    state.env = { NEXT_PUBLIC_SUPABASE_URL: "https://unit.example.invalid", SUPABASE_SECRET_KEY: "unit-server-key" };
    state.createClient.mockReturnValue({ unitClient: true });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const deadlineFetch = () => {
    getSupabaseServiceClient({ timeoutMs: 100 });
    return state.createClient.mock.calls[0][2].global.fetch as typeof fetch;
  };
  it("keeps default client auth settings and leaves ordinary fetch unchanged", () => {
    getSupabaseServiceClient();
    expect(state.createClient).toHaveBeenCalledExactlyOnceWith("https://unit.example.invalid", "unit-server-key", { auth: { persistSession: false, autoRefreshToken: false } });
  });
  it("uses legacy service role key when the newer secret key is absent", () => {
    state.env = { NEXT_PUBLIC_SUPABASE_URL: "https://unit.example.invalid", SUPABASE_SERVICE_ROLE_KEY: "unit-legacy-key" };
    getSupabaseServiceClient(); expect(state.createClient.mock.calls[0][1]).toBe("unit-legacy-key");
  });
  it.each([
    { NEXT_PUBLIC_SUPABASE_URL: "https://unit.example.invalid" },
    { SUPABASE_SECRET_KEY: "unit-server-key" }, {}
  ])("returns null without complete configuration %j", (env) => {
    state.env = env; expect(getSupabaseServiceClient({ timeoutMs: 100 })).toBeNull(); expect(state.createClient).not.toHaveBeenCalled();
  });
  it("aborts a hanging fetch at its deadline", async () => {
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))));
    vi.stubGlobal("fetch", fetchMock); const wrapped = deadlineFetch();
    const pending = expect(wrapped("https://unit.example.invalid/rest", { method: "POST", body: "unit-body" })).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(99); expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await pending; expect(vi.getTimerCount()).toBe(0);
  });
  it("forwards a caller abort and reason before its own deadline", async () => {
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))));
    vi.stubGlobal("fetch", fetchMock); const wrapped = deadlineFetch(); const controller = new AbortController();
    const reason = new Error("caller cancelled"); const pending = expect(wrapped("https://unit.example.invalid/rest", { signal: controller.signal })).rejects.toBe(reason);
    controller.abort(reason); await pending; expect(vi.getTimerCount()).toBe(0);
  });
  it("forwards an already aborted signal to fetch without waiting for a timer", async () => {
    const reason = new Error("already cancelled"); const controller = new AbortController(); controller.abort(reason);
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => { if (init?.signal?.aborted) throw init.signal.reason; return new Response(); });
    vi.stubGlobal("fetch", fetchMock); const wrapped = deadlineFetch();
    await expect(wrapped("https://unit.example.invalid/rest", { signal: controller.signal })).rejects.toBe(reason); expect(vi.getTimerCount()).toBe(0);
  });
  it("removes listeners and its deadline after successful completion", async () => {
    const response = new Response("ok"); const fetchMock = vi.fn().mockResolvedValue(response); vi.stubGlobal("fetch", fetchMock);
    const wrapped = deadlineFetch(); const controller = new AbortController(); const remove = vi.spyOn(controller.signal, "removeEventListener");
    expect(await wrapped("https://unit.example.invalid/rest", { method: "GET", headers: { "x-unit": "true" }, signal: controller.signal })).toBe(response);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function)); expect(vi.getTimerCount()).toBe(0);
    controller.abort(); expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
  });
  it("clears its timer after an ordinary transport rejection", async () => {
    const failure = new Error("network unavailable"); vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure)); const wrapped = deadlineFetch();
    await expect(wrapped("https://unit.example.invalid/rest")).rejects.toBe(failure); expect(vi.getTimerCount()).toBe(0);
  });
});
