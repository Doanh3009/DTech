// @vitest-environment node
import { createHash } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), createClient: vi.fn(), spawn: vi.fn(), fetch: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));

import { assertTestConfiguration, assertTestConfigFilename, loadTestConfiguration, TEST_CONFIG_KEYS, TestConfigurationError } from "./config.mjs";

const localConfig = {
  APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true", E2E_DATABASE_KIND: "test",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:55321", TEST_SUPABASE_URL: "http://localhost:55321", E2E_SUPABASE_URL: "http://localhost:55321", TEST_SUPABASE_PROJECT_ID: "local",
  APP_BASE_URL: "http://localhost:3300", E2E_BASE_URL: "http://localhost:3300",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "unit-fixture-public-key", SUPABASE_SERVICE_ROLE_KEY: "unit-fixture-service-key",
  TEST_TOOLS_GATE_SECRET: "unit-fixture-tester-gate-secret-32-characters", TEST_ACCOUNT_PASSWORD: "UnitFixturePassword912", SESSION_HASH_PEPPER: "unit-fixture-session-pepper-32-characters",
  API_KEY_PEPPER: "unit-fixture-api-key-pepper-32-characters", INTEGRATION_ENCRYPTION_KEY: "unit-fixture-encryption-key-32-characters",
  WEBHOOK_SIGNING_SECRET: "unit-fixture-webhook-secret-32-characters", INTEGRATION_WORKER_SECRET: "unit-fixture-worker-secret-32-characters", OPERATIONS_CRON_SECRET: "unit-fixture-cron-secret-32-characters"
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const remoteConfig = {
  ...localConfig, APP_ENV: "staging", RELEASE_ENVIRONMENT: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://testproject.supabase.co", TEST_SUPABASE_URL: "https://testproject.supabase.co", E2E_SUPABASE_URL: "https://testproject.supabase.co", TEST_SUPABASE_PROJECT_ID: "testproject",
  APP_BASE_URL: "https://staging.example.invalid", E2E_BASE_URL: "https://staging.example.invalid", PRODUCTION_SUPABASE_URL: "https://productionproject.supabase.co",
  PRODUCTION_SERVICE_KEY_SHA256: hash("unit-fixture-production-service-key"), PRODUCTION_SESSION_SECRET_SHA256: hash("unit-fixture-production-session-pepper"),
  STAGING_ACCESS_USER: "tester", STAGING_ACCESS_PASSWORD: "unit-fixture-staging-password"
};
const contents = (config) => Object.entries(config).map(([key, value]) => `${key}=${value}`).join("\n");
const without = (config, ...keys) => Object.fromEntries(Object.entries(config).filter(([key]) => !keys.includes(key)));
function configurationError(config, filename) {
  try { assertTestConfiguration(config, filename); }
  catch (error) { expect(error).toBeInstanceOf(TestConfigurationError); return error; }
  throw new Error("Expected invalid test configuration to fail");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("test configuration validation", () => {
  it.each([
    ["missing", {}],
    ["empty", Object.fromEntries(TEST_CONFIG_KEYS.map((key) => [key, ""]))],
    ["whitespace", Object.fromEntries(TEST_CONFIG_KEYS.map((key) => [key, "   "]))]
  ])("aggregates all %s required fields without parsing URLs", (_, config) => {
    const error = configurationError(config);
    for (const key of Object.keys(localConfig)) expect(error.message).toContain(key);
    expect(error.message).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(error.message).toContain("SUPABASE_SECRET_KEY");
    expect(error.message).not.toContain("Invalid URL");
    expect(error).not.toHaveProperty("input");
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "TEST_SUPABASE_URL", "E2E_SUPABASE_URL", "PRODUCTION_SUPABASE_URL", "APP_BASE_URL", "E2E_BASE_URL"])("sanitizes malformed %s without exposing its value", (key) => {
    const secret = "synthetic-url-secret-never-display";
    const error = configurationError({ ...remoteConfig, [key]: `malformed URL ${secret}` });
    expect(error.message).toContain(key);
    expect(error.message).not.toContain(secret);
    expect(error.stack).not.toContain(secret);
    expect(error).not.toHaveProperty("input");
    expect(error).not.toHaveProperty("cause");
  });

  it.each(["NEXT_PUBLIC_SUPABASE_URL", "TEST_SUPABASE_URL", "E2E_SUPABASE_URL"])("rejects an independent mismatch in %s", (key) => {
    expect(() => assertTestConfiguration({ ...localConfig, [key]: "http://localhost:55322" })).toThrow(TestConfigurationError);
  });

  it.each([
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"]
  ])("accepts public alias %s and service alias %s", (publicKey, serviceKey) => {
    const config = without(remoteConfig, "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY");
    config[publicKey] = "unit-fixture-selected-public-key";
    config[serviceKey] = "unit-fixture-selected-service-key";
    expect(assertTestConfiguration(config).target).toEqual({ environment: "staging", databaseUrl: "https://testproject.supabase.co/", projectId: "testproject" });
  });

  it.each(["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"])("rejects whitespace in a preferred %s instead of shadowing a valid fallback", (key) => {
    expect(() => assertTestConfiguration({ ...localConfig, [key]: "   " })).toThrow(`${key} không được chứa khoảng trắng`);
  });

  it("accepts a dedicated remote database with the application running locally", () => {
    const config = { ...remoteConfig, APP_ENV: "test", RELEASE_ENVIRONMENT: "test", APP_BASE_URL: localConfig.APP_BASE_URL, E2E_BASE_URL: localConfig.E2E_BASE_URL, STAGING_ACCESS_USER: "", STAGING_ACCESS_PASSWORD: "" };
    expect(assertTestConfiguration(config).target.projectId).toBe("testproject");
    expect(assertTestConfiguration(config).baseUrl.hostname).toBe("localhost");
  });

  it.each([
    ["production application", { APP_ENV: "production" }, "Test tools disabled"],
    ["production release", { RELEASE_ENVIRONMENT: "production" }, "Test tools disabled"],
    ["shared production database", { PRODUCTION_SUPABASE_URL: remoteConfig.NEXT_PUBLIC_SUPABASE_URL }, "Production database must be distinct"],
    ["wrong remote project", { TEST_SUPABASE_PROJECT_ID: "productionproject" }, "Test project ID mismatch"],
    ["shared production service key", { PRODUCTION_SERVICE_KEY_SHA256: hash(remoteConfig.SUPABASE_SERVICE_ROLE_KEY) }, "Service key isolation required"],
    ["shared production session secret", { PRODUCTION_SESSION_SECRET_SHA256: hash(remoteConfig.SESSION_HASH_PEPPER) }, "Session secret isolation required"],
    ["missing service fingerprint", { PRODUCTION_SERVICE_KEY_SHA256: "" }, "Service key isolation required"],
    ["malformed service fingerprint", { PRODUCTION_SERVICE_KEY_SHA256: "invalid" }, "Service key isolation required"],
    ["missing session fingerprint", { PRODUCTION_SESSION_SECRET_SHA256: "" }, "Session secret isolation required"],
    ["malformed session fingerprint", { PRODUCTION_SESSION_SECRET_SHA256: "invalid" }, "Session secret isolation required"]
  ])("rejects %s", (_, change, message) => {
    expect(() => assertTestConfiguration({ ...remoteConfig, ...change })).toThrow(message);
  });

  it("requires the local project ID for a local database", () => {
    expect(() => assertTestConfiguration({ ...localConfig, TEST_SUPABASE_PROJECT_ID: "other-project" })).toThrow("TEST_SUPABASE_PROJECT_ID");
  });

  it("accepts equivalent URL normalization and returns the exact local target", () => {
    const result = assertTestConfiguration({ ...localConfig, E2E_SUPABASE_URL: `${localConfig.E2E_SUPABASE_URL}/` });
    expect(result.target).toEqual({ environment: "test", databaseUrl: "http://localhost:55321/", projectId: "local" });
    expect(result.baseUrl.href).toBe("http://localhost:3300/");
  });

  it("validates local and remote configurations without database, network or child process access", () => {
    assertTestConfiguration(localConfig);
    assertTestConfiguration(remoteConfig);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});

describe("dedicated test configuration loading", () => {
  it.each([".env.e2e.local", ".env.staging.local", ".env.development.local"])("accepts %s and its equivalent absolute path", (filename) => {
    expect(() => assertTestConfigFilename(filename)).not.toThrow();
    expect(() => assertTestConfigFilename(path.resolve(filename))).not.toThrow();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it.each([
    ".env.local", ".env.production", ".env.production.local", path.resolve(".env.local"),
    path.join("..", ".env.e2e.local"), path.join("subdirectory", ".env.e2e.local"), path.resolve("..", ".env.staging.local")
  ])("rejects unsupported filename %s before any read", async (filename) => {
    await expect(loadTestConfiguration({ filename, inheritedEnv: localConfig })).rejects.toThrow(TestConfigurationError);
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("reports a missing file with an initialization command without inherited fallback", async () => {
    mocks.readFile.mockRejectedValue(Object.assign(new Error("synthetic-filesystem-details"), { code: "ENOENT" }));
    const error = await loadTestConfiguration({ filename: ".env.e2e.local", inheritedEnv: localConfig }).catch((failure) => failure);
    expect(error).toBeInstanceOf(TestConfigurationError);
    expect(error.message).toContain(".env.e2e.local");
    expect(error.message).toContain("npm run test:config:init");
    expect(error.message).not.toContain("synthetic-filesystem-details");
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(".env.e2e.local", "utf8");
  });

  it("rejects an empty file even when the inherited environment is complete", async () => {
    mocks.readFile.mockResolvedValue("");
    await expect(loadTestConfiguration({ filename: ".env.e2e.local", inheritedEnv: localConfig })).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL", "TEST_SUPABASE_URL", "E2E_SUPABASE_URL", "TEST_SUPABASE_PROJECT_ID",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "TEST_TOOLS_GATE_SECRET", "TEST_ACCOUNT_PASSWORD", "SESSION_HASH_PEPPER"
  ])("rejects an omitted %s instead of inheriting it", async (key) => {
    mocks.readFile.mockResolvedValue(contents(without(localConfig, key)));
    await expect(loadTestConfiguration({ filename: ".env.e2e.local", inheritedEnv: localConfig })).rejects.toThrow(key);
  });

  it("clears absent aliases and managed fields while preserving unrelated runtime settings", async () => {
    mocks.readFile.mockResolvedValue(contents(localConfig));
    const inheritedEnv = { ...Object.fromEntries(TEST_CONFIG_KEYS.map((key) => [key, "synthetic-inherited-value"])), PATH: "synthetic-runtime-path", UI_QA_BROWSER: "synthetic-browser-path" };
    const originalInherited = { ...inheritedEnv };
    const result = await loadTestConfiguration({ filename: ".env.e2e.local", inheritedEnv });
    for (const key of TEST_CONFIG_KEYS) expect(result.env[key]).toBe(localConfig[key] ?? "");
    expect(result.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("");
    expect(result.env.SUPABASE_SECRET_KEY).toBe("");
    expect(result.env.SEED_TEST_PASSWORD).toBe("");
    expect(result.env.STAGING_ACCESS_PASSWORD).toBe("");
    expect(result.env.PATH).toBe(inheritedEnv.PATH);
    expect(result.env.UI_QA_BROWSER).toBe(inheritedEnv.UI_QA_BROWSER);
    expect(result.config).toEqual(localConfig);
    expect(inheritedEnv).toEqual(originalInherited);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
