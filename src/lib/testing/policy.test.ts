import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertTestEnvironment, configuredUrl, createTesterInvitation, createTesterToken, externalDeliveryAllowed, productionAccountAllowed, sessionCookieNames, stagingAuthorized, testToolsAvailable, validTesterInvitation, validTesterToken, TEST_OWNER } from "./policy.mjs";
export const testEnv = {
  APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321", TEST_SUPABASE_URL: "http://localhost:55321",
  TEST_TOOLS_GATE_SECRET: "unit-fixture-gate-secret-32-characters", TEST_ACCOUNT_PASSWORD: "UnitFixturePassword912", SESSION_HASH_PEPPER: "unit-fixture-session-secret-32-characters", APP_BASE_URL: "http://localhost:3300"
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const staging = { ...testEnv, APP_ENV: "staging", RELEASE_ENVIRONMENT: "staging", APP_BASE_URL: "https://staging.example.invalid", NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co", TEST_SUPABASE_URL: "https://testproject.supabase.co", TEST_SUPABASE_PROJECT_ID: "testproject", PRODUCTION_SUPABASE_URL: "https://productionproject.supabase.co", SUPABASE_SECRET_KEY: "unit-test-service-key", PRODUCTION_SERVICE_KEY_SHA256: hash("other-key"), PRODUCTION_SESSION_SECRET_SHA256: hash("other-session"), STAGING_ACCESS_USER: "tester", STAGING_ACCESS_PASSWORD: "unit-staging-gate-password" };
describe("test environment server guards", () => {
  it("names missing or malformed URL fields without exposing their input", () => {
    for (const value of [undefined, "", "   "]) {
      expect(() => configuredUrl({ NEXT_PUBLIC_SUPABASE_URL: value }, "NEXT_PUBLIC_SUPABASE_URL")).toThrow("Thiếu NEXT_PUBLIC_SUPABASE_URL");
    }
    const sensitiveInput = "synthetic-secret-in-a-malformed-url";
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "TEST_SUPABASE_URL", "PRODUCTION_SUPABASE_URL", "APP_BASE_URL"]) {
      try { assertTestEnvironment({ ...staging, [key]: sensitiveInput }); throw new Error("expected rejection"); }
      catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(key);
        expect((error as Error).message).not.toContain(sensitiveInput);
        expect(error).not.toHaveProperty("input");
        expect(error).not.toHaveProperty("cause");
      }
    }
  });
  it("defaults to disabled and cannot enable production with a frontend flag", () => {
    expect(testToolsAvailable({})).toBeNull();
    expect(testToolsAvailable({ ...testEnv, APP_ENV: "production" })).toBeNull();
    expect(testToolsAvailable({ ...testEnv, RELEASE_ENVIRONMENT: "production" })).toBeNull();
    expect(testToolsAvailable({ ...testEnv, TEST_TOOLS_ENABLED: "false", NEXT_PUBLIC_TEST_TOOLS_ENABLED: "true" })).toBeNull();
  });
  it("requires target and project ID to match exactly", () => {
    expect(() => assertTestEnvironment({ ...testEnv, TEST_SUPABASE_URL: "http://localhost:54321" })).toThrow();
    expect(() => assertTestEnvironment({ ...staging, TEST_SUPABASE_PROJECT_ID: "productionproject" })).toThrow();
    expect(() => assertTestEnvironment({ ...staging, PRODUCTION_SUPABASE_URL: staging.TEST_SUPABASE_URL })).toThrow();
    expect(() => assertTestEnvironment({ ...testEnv, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321/?x=1", TEST_SUPABASE_URL: "http://localhost:55321/?x=1" })).toThrow();
    expect(() => assertTestEnvironment({ ...staging, NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co:444", TEST_SUPABASE_URL: "https://testproject.supabase.co:444" })).toThrow();
  });
  it("requires distinct keys, session secret, tester gate and HTTPS on staging", () => {
    expect(assertTestEnvironment(staging).environment).toBe("staging");
    expect(() => assertTestEnvironment({ ...staging, PRODUCTION_SERVICE_KEY_SHA256: hash(staging.SUPABASE_SECRET_KEY) })).toThrow();
    expect(() => assertTestEnvironment({ ...staging, PRODUCTION_SESSION_SECRET_SHA256: hash(staging.SESSION_HASH_PEPPER) })).toThrow();
    expect(() => assertTestEnvironment({ ...staging, APP_BASE_URL: "http://staging.example.invalid" })).toThrow();
    expect(() => assertTestEnvironment({ ...testEnv, TEST_TOOLS_GATE_SECRET: testEnv.SESSION_HASH_PEPPER })).toThrow();
    expect(() => assertTestEnvironment({ ...staging, PRODUCTION_SERVICE_KEY_SHA256: "invalid" })).toThrow();
  });
  it("rejects forged, expired and cross-environment tester tokens", () => {
    const now = Date.now(), token = createTesterToken(testEnv, now);
    expect(validTesterToken(token, testEnv, now)).toBe(true);
    expect(validTesterToken(token + "x", testEnv, now)).toBe(false);
    expect(validTesterToken(token, testEnv, now + 8 * 3600000)).toBe(false);
    expect(validTesterToken(token, { ...testEnv, APP_ENV: "development" }, now)).toBe(false);
    expect(validTesterToken(token, { ...testEnv, TEST_SUPABASE_URL: "http://localhost:55322", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55322" }, now)).toBe(false);
  });
  it("requires staging access authentication before serving the app", () => {
    expect(stagingAuthorized(null, staging)).toBe(false);
    expect(stagingAuthorized("Basic " + Buffer.from("tester:wrong").toString("base64"), staging)).toBe(false);
    expect(stagingAuthorized("Basic " + Buffer.from(`${staging.STAGING_ACCESS_USER}:${staging.STAGING_ACCESS_PASSWORD}`).toString("base64"), staging)).toBe(true);
  });
  it("isolates cookies and blocks seeded users in production", () => {
    expect(sessionCookieNames({}).session).toBe("ct_session_id");
    expect(new Set(["production", "development", "staging", "test"].map((APP_ENV) => sessionCookieNames({ APP_ENV }).session)).size).toBe(4);
    for (const metadata of [{ testData: true }, { testOwner: TEST_OWNER }, { e2eRun: "fixture" }]) {
      expect(productionAccountAllowed(metadata, {})).toBe(false);
      expect(productionAccountAllowed(metadata, testEnv)).toBe(true);
    }
    expect(productionAccountAllowed({}, {})).toBe(true);
  });
  it("blocks external deliveries throughout development, test and staging", () => {
    for (const APP_ENV of ["development", "test", "staging"]) expect(externalDeliveryAllowed({ APP_ENV })).toBe(false);
    expect(externalDeliveryAllowed({ APP_ENV: "production" })).toBe(true);
    expect(externalDeliveryAllowed({ APP_ENV: "production", RELEASE_ENVIRONMENT: "staging" })).toBe(false);
    expect(externalDeliveryAllowed({ APP_ENV: "production", TEST_TOOLS_ENABLED: "true" })).toBe(false);
  });
});

describe("tester invitation boundaries", () => {
  const now = Date.UTC(2026, 9, 12, 8);
  const maxAge = 7 * 24 * 3600000;
  const invitationPayload = (overrides: Record<string, unknown> = {}) => ({ kind: "tester-invitation", expiresAt: now + 3600000, target: "http://localhost:55321/", environment: "test", ...overrides });
  const signedInvitation = (value: unknown) => {
    const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${payload}.${createHmac("sha256", testEnv.TEST_TOOLS_GATE_SECRET).update(`tester-invitation:${payload}`).digest("base64url")}`;
  };

  it("creates a seven-day invitation and accepts a shorter lifetime", () => {
    const token = createTesterInvitation(testEnv, now);
    expect(JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"))).toEqual(invitationPayload({ expiresAt: now + maxAge }));
    expect(validTesterInvitation(token, testEnv, now)).toBe(true);
    expect(validTesterInvitation(token, testEnv, now + maxAge - 1)).toBe(true);
    expect(validTesterInvitation(token, testEnv, now + maxAge)).toBe(false);
    const short = createTesterInvitation(testEnv, now, 60000);
    expect(validTesterInvitation(short, testEnv, now + 59999)).toBe(true);
    expect(validTesterInvitation(short, testEnv, now + 60000)).toBe(false);
  });

  it("does not allow issuing an invitation outside the seven-day limit", () => {
    for (const ttl of [0, -1, maxAge + 1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createTesterInvitation(testEnv, now, ttl)).toThrow();
    }
    expect(validTesterInvitation(signedInvitation(invitationPayload({ expiresAt: now + maxAge + 1 })), testEnv, now)).toBe(false);
  });

  it("binds invitations to the environment, database and signing key", () => {
    const token = createTesterInvitation(testEnv, now);
    expect(validTesterInvitation(token, { ...testEnv, APP_ENV: "development" }, now)).toBe(false);
    expect(validTesterInvitation(token, { ...testEnv, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55322", TEST_SUPABASE_URL: "http://localhost:55322" }, now)).toBe(false);
    expect(validTesterInvitation(token, { ...testEnv, TEST_TOOLS_GATE_SECRET: "another-fixture-gate-secret-32-characters" }, now)).toBe(false);
    expect(validTesterInvitation(token, { ...testEnv, APP_ENV: "production" }, now)).toBe(false);
    expect(() => createTesterInvitation({ ...testEnv, RELEASE_ENVIRONMENT: "production" }, now)).toThrow();
  });

  it("rejects forged and malformed invitations even when the signature matches", () => {
    const token = createTesterInvitation(testEnv, now);
    for (const malformed of ["", "forged", `${token}x`, `${token}.extra`, ".signature", `${token.split(".")[0]}.`, "x".repeat(2001)]) {
      expect(validTesterInvitation(malformed, testEnv, now)).toBe(false);
    }
    for (const payload of [null, [], {}, invitationPayload({ kind: "other" }), invitationPayload({ expiresAt: now }), invitationPayload({ expiresAt: "never" }), invitationPayload({ expiresAt: null }), invitationPayload({ environment: "staging" }), invitationPayload({ target: "http://localhost:55322/" })]) {
      expect(validTesterInvitation(signedInvitation(payload), testEnv, now)).toBe(false);
    }
  });

  it("keeps invitations separate from eight-hour tester session tokens", () => {
    const invitation = createTesterInvitation(testEnv, now, 3600000);
    const session = createTesterToken(testEnv, now);
    expect(validTesterToken(invitation, testEnv, now)).toBe(false);
    expect(validTesterInvitation(session, testEnv, now)).toBe(false);
    const payload = Buffer.from(JSON.stringify(invitationPayload())).toString("base64url");
    const unscoped = `${payload}.${createHmac("sha256", testEnv.TEST_TOOLS_GATE_SECRET).update(payload).digest("base64url")}`;
    expect(validTesterInvitation(unscoped, testEnv, now)).toBe(false);
  });
});
