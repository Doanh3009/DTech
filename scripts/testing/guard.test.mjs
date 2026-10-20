// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), marker: null }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { assertSeedTarget } from "./guard.mjs";
const env = { APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321", TEST_SUPABASE_URL: "http://localhost:55321", TEST_TOOLS_GATE_SECRET: "unit-fixture-gate-secret-32-characters", TEST_ACCOUNT_PASSWORD: "UnitFixturePassword912", SESSION_HASH_PEPPER: "unit-fixture-session-secret-32-characters", SUPABASE_SERVICE_ROLE_KEY: "unit-test-key" };
describe("seed target guards before writes", () => {
  const argv = [...process.argv];
  beforeEach(() => {
    process.argv = [...argv]; vi.clearAllMocks();
    mocks.marker = { owner: "ct-noibo-test-v1", target: "http://localhost:55321/", projectId: "local" };
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { value: mocks.marker }, error: null }) };
    mocks.createClient.mockReturnValue({ from: () => query });
  });
  afterEach(() => { process.argv = [...argv]; });
  it("rejects production even when allow-remote is supplied", async () => {
    process.argv.push("--allow-remote");
    await expect(assertSeedTarget({ ...env, APP_ENV: "production" })).rejects.toThrow();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects legacy reset before any database access", async () => {
    process.argv.push("--reset", "--allow-remote");
    await expect(assertSeedTarget(env)).rejects.toThrow("Reset cũ");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("requires the exact URL and a service key", async () => {
    await expect(assertSeedTarget({ ...env, TEST_SUPABASE_URL: "http://localhost:54321" })).rejects.toThrow();
    await expect(assertSeedTarget({ ...env, SUPABASE_SERVICE_ROLE_KEY: "" })).rejects.toThrow();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects missing, wrong-owner, cross-project and cross-target database markers", async () => {
    for (const marker of [null, {}, { ...mocks.marker, owner: "someone-else" }, { ...mocks.marker, target: "http://localhost:54321/" }, { ...mocks.marker, projectId: "other" }]) {
      mocks.marker = marker; await expect(assertSeedTarget(env)).rejects.toThrow("Database chưa");
    }
  });
  it("accepts only a verified test target", async () => {
    expect((await assertSeedTarget(env)).target.projectId).toBe("local");
    expect(mocks.createClient).toHaveBeenCalledOnce();
  });
});
