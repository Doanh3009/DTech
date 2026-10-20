import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const TEST_OWNER = "ct-noibo-test-v1";
export const TEST_GATE_COOKIE = "ct_tester_gate";
const digest = (value) => createHash("sha256").update(value).digest("hex");
export function safeEqual(left, right) {
  return timingSafeEqual(Buffer.from(digest(left)), Buffer.from(digest(right)));
}
export function configuredUrl(env, key) {
  if (typeof env[key] !== "string" || !env[key].trim()) throw new Error(`Thiếu ${key}`);
  try { return new URL(env[key]); }
  catch { throw new Error(`${key} không phải URL hợp lệ`); }
}
export function assertTestEnvironment(env = process.env) {
  if (!["development", "staging", "test"].includes(env.APP_ENV) || env.RELEASE_ENVIRONMENT === "production" || env.TEST_TOOLS_ENABLED !== "true") throw new Error("Test tools disabled");
  const actual = configuredUrl(env, "NEXT_PUBLIC_SUPABASE_URL");
  const expected = configuredUrl(env, "TEST_SUPABASE_URL");
  if (actual.href !== expected.href || !["http:", "https:"].includes(actual.protocol) || actual.username || actual.password || actual.pathname !== "/" || actual.search || actual.hash) throw new Error("Test database target mismatch");
  const local = ["localhost", "127.0.0.1"].includes(actual.hostname);
  if (local && env.APP_ENV === "staging") throw new Error("Staging needs a dedicated remote project");
  if (!local) {
    if (actual.protocol !== "https:" || actual.port || actual.hostname !== `${env.TEST_SUPABASE_PROJECT_ID}.supabase.co`) throw new Error("Test project ID mismatch");
    if (configuredUrl(env, "PRODUCTION_SUPABASE_URL").hostname === actual.hostname) throw new Error("Production database must be distinct");
    const service = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!service || !/^[a-f0-9]{64}$/.test(env.PRODUCTION_SERVICE_KEY_SHA256 || "") || digest(service) === env.PRODUCTION_SERVICE_KEY_SHA256) throw new Error("Service key isolation required");
    if (!/^[a-f0-9]{64}$/.test(env.PRODUCTION_SESSION_SECRET_SHA256 || "") || digest(env.SESSION_HASH_PEPPER || "") === env.PRODUCTION_SESSION_SECRET_SHA256) throw new Error("Session secret isolation required");
  }
  for (const key of ["TEST_TOOLS_GATE_SECRET", "SESSION_HASH_PEPPER"]) if (!env[key] || env[key].length < 32) throw new Error(`${key} needs 32 characters`);
  if (!env.TEST_ACCOUNT_PASSWORD || env.TEST_ACCOUNT_PASSWORD.length < 12 || !/[A-Za-z]/.test(env.TEST_ACCOUNT_PASSWORD) || !/\d/.test(env.TEST_ACCOUNT_PASSWORD)) throw new Error("TEST_ACCOUNT_PASSWORD needs 12 characters with letters and digits");
  if (safeEqual(env.TEST_TOOLS_GATE_SECRET, env.TEST_ACCOUNT_PASSWORD) || safeEqual(env.TEST_TOOLS_GATE_SECRET, env.SESSION_HASH_PEPPER) || safeEqual(env.TEST_ACCOUNT_PASSWORD, env.SESSION_HASH_PEPPER)) throw new Error("Tester gate secret must be separate");
  if (env.APP_ENV === "staging" && (!env.STAGING_ACCESS_USER || !env.STAGING_ACCESS_PASSWORD || env.STAGING_ACCESS_PASSWORD.length < 16 || configuredUrl(env, "APP_BASE_URL").protocol !== "https:")) throw new Error("Staging access gate and HTTPS required");
  return { environment: env.APP_ENV, databaseUrl: actual.href, projectId: local ? "local" : env.TEST_SUPABASE_PROJECT_ID };
}
export function testToolsAvailable(env = process.env) {
  try { return assertTestEnvironment(env); } catch { return null; }
}
export function createTesterToken(env = process.env, now = Date.now()) {
  const config = assertTestEnvironment(env);
  const payload = Buffer.from(JSON.stringify({ expiresAt: now + 8 * 60 * 60 * 1000, target: config.databaseUrl, environment: config.environment })).toString("base64url");
  return `${payload}.${createHmac("sha256", env.TEST_TOOLS_GATE_SECRET).update(payload).digest("base64url")}`;
}
export function validTesterToken(token, env = process.env, now = Date.now()) {
  try {
    const config = assertTestEnvironment(env);
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || token.length > 2000) return false;
    if (!safeEqual(signature, createHmac("sha256", env.TEST_TOOLS_GATE_SECRET).update(payload).digest("base64url"))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.target === config.databaseUrl && data.environment === config.environment && data.expiresAt > now && data.expiresAt <= now + 8 * 60 * 60 * 1000;
  } catch { return false; }
}
const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1000;
export function createTesterInvitation(env = process.env, now = Date.now(), ttlMs = invitationLifetimeMs) {
  const config = assertTestEnvironment(env);
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > invitationLifetimeMs) throw new Error("Invalid tester invitation lifetime");
  const payload = Buffer.from(JSON.stringify({ kind: "tester-invitation", expiresAt: now + ttlMs, target: config.databaseUrl, environment: config.environment })).toString("base64url");
  const signature = createHmac("sha256", env.TEST_TOOLS_GATE_SECRET).update("tester-invitation:").update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
export function validTesterInvitation(token, env = process.env, now = Date.now()) {
  try {
    const config = assertTestEnvironment(env);
    if (typeof token !== "string" || token.length > 2000) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", env.TEST_TOOLS_GATE_SECRET).update("tester-invitation:").update(payload).digest("base64url");
    if (!safeEqual(signature, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.kind === "tester-invitation" && data.target === config.databaseUrl && data.environment === config.environment
      && Number.isFinite(data.expiresAt) && data.expiresAt > now && data.expiresAt <= now + invitationLifetimeMs;
  } catch { return false; }
}
export function sessionCookieNames(env = process.env) {
  const suffix = ["development", "staging", "test"].includes(env.APP_ENV) ? `_${env.APP_ENV}` : "";
  return { access: `ct_access_token${suffix}`, refresh: `ct_refresh_token${suffix}`, session: `ct_session_id${suffix}` };
}
export function markedTestAccount(metadata) {
  return Boolean(metadata && (metadata.testOwner === TEST_OWNER || metadata.testData === true || metadata.e2eRun || metadata.seed === "test-users-v1" || metadata.developmentSeed));
}
export function productionAccountAllowed(metadata, env = process.env) {
  return !markedTestAccount(metadata) || Boolean(testToolsAvailable(env));
}
export function stagingAuthorized(authorization, env = process.env) {
  if (env.APP_ENV !== "staging") return true;
  if (!testToolsAvailable(env) || !authorization?.startsWith("Basic ")) return false;
  try { return safeEqual(Buffer.from(authorization.slice(6), "base64").toString("utf8"), `${env.STAGING_ACCESS_USER}:${env.STAGING_ACCESS_PASSWORD}`); } catch { return false; }
}
export function externalDeliveryAllowed(env = process.env) {
  return !["development", "staging", "test"].includes(env.APP_ENV) && !["development", "staging", "test"].includes(env.RELEASE_ENVIRONMENT) && env.TEST_TOOLS_ENABLED !== "true";
}
