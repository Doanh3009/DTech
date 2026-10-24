import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The runner starts and connects only to its own fresh loopback cluster.
// It does not read DATABASE_URL, Supabase credentials or an existing cluster.
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pgRequire = createRequire(path.join(workspace, ".tmp/erp-postgres/package.json"));
const { Client } = pgRequire("pg");
const runDirectory = path.join(workspace, ".tmp/erp-lifecycle-db", randomUUID());
const dataDirectory = path.join(runDirectory, "data");
const migrations = ["202610220002_account_lifecycle_recovery.sql", "202610220003_atomic_employee_auxiliary.sql"];
const output = path.join(workspace, "docs/commercial-erp/evidence/atomic-lifecycle-integration.json");
const binaryRoot = process.env.ERP_TEST_PG_BIN;
if (!binaryRoot && process.platform !== "win32") throw new Error("Set ERP_TEST_PG_BIN to a PostgreSQL 17 bin directory.");
const binaries = binaryRoot ? {
  initdb: path.join(binaryRoot, process.platform === "win32" ? "initdb.exe" : "initdb"),
  pg_ctl: path.join(binaryRoot, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl")
} : await import(pathToFileURL(pgRequire.resolve("@embedded-postgres/windows-x64")).href);
const account = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const employee = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = account(1);
const tests = [];
const clients = [];
const baselineMigrations = [];
const appliedMigrations = new Map();
let config;
let started = false;
let evidence;

function runBinary(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspace, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let messages = "";
    child.stdout.on("data", (data) => { messages += data; });
    child.stderr.on("data", (data) => { messages += data; });
    child.on("error", reject);
    child.on("exit", (code) => {
      child.stdout.destroy(); child.stderr.destroy();
      if (code === 0) resolve(messages);
      else reject(new Error(`PostgreSQL binary failed (${code}): ${messages}`));
    });
  });
}
async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
async function connect(name) {
  const client = new Client({ ...config, application_name: `lifecycle-integration-${name}`, statement_timeout: 10000 });
  await client.connect(); clients.push(client); return client;
}
async function baseline(db, filename, start, end) {
  const source = await readFile(path.join(workspace, "supabase/migrations", filename), "utf8");
  let applied = source;
  if (start || end) {
    const from = start ? source.indexOf(start) : 0;
    const until = end ? source.indexOf(end, from) : source.length;
    assert(from >= 0 && until > from, `Baseline fragment markers: ${filename}`);
    applied = source.slice(from, until);
  }
  await db.query(applied);
  baselineMigrations.push({ filename, wholeFile: !start && !end, sourceSha256: createHash("sha256").update(source).digest("hex"), appliedSha256: createHash("sha256").update(applied).digest("hex") });
}
async function patch(db, values = {}, options = {}) {
  const { rows } = await db.query("select public.patch_employee_profile_command($1::uuid,$2::integer,$3::jsonb,$4::uuid,$5::date,$6::text) as version", [
    options.employee === undefined ? employee(3) : options.employee,
    options.version === undefined ? 1 : options.version,
    values,
    options.actor === undefined ? actor : options.actor,
    options.eventDate === undefined ? "2026-10-22" : options.eventDate,
    options.reason === undefined ? "Integration profile update" : options.reason
  ]);
  return rows[0].version;
}
async function status(db, target, value, who = actor, reason = "Integration account status") {
  const { rows } = await db.query("select to_jsonb(public.set_app_account_status($1::uuid,$2::text,$3::uuid,$4::text)) as account", [target, value, who, reason]);
  return rows[0].account;
}
async function roles(db, target, values, who = actor) {
  await db.query("select public.replace_app_account_roles($1::uuid,$2::uuid[],$3::uuid)", [target, values, who]);
}
async function provision(db, target, who = actor) {
  const { rows } = await db.query("select public.provision_app_account($1::uuid,$2::uuid,$3,$4,$5,$6,$7::uuid[],$8::uuid,$9::date) as id", [randomUUID(), target, `integration_new_${randomUUID().slice(0, 8)}`, "Integration provisioned", "integration@example.invalid", null, [roleIds.employee], who, "2026-10-22"]);
  return rows[0].id;
}
async function rejects(operation, token, code = "P0001") {
  await assert.rejects(operation, (error) => error.code === code && (token === null || error.message === token));
}
async function state(db) {
  const { rows } = await db.query(`select jsonb_build_object(
    'employees',(select jsonb_agg(to_jsonb(e) order by id) from public.employees e),
    'accounts',(select jsonb_agg(to_jsonb(a) order by id) from public.app_accounts a),
    'roles',(select jsonb_agg(to_jsonb(r) order by account_id,role_id) from public.account_roles r),
    'sessions',(select jsonb_agg(to_jsonb(s) order by id) from public.app_sessions s),
    'identities',(select coalesce(jsonb_agg(to_jsonb(u) order by id),'[]') from auth.users u),
    'sensitive',(select coalesce(jsonb_agg(to_jsonb(s) order by employee_id),'[]') from public.employee_sensitive_profiles s),
    'operations',(select coalesce(jsonb_agg(to_jsonb(o) order by request_id),'[]') from public.account_lifecycle_operations o),
    'history',(select coalesce(jsonb_agg(to_jsonb(h) order by id),'[]') from public.employee_history_events h),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.audit_logs a)
  ) as state`);
  return rows[0].state;
}
async function test(db, name, operation, transaction = true) {
  if (transaction) await db.query("begin");
  try {
    await operation(); tests.push({ name, passed: true }); process.stdout.write(`PASS ${name}\n`);
  } finally { if (transaction) await db.query("rollback"); }
}
// SQL errors abort a transaction. A savepoint allows the boundary/rollback
// assertions to inspect the same fixture after an expected command failure.
async function rejectedCommand(db, operation, token, code = "P0001") {
  await db.query("savepoint expected_failure");
  try { await rejects(operation, token, code); }
  finally { await db.query("rollback to savepoint expected_failure"); await db.query("release savepoint expected_failure"); }
}
async function observeWait(observer, name = "parallel") {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { rows } = await observer.query("select wait_event_type from pg_stat_activity where application_name=$1", [`lifecycle-integration-${name}`]);
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Parallel command did not wait on the expected database lock.");
}
let roleIds;

