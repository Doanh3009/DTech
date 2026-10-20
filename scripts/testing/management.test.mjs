// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ spawnSync: vi.fn(), readFile: vi.fn(), fetch: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
import { managementAccessToken, managementClient } from "./management.mjs";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("SUPABASE_ACCESS_TOKEN", "sbp_unitfixture"); vi.stubGlobal("fetch", mocks.fetch); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase management credential handling", () => {
  it("uses an explicitly supplied token only in memory", async () => {
    expect(await managementAccessToken()).toBe("sbp_unitfixture");
    expect(mocks.spawnSync).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });
  it("rejects invalid credentials without exposing their value", async () => {
    vi.stubEnv("SUPABASE_ACCESS_TOKEN", "synthetic-private-invalid-token");
    await expect(managementAccessToken()).rejects.toThrow("Không đọc được phiên CLI Supabase hợp lệ");
  });
  it("captures the CLI credential reader output instead of inheriting stdout", async () => {
    vi.stubEnv("SUPABASE_ACCESS_TOKEN", "");
    mocks.spawnSync.mockReturnValue({ status: 0, stdout: "sbp_windowsfixture" });
    mocks.readFile.mockResolvedValue("sbp_filefixture");
    expect(await managementAccessToken()).toBe(process.platform === "win32" ? "sbp_windowsfixture" : "sbp_filefixture");
    if (process.platform === "win32") expect(mocks.spawnSync).toHaveBeenCalledWith("powershell.exe", expect.any(Array), expect.objectContaining({ encoding: "utf8", windowsHide: true }));
  });
  it.each(["https://evil.invalid", "//evil.invalid/v1/projects", "/v1/projects/../secrets", "/v1/projects#fragment"])("rejects unsafe route %s before sending a token", async (route) => {
    const api = await managementClient();
    await expect(api("GET", route)).rejects.toThrow("Management route không hợp lệ");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("uses only the Supabase management origin and refuses redirects", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ plan: "free" }) });
    const api = await managementClient();
    expect(await api("GET", "/v1/organizations/unitfixture")).toEqual({ plan: "free" });
    expect(mocks.fetch).toHaveBeenCalledWith("https://api.supabase.com/v1/organizations/unitfixture", expect.objectContaining({ redirect: "error", headers: { authorization: "Bearer sbp_unitfixture", "content-type": "application/json" } }));
  });
  it("redacts credentials and database passwords echoed in API failures", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: "sbp_unitfixture db-password-fixture sb_secret_fixture sb_publishable_fixture" }) });
    const api = await managementClient();
    await expect(api("POST", "/v1/projects", { db_pass: "db-password-fixture" })).rejects.toThrow("Supabase 400: [redacted] [redacted] [redacted] [redacted]");
  });
});
