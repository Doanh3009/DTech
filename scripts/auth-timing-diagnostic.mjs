import { getTestPassword } from "./testing/password.mjs";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const baseUrl = process.env.UI_QA_BASE_URL || "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && publicKey && serviceKey, "Supabase configuration is required");
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const publicClient = createClient(url, publicKey, options);
const database = createClient(url, serviceKey, options);
const samples = Number(process.env.AUTH_TIMING_SAMPLES || 3);
assert(Number.isInteger(samples) && samples >= 1 && samples <= 5, "Use one to five samples");
const accountFields = "id,employee_id,username,display_name,primary_email,status,account_roles!account_roles_account_id_fkey(roles(role_permissions(permission_key)))";
const rounded = (value) => Math.round(value * 10) / 10;

async function timed(name, task) {
  const startedAt = performance.now();
  try {
    const response = await task();
    const error = response?.error;
    console.log(JSON.stringify({ name, ms: rounded(performance.now() - startedAt), ok: !error, errorCode: error?.code || (error ? error.name || "error" : undefined) }));
    return response;
  } catch (error) {
    console.log(JSON.stringify({ name, ms: rounded(performance.now() - startedAt), ok: false, errorName: error instanceof Error ? error.name : "unknown" }));
    return null;
  }
}

const loginStart = performance.now();
const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "test.supervisor", password: getTestPassword() })
});
const cookiePairs = login.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
await login.arrayBuffer();
console.log(JSON.stringify({ name: "local.login", ms: rounded(performance.now() - loginStart), status: login.status }));
assert(login.ok, "Disposable QA account login failed");
const cookieValues = new Map(cookiePairs.map((pair) => {
  const at = pair.indexOf("=");
  return [pair.slice(0, at), decodeURIComponent(pair.slice(at + 1))];
}));
const accessToken = cookieValues.get("ct_access_token");
const sessionId = cookieValues.get("ct_session_id");
assert(accessToken && sessionId, "Login did not return required cookies");
const jwtHeader = JSON.parse(Buffer.from(accessToken.split(".")[0], "base64url").toString("utf8"));
console.log(JSON.stringify({ name: "jwt.algorithm", algorithm: jwtHeader.alg, webCryptoAvailable: Boolean(globalThis.crypto?.subtle) }));

for (let sample = 1; process.env.AUTH_TIMING_REMOTE !== "0" && sample <= samples; sample += 1) {
  const [auth, session] = await Promise.all([
    timed(`remote.auth.getUser.${sample}`, () => publicClient.auth.getUser(accessToken)),
    timed(`remote.db.embeddedSession.${sample}`, () => database.from("app_sessions")
      .select(`id,account_id,last_seen_at,account:app_accounts!app_sessions_account_id_fkey(auth_user_id,${accountFields})`)
      .eq("id", sessionId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle())
  ]);
  console.log(JSON.stringify({ name: `remote.ownership.${sample}`, matches: Boolean(auth?.data?.user?.id && auth.data.user.id === session?.data?.account?.auth_user_id) }));
  await timed(`remote.auth.getClaims.${sample}`, () => publicClient.auth.getClaims(accessToken));
}

for (let sample = 1; sample <= samples; sample += 1) {
  for (const route of ["/api/v1/auth/realtime-token", "/api/v1/dashboard?widget=quick_actions", "/dashboard"]) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie: cookiePairs.join("; ") }, redirect: "manual" });
    const headersMs = performance.now() - startedAt;
    await response.arrayBuffer();
    console.log(JSON.stringify({ name: `local${route}.${sample}`, headersMs: rounded(headersMs), totalMs: rounded(performance.now() - startedAt), status: response.status }));
  }
}

for (let sample = 1; sample <= samples; sample += 1) {
  const routes = ["/api/v1/workspace/avatar", "/api/v1/workspace/note", "/api/v1/workspace/todos", "/api/v1/notifications/unread-count", "/api/v1/auth/realtime-token", "/api/v1/dashboard"];
  await Promise.all(routes.map(async (route) => {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}${route}`, { headers: { cookie: cookiePairs.join("; ") }, redirect: "manual" });
    const headersMs = performance.now() - startedAt;
    await response.arrayBuffer();
    console.log(JSON.stringify({ name: `burst${route}.${sample}`, headersMs: rounded(headersMs), totalMs: rounded(performance.now() - startedAt), status: response.status }));
  }));
}