try {
  await mkdir(runDirectory, { recursive: true });
  const password = randomUUID();
  const passwordFile = path.join(runDirectory, "password");
  await writeFile(passwordFile, password, { mode: 0o600 });
  await runBinary(binaries.initdb, ["-D", dataDirectory, "-U", "postgres", "--auth=scram-sha-256", "--pwfile", passwordFile, "--encoding=UTF8", "--locale=C"]);
  const port = await availablePort();
  await runBinary(binaries.pg_ctl, ["-D", dataDirectory, "-l", path.join(runDirectory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -c max_connections=20`, "-w", "start"]);
  started = true;
  config = { host: "127.0.0.1", port, user: "postgres", password, database: "postgres" };
  const db = await connect("main");
  const parallel = await connect("parallel");
  const observer = await connect("observer");
  await db.query(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create role supabase_auth_admin nologin;
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid';
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb not null default '{}'::jsonb);
    grant usage on schema auth to supabase_auth_admin;
    grant select,insert,update,delete on auth.users to supabase_auth_admin;`);
  await baseline(db, "202609090001_foundation_system_primitives.sql");
  await baseline(db, "202609090002_employee_rbac_foundation.sql");
  await baseline(db, "202609150001_production_hardening.sql", null, "create table if not exists public.operational_job_runs");
  await db.query("alter table public.app_sessions enable row level security");
  await baseline(db, "202609150002_username_auth.sql");
  await baseline(db, "202609120004_shared_platforms.sql", "alter table public.audit_logs add column if not exists actor_employee_id", "create or replace function public.touch_shared_platform_updated_at()");
  await baseline(db, "202609160001_functional_completion.sql", "alter table public.employees add column if not exists probation_end_date", "alter table public.employee_contracts add column if not exists signed_date");
  await baseline(db, "202609180002_employee_personal_profile.sql");
  await baseline(db, "202609240001_atomic_role_and_account_provisioning.sql", null, "alter table public.project_update_attachments");
  await db.query(await readFile(path.join(workspace, "supabase/tests/atomic-employee.fixture.sql"), "utf8"));
  await baseline(db, "202610220001_atomic_employee_profile.sql");
  for (const migration of migrations) {
    const source = await readFile(path.join(workspace, "supabase/migrations", migration), "utf8");
    await db.query(source); appliedMigrations.set(migration, source);
  }
  await db.query(await readFile(path.join(workspace, "supabase/tests/atomic-lifecycle.fixture.sql"), "utf8"));
  roleIds = Object.fromEntries((await db.query("select code,id from public.roles")).rows.map((r) => [r.code, r.id]));

  const { runCases } = await import("./atomic-lifecycle.cases.mjs");
  await runCases({ db, parallel, observer, test, rejectedCommand, state, account, employee, actor, patch, status, roles, provision, roleIds, observeWait });

  const hashFile = async (relative) => createHash("sha256").update(await readFile(path.join(workspace, relative))).digest("hex");
  const migrationEvidence = await Promise.all(migrations.map(async (filename) => {
    assert.equal(await readFile(path.join(workspace, "supabase/migrations", filename), "utf8"), appliedMigrations.get(filename), `Migration changed during execution: ${filename}`);
    return { filename, sha256: createHash("sha256").update(appliedMigrations.get(filename)).digest("hex") };
  }));
  const sources = ["supabase/tests/atomic-lifecycle.integration.mjs", "supabase/tests/atomic-lifecycle.cases.mjs", "supabase/tests/atomic-lifecycle.fixture.sql", "supabase/tests/atomic-employee.fixture.sql"];
  evidence = {
    generatedAt: new Date().toISOString(), postgresVersion: (await db.query("show server_version")).rows[0].server_version,
    scope: "Native PostgreSQL 17 isolated disposable loopback cluster; actual foundation/HR/account migrations and exact later fragments plus deployed employee command. Auth UID is a null stub; no external Auth creation/deletion, GoTrue, Storage or Realtime and not a full Supabase stack rehearsal.",
    migrations: migrationEvidence,
    sources: await Promise.all(sources.map(async (filename) => ({ filename, sha256: await hashFile(filename) }))),
    baselineMigrations, passed: tests.length, failed: 0, cloudAccess: false, productionWrites: false, externalAuthExercised: false, tests
  };

} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
  if (started) {
    await runBinary(binaries.pg_ctl, ["-D", dataDirectory, "-w", "-m", "fast", "stop"]);
    process.stdout.write("Disposable PostgreSQL cluster stopped.\n");
  }
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ ...evidence, clusterStopped: true }, null, 2)}\n`);
process.stdout.write(`Atomic lifecycle PostgreSQL integration: ${tests.length} passed.\n`);
