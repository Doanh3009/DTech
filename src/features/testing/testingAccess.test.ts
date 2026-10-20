// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTesterInvitation, TEST_GATE_COOKIE, validTesterToken } from "@/lib/testing/policy.mjs";

const mocks = vi.hoisted(() => ({ db: vi.fn(), signIn: vi.fn(), allowed: vi.fn(), result: vi.fn(), network: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.db }));
vi.mock("@/services/auth/sessionService", () => ({ signInWithPassword: mocks.signIn, assertLoginAllowed: mocks.allowed, recordLoginResult: mocks.result, requestNetworkContext: mocks.network }));
import { POST } from "@/app/api/testing/access/route";

const env = {
  APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321", TEST_SUPABASE_URL: "http://localhost:55321",
  TEST_TOOLS_GATE_SECRET: "unit-fixture-gate-secret-32-characters", TEST_ACCOUNT_PASSWORD: "UnitFixturePassword912", SESSION_HASH_PEPPER: "unit-fixture-session-secret-32-characters"
};
const now = Date.UTC(2026, 9, 12, 8);
const request = (body: unknown) => new Request("https://test.example.invalid/api/testing/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("tester access invitation exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); vi.setSystemTime(now);
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "production");
    mocks.network.mockResolvedValue({ ip: "127.0.0.1", userAgent: "unit" });
    mocks.allowed.mockResolvedValue(undefined); mocks.result.mockResolvedValue(undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("returns 404 in production before database, authentication or rate limiting", async () => {
    const token = createTesterInvitation(env, now);
    for (const disabled of [{ APP_ENV: "production" }, { RELEASE_ENVIRONMENT: "production" }, { TEST_TOOLS_ENABLED: "false" }]) {
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      for (const [key, value] of Object.entries(disabled)) vi.stubEnv(key, value);
      for (const body of [{ token }, { secret: env.TEST_TOOLS_GATE_SECRET }]) expect((await POST(request(body))).status).toBe(404);
    }
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.network).not.toHaveBeenCalled(); expect(mocks.allowed).not.toHaveBeenCalled(); expect(mocks.result).not.toHaveBeenCalled();
  });

  it("exchanges a valid invitation for a secure eight-hour HttpOnly grant", async () => {
    const token = createTesterInvitation(env, now);
    const response = await POST(request({ token }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie).toContain(`${TEST_GATE_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i); expect(cookie).toMatch(/Path=\//i); expect(cookie).toMatch(/Max-Age=28800/i);
    const sessionToken = response.cookies.get(TEST_GATE_COOKIE)?.value;
    expect(sessionToken).toBeTruthy(); expect(sessionToken).not.toBe(token);
    expect(validTesterToken(sessionToken || "", env, now)).toBe(true);
    expect(validTesterToken(sessionToken || "", env, now + 8 * 3600000)).toBe(false);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ ok: true, data: null });
    expect(body).not.toContain(token); expect(body).not.toContain(sessionToken); expect(body).not.toContain(env.TEST_TOOLS_GATE_SECRET); expect(body).not.toContain(env.TEST_ACCOUNT_PASSWORD);
    expect(mocks.signIn).not.toHaveBeenCalled(); expect(mocks.db).not.toHaveBeenCalled();
  });

  it("retains access with the existing server gate secret without exposing it", async () => {
    const response = await POST(request({ secret: env.TEST_TOOLS_GATE_SECRET }));
    expect(response.status).toBe(200);
    expect(validTesterToken(response.cookies.get(TEST_GATE_COOKIE)?.value || "", env, now)).toBe(true);
    expect(await response.text()).not.toContain(env.TEST_TOOLS_GATE_SECRET);
  });

  it("rejects expired and forged invitations without granting a cookie", async () => {
    const valid = createTesterInvitation(env, now);
    for (const token of [createTesterInvitation(env, now - 60000, 60000), `${valid}x`, "forged.invitation"]) {
      const response = await POST(request({ token }));
      expect(response.status).toBe(401); expect(response.headers.get("set-cookie")).toBeNull();
      const body = await response.text();
      expect(body).not.toContain(token); expect(body).not.toContain(env.TEST_TOOLS_GATE_SECRET);
    }
    expect(mocks.signIn).not.toHaveBeenCalled(); expect(mocks.db).not.toHaveBeenCalled();
  });

  it("rejects mixed or extra credentials before rate limiting or cookie creation", async () => {
    const token = createTesterInvitation(env, now);
    for (const body of [{ secret: env.TEST_TOOLS_GATE_SECRET, token }, {}, { token, role: "admin" }, { token: "" }, { secret: "" }]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400); expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(mocks.network).not.toHaveBeenCalled(); expect(mocks.allowed).not.toHaveBeenCalled(); expect(mocks.result).not.toHaveBeenCalled();
  });
});
