import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, readdir, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";

import { assertTestConfiguration, TEST_CONFIG_KEYS } from "./config.mjs";
import { createTesterInvitation } from "../../src/lib/testing/policy.mjs";

const alias = "ct-noi-bo-test-chau-tuan.vercel.app";
const accessFile = ".tmp/testing-preview-access.private.json";
const lifetimeSeconds = 7 * 24 * 60 * 60;

async function cliPath() {
  if (process.env.CT_VERCEL_CLI) return process.env.CT_VERCEL_CLI;
  const cache = path.join(process.env.LOCALAPPDATA || "", "npm-cache", "_npx");
  const candidates = [];
  for (const entry of await readdir(cache, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = path.join(cache, entry.name, "node_modules", "vercel");
    const info = await readFile(path.join(packageDir, "package.json"), "utf8").then(JSON.parse).catch(() => null);
    if (info) candidates.push({ version: info.version, filename: path.join(packageDir, "dist", "index.js") });
  }
  candidates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  assert(candidates.length, "Install or authenticate Vercel CLI first");
  return candidates[0].filename;
}

async function runCli(args, input) {
  const filename = await cliPath();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [filename, ...args], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function setup() {
  const project = JSON.parse(await readFile(".vercel/project.json", "utf8"));
  assert(project.projectName === "ct-noi-bo" && project.projectId === "prj_eVAMgL2HJS9ncEB13RLeJ8XRURWP" && project.orgId === "team_P6ZUPEQGflrU8soIrX7UPUVD", "Unexpected Vercel destination");
  const branch = spawnSync("git", ["branch", "--show-current"], { encoding: "utf8", windowsHide: true }).stdout.trim();
  assert(branch === "feat/dev-staging-test-platform", "Test configuration is restricted to the approved preview branch");
  const source = parseEnv(await readFile(".env.e2e.local", "utf8"));
  assertTestConfiguration(source, ".env.e2e.local");
  const env = Object.fromEntries(TEST_CONFIG_KEYS.filter((key) => source[key]).map((key) => [key, source[key]]));
  const publicKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || source.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = source.SUPABASE_SECRET_KEY || source.SUPABASE_SERVICE_ROLE_KEY;
  Object.assign(env, {
    APP_ENV: "test", RELEASE_ENVIRONMENT: "test", TEST_TOOLS_ENABLED: "true",
    E2E_DATABASE_KIND: "preview", APP_BASE_URL: `https://${alias}`, E2E_BASE_URL: `https://${alias}`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey, NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
    SUPABASE_SECRET_KEY: serviceKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey
  });
  delete env.STAGING_ACCESS_USER;
  delete env.STAGING_ACCESS_PASSWORD;
  return { project, branch, env };
}

async function api(project, endpoint, method = "GET", body) {
  const args = ["api", endpoint, "--method", method, "--raw", "--scope", project.orgId];
  let inputFile;
  if (body !== undefined) {
    await mkdir(".tmp", { recursive: true });
    inputFile = path.join(".tmp", `vercel-request-${randomUUID()}.private.json`);
    await writeFile(inputFile, JSON.stringify(body), { mode: 0o600, flag: "wx" });
    args.push("--input", inputFile, "--header", "Content-Type: application/json");
  }
  let result;
  try { result = await runCli(args); }
  finally { if (inputFile) await unlink(inputFile); }
  if (result.code !== 0) {
    let detail = result.stderr.split(/\r?\n/).filter((line) => line.startsWith("Error:")).join(" ");
    const values = Array.isArray(body) ? body.map((item) => item.value) : [];
    for (const value of values.filter((value) => typeof value === "string" && value.length >= 8)) detail = detail.replaceAll(value, "[redacted]");
    throw new Error(`Vercel ${method} request failed (exit ${result.code}): ${detail.slice(0, 500) || "response withheld"}`);
  }
  return JSON.parse(result.stdout.trim());
}

async function inspectAlias(project) {
  const result = await runCli(["api", `/v4/aliases/${alias}`, "--raw", "--scope", project.orgId]);
  if (result.code === 0) return JSON.parse(result.stdout.trim());
  assert(/(?:\b404\b|alias[^\n]*not found)/i.test(result.stderr + result.stdout), "Could not safely inspect ownership of the test alias");
  return null;
}

async function assertPublicTestPreview(project, deployment, expected) {
  assert(deployment.projectId === project.projectId && deployment.readyState === "READY"
    && deployment.target !== "production" && !deployment.customEnvironment,
  "Only this project's ready standard Preview can be made public");
  assert(deployment.readySubstate !== "PROMOTED" && deployment.readySubstate !== "ROLLING", "A deployment that has received production traffic cannot be made public here");
  const createdAt = Number(deployment.createdAt);
  assert(Number.isFinite(createdAt) && createdAt > 0, "Preview creation time is required to verify its configuration");
  const response = await api(project, `/v10/projects/${project.projectId}/env?decrypt=false`);
  const rows = response.envs || response.env || [];
  const required = Object.keys(expected);
  const scoped = [];
  for (const key of required) {
    const matching = rows.filter((row) => row.key === key && row.target?.includes("preview"));
    assert(matching.length === 1 && !matching[0].gitBranch && !matching[0].customEnvironmentIds?.length,
      `Preview variable ${key} must have one unambiguous standard Preview configuration`);
    const row = matching[0];
    assert(Array.isArray(row.target) && row.target.length === 1 && row.target[0] === "preview", `Variable ${key} must be restricted to Preview`);
    const changedAt = Number(row.updatedAt || row.createdAt);
    assert(Number.isFinite(changedAt) && changedAt <= createdAt, `Preview variable ${key} changed after this deployment; create a new Preview first`);
    scoped.push(row);
  }
  assert(Array.isArray(deployment.env) && required.every((key) => deployment.env.includes(key)), "Deployment must contain the configured test environment variables");
  // Sensitive values cannot be read back. Isolation is verified from the public
  // database/config values, the locally validated secrets, and creation times.
  const readable = scoped.filter((row) => row.visibility === "config" || (!row.visibility && ["encrypted", "plain"].includes(row.type)));
  const needed = ["APP_ENV", "RELEASE_ENVIRONMENT", "TEST_TOOLS_ENABLED", "E2E_DATABASE_KIND", "NEXT_PUBLIC_SUPABASE_URL",
    "TEST_SUPABASE_URL", "E2E_SUPABASE_URL", "TEST_SUPABASE_PROJECT_ID", "PRODUCTION_SUPABASE_URL",
    "PRODUCTION_SERVICE_KEY_SHA256", "PRODUCTION_SESSION_SECRET_SHA256", "APP_BASE_URL", "E2E_BASE_URL"];
  assert(needed.every((key) => readable.some((row) => row.key === key)), "Test environment flags and database isolation markers must be readable config values; use configure-public-marker for the release marker and deploy a new Preview");
  const actual = {};
  for (let offset = 0; offset < readable.length; offset += 3) {
    const values = await Promise.all(readable.slice(offset, offset + 3).map((row) => api(project, `/v1/projects/${project.projectId}/env/${encodeURIComponent(row.id)}`)));
    for (const row of values) {
      assert(row && required.includes(row.key) && typeof row.value === "string" && row.value === expected[row.key], `Preview configuration mismatch for ${row?.key || "unknown variable"}`);
      actual[row.key] = row.value;
    }
  }
  assert(actual.APP_ENV === "test" && actual.RELEASE_ENVIRONMENT === "test" && actual.TEST_TOOLS_ENABLED === "true", "The public Preview must use the test environment");
  assert(actual.TEST_SUPABASE_PROJECT_ID === "lgmlkagcytfjazulgfbz", "Public alias is restricted to the approved test database");
  const database = new URL(actual.NEXT_PUBLIC_SUPABASE_URL);
  assert(database.protocol === "https:" && database.hostname === `${actual.TEST_SUPABASE_PROJECT_ID}.supabase.co`
    && database.href === new URL(actual.TEST_SUPABASE_URL).href && database.href === new URL(actual.E2E_SUPABASE_URL).href
    && database.hostname !== new URL(actual.PRODUCTION_SUPABASE_URL).hostname, "Public Preview database must be isolated from production");
}

async function main() {
  const action = process.argv[2] || "plan";
  const { project, branch, env } = await setup();
  const variables = Object.entries(env).map(([key, value]) => ({ key, value }));
  if (action === "plan") {
    console.log(JSON.stringify({ project: project.projectName, teamId: project.orgId, branch, target: "preview", databaseProject: env.TEST_SUPABASE_PROJECT_ID, alias, keys: variables.map(({ key }) => key) }));
    return;
  }
  if (action === "dry") {
    const result = await runCli(["deploy", "--dry", "--json", "--yes", "--scope", project.orgId]);
    assert(result.code === 0, "Vercel deployment input inspection failed");
    const report = JSON.parse(result.stdout.trim());
    await mkdir(".tmp", { recursive: true });
    await writeFile(".tmp/vercel-dry.private.json", JSON.stringify(report), { mode: 0o600 });
    console.log(JSON.stringify({ inspected: true, reportKeys: Object.keys(report) }));
    return;
  }
  if (action === "inspect") {
    const response = await api(project, `/v10/projects/${project.projectId}/env?decrypt=false`);
    const rows = response.envs || response.env || [];
    const scoped = rows.filter((row) => !row.gitBranch && row.target?.includes("preview"));
    const missing = variables.map(({ key }) => key).filter((key) => !scoped.some((row) => row.key === key));
    assert(!missing.length, `Preview is missing keys: ${missing.join(", ")}`);
    console.log(JSON.stringify({ configured: variables.length, target: "preview", isolatedDatabase: env.TEST_SUPABASE_PROJECT_ID, privateKeysStoredAsSecrets: scoped.filter((row) => row.type === "sensitive").length }));
    return;
  }
  if (action === "alias-status") {
    const existing = await inspectAlias(project);
    console.log(JSON.stringify({ alias, exists: Boolean(existing), projectId: existing?.projectId }));
    return;
  }
  if (action === "configure-public-marker") {
    // The existing Preview already has isolated test credentials. This narrow
    // action changes only a nonsecret marker and never uploads credential values.
    const result = await runCli(["env", "add", "RELEASE_ENVIRONMENT", "preview", "--force", "--type", "config", "--yes", "--scope", project.orgId], "test\n");
    assert(result.code === 0, `Could not configure the Preview release marker (exit ${result.code})`);
    console.log(JSON.stringify({ configured: "RELEASE_ENVIRONMENT", value: "test", type: "config", target: "preview", branch }));
    return;
  }
  if (action === "configure") {
    let configured = 0;
    for (const { key, value } of variables) {
      const type = key.startsWith("NEXT_PUBLIC_") || /(?:URL|ENV|ENVIRONMENT|TIMEZONE|ENABLED|PROJECT_ID|SHA256|DATABASE_KIND)$/.test(key) ? "config" : "secret";
      const result = await runCli(["env", "add", key, "preview", "--force", "--type", type, "--yes", "--scope", project.orgId], value + "\n");
      if (result.code !== 0) {
        let detail = result.stderr + "\n" + result.stdout;
        for (const entry of variables.filter((entry) => entry.value.length >= 8)) detail = detail.replaceAll(entry.value, "[redacted]");
        detail = detail.replace(/(?:sb_secret_|sbp_|Bearer )[A-Za-z0-9._-]+/g, "[redacted]");
        throw new Error(`Vercel rejected scoped preview variable ${key}: ${detail.slice(-1000).trim() || "secret value withheld"}`);
      }
      configured++;
      if (configured === 1 || configured % 5 === 0) console.log(JSON.stringify({ configured, total: variables.length, branch }));
    }
    console.log(JSON.stringify({ configured, branch, target: "preview", databaseProject: env.TEST_SUPABASE_PROJECT_ID }));
    return;
  }
  if (action === "public") {
    const deploymentId = process.argv[3];
    assert(/^dpl_[A-Za-z0-9]+$/.test(deploymentId || ""), "Provide the ready preview deployment ID");
    const deployment = await api(project, `/v13/deployments/${deploymentId}`);
    await assertPublicTestPreview(project, deployment, env);
    const existing = await inspectAlias(project);
    assert(!existing || existing.projectId === project.projectId, "Test alias belongs to a different project");
    const previousId = existing?.deploymentId || existing?.deployment?.id;
    if (previousId && previousId !== deploymentId) {
      const previous = await api(project, `/v13/deployments/${previousId}`);
      assert(previous.target !== "production", "The test alias must not currently point to production");
    }
    const aliasResult = await runCli(["alias", "set", deployment.url, alias, "--scope", project.orgId]);
    assert(aliasResult.code === 0, "Could not assign the test preview alias");
    const assigned = await inspectAlias(project);
    assert(assigned?.projectId === project.projectId && (assigned.deploymentId || assigned.deployment?.id) === deploymentId, "Test alias assignment could not be verified");
    // Vercel OpenAPI oneOf explicitly separates this per-alias public exception
    // from shareable links. Never change project-wide protection settings.
    let published = assigned;
    if (!Object.values(published?.protectionBypass || {}).some((entry) => entry?.scope === "alias-protection-override")) {
      await api(project, `/aliases/${alias}/protection-bypass`, "PATCH", { override: { scope: "alias-protection-override", action: "create" } });
      published = await inspectAlias(project);
    }
    assert(Object.values(published?.protectionBypass || {}).some((entry) => entry?.scope === "alias-protection-override"), "Vercel did not confirm the public exception for the test alias");
    const now = Date.now();
    const expiresAt = new Date(now + lifetimeSeconds * 1000).toISOString();
    const url = new URL(`https://${alias}/testing`);
    url.hash = new URLSearchParams({ access: createTesterInvitation(env, now, lifetimeSeconds * 1000) }).toString();
    await mkdir(".tmp", { recursive: true });
    await writeFile(accessFile, JSON.stringify({ url: url.href, publicUrl: `https://${alias}`, deploymentId, databaseProject: env.TEST_SUPABASE_PROJECT_ID, expiresAt }, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ ready: true, public: true, alias, deploymentId, expiresAt, accessFile }));
    return;
  }
  if (action === "share") {
    const deploymentId = process.argv[3];
    assert(/^dpl_[A-Za-z0-9]+$/.test(deploymentId || ""), "Provide the ready preview deployment ID");
    const deployment = await api(project, `/v13/deployments/${deploymentId}`);
    assert(deployment.projectId === project.projectId && deployment.target !== "production" && deployment.readyState === "READY", "Only this project's ready preview can be shared");
    const existing = await inspectAlias(project);
    assert(!existing || existing.projectId === project.projectId, "Test alias belongs to a different project");
    const aliasResult = await runCli(["alias", "set", deployment.url, alias, "--scope", project.orgId]);
    assert(aliasResult.code === 0, "Could not assign the test preview alias");
    await mkdir(".tmp", { recursive: true });
    const saved = await readFile(".tmp/vercel-share.private.json", "utf8").then(JSON.parse).catch(() => null);
    const grant = saved?.alias === alias && saved.deploymentId === deploymentId
      ? saved.grant
      : await api(project, `/aliases/${alias}/protection-bypass`, "PATCH", { ttl: lifetimeSeconds });
    await writeFile(".tmp/vercel-share.private.json", JSON.stringify({ alias, deploymentId, grant }), { mode: 0o600 });
    const sharedEntry = Object.entries(grant?.protectionBypass || {}).find(([, value]) => value?.scope === "shareable-link");
    const share = typeof grant === "string" ? grant : grant?.secret || sharedEntry?.[0];
    assert(typeof share === "string" && share.length >= 8, `Unexpected share response shape: ${JSON.stringify(Object.keys(grant || {}))}`);
    const now = Date.now();
    const expiry = sharedEntry?.[1]?.expires;
    const expiryValue = typeof expiry === "string" && !/^\d+$/.test(expiry) ? Date.parse(expiry) : Number(expiry);
    const expiresAt = Number.isFinite(expiryValue) ? (expiryValue < 1e12 ? expiryValue * 1000 : expiryValue) : now + lifetimeSeconds * 1000;
    const remaining = Math.min(lifetimeSeconds * 1000, expiresAt - now);
    assert(remaining > 0, "Existing preview share link has expired");
    const url = new URL(`https://${alias}/testing`);
    url.searchParams.set("_vercel_share", share);
    url.hash = new URLSearchParams({ access: createTesterInvitation(env, now, remaining) }).toString();
    await mkdir(".tmp", { recursive: true });
    await writeFile(accessFile, JSON.stringify({ url: url.href, deploymentId, databaseProject: env.TEST_SUPABASE_PROJECT_ID, expiresAt: new Date(expiresAt).toISOString() }, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({ ready: true, alias, expiresAt: new Date(expiresAt).toISOString(), accessFile }));
    return;
  }
  throw new Error("Use plan, dry, inspect, alias-status, configure-public-marker, configure, public, or share");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
