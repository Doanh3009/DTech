import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// No DATABASE_URL, Supabase environment files, or existing clusters are read.
// The only database this runner can connect to is its own new loopback cluster.
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dependencyRoot = path.join(workspace, ".tmp", "erp-postgres");
const runDirectory = path.join(workspace, ".tmp", "erp-settings-db", randomUUID());
const dataDirectory = path.join(runDirectory, "data");
const output = path.join(workspace, "docs/commercial-erp/evidence/atomic-settings-integration.json");
const pgRequire = createRequire(path.join(dependencyRoot, "package.json"));
const { Client } = pgRequire("pg");
const binaryPackage = process.platform === "win32" ? "@embedded-postgres/windows-x64" : null;
const binaryRoot = process.env.ERP_TEST_PG_BIN;
if (!binaryRoot && !binaryPackage) throw new Error("Set ERP_TEST_PG_BIN to a PostgreSQL 17 bin directory.");
const binaries = binaryRoot
  ? { initdb: path.join(binaryRoot, process.platform === "win32" ? "initdb.exe" : "initdb"), pg_ctl: path.join(binaryRoot, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl") }
  : await import(pathToFileURL(pgRequire.resolve(binaryPackage)).href);

function runBinary(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: workspace, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let messages = "";
    child.stdout.on("data", (data) => { messages += data; });
    child.stderr.on("data", (data) => { messages += data; });
    child.on("error", reject);
    // On Windows a spawned postgres can inherit pipe handles from pg_ctl.
    // The controller's exit, rather than pipe EOF, completes this operation.
    child.on("exit", (code) => {
      child.stdout.destroy();
      child.stderr.destroy();
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

function registryArray(source, name) {
  const declaration = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`));
  if (!declaration) throw new Error(`Missing registry ${name}`);
  return [...declaration[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

const settingsSource = await readFile(path.join(workspace, "src/config/systemSettings.ts"), "utf8");
const dashboardSource = await readFile(path.join(workspace, "src/features/dashboard/types.ts"), "utf8");
const navigationPaths = registryArray(settingsSource, "configurableNavigationPaths");
const profiles = registryArray(dashboardSource, "dashboardProfileKeys");
const snapshots = {
  branding: { systemName: "Integration ERP", loginSubtitle: "", logoMainUrl: null, logoCompactUrl: null, logoDarkUrl: null, faviconUrl: null, assetVersion: 0 },
  appearance: { primaryColor: "#0F766E", density: "standard", tableDensity: "standard", defaultPageSize: 20, sidebarDefault: "expanded", appearanceMode: "light" },
  organization: { companyName: "Integration Company", shortName: "TEST", address: "", phone: "", email: "", taxCode: "", representativeName: "" },
  localization: { timezone: "Asia/Ho_Chi_Minh", dateFormat: "DD/MM/YYYY", timeFormat: "HH:mm", weekStartsOn: "monday", locale: "vi-VN" },
  navigation: { hiddenItems: [], itemOrder: navigationPaths, defaultLandingPage: "/applications", groupsExpanded: true },
  dashboard: { presetOrder: profiles, presets: profiles.map((profile) => ({ profile, landingPage: "/applications", enabledWidgets: [] })) },
  modules: { human_resources: true, attendance: true, projects: false, warehouse: false, import_export: false, accounting: true, operations: true, reports: true, messaging: true, industryPreset: "services" },
  payslip: { companyName: "Integration Company", title: "Payslip", footer: "", primaryColor: "#0F766E", showWorkDays: true, showBaseSalary: true, showAllowance: true, showBonus: true, showDeduction: true }
};
const actor = "20000000-0000-4000-8000-000000000001";
const actors = { limited: "20000000-0000-4000-8000-000000000002", noAccess: "20000000-0000-4000-8000-000000000003", disabled: "20000000-0000-4000-8000-000000000004", other: "20000000-0000-4000-8000-000000000005", restoreOnly: "20000000-0000-4000-8000-000000000006" };
const fourGroups = Object.fromEntries(["branding", "organization", "localization", "modules"].map((key) => [key, snapshots[key]]));
const tests = [];
const clients = [];
let started = false;
let config;
let evidence;

async function connect(name) {
  const client = new Client({ ...config, application_name: `settings-integration-${name}`, statement_timeout: 10000 });
  await client.connect();
  clients.push(client);
  return client;
}
async function test(name, operation) {
  await operation();
  tests.push({ name, passed: true });
  process.stdout.write(`PASS ${name}\n`);
}
async function expected(db, groups) {
  const { rows } = await db.query("select group_key, version from public.system_settings where group_key = any($1::text[])", [Object.keys(groups)]);
  return Object.fromEntries(Object.keys(groups).map((key) => [key, rows.find((row) => row.group_key === key)?.version ?? 0]));
}
async function publish(db, groups, versions, options = {}) {
  const { rows } = await db.query("select public.publish_system_settings_command($1::uuid,$2::uuid,$3::jsonb,$4::jsonb,$5::text) as receipt", [
    options.actor === undefined ? actor : options.actor,
    options.request === undefined ? randomUUID() : options.request,
    groups, versions, options.changeType === undefined ? "publish" : options.changeType
  ]);
  return rows[0].receipt;
}
async function rejects(operation, token, code = "P0001") {
  await assert.rejects(operation, (error) => error.code === code && (token === null || error.message === token));
}
async function databaseState(db) {
  const { rows } = await db.query(`select jsonb_build_object(
    'settings',(select coalesce(jsonb_agg(to_jsonb(s) order by group_key),'[]') from public.system_settings s),
    'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by group_key,version),'[]') from public.settings_versions v),
    'audits',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.audit_logs a),
    'commands',(select coalesce(jsonb_agg(to_jsonb(c) order by request_id),'[]') from public.system_settings_commands c)
  ) as state`);
  return rows[0].state;
}

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
  await db.query(await readFile(path.join(workspace, "supabase/tests/atomic-settings.fixture.sql"), "utf8"));
  await db.query(await readFile(path.join(workspace, "supabase/migrations/202610210002_atomic_system_settings.sql"), "utf8"));

  await test("database validator accepts all eight current registry snapshots", async () => {
    for (const [key, value] of Object.entries(snapshots)) {
      const { rows } = await db.query("select public.is_valid_system_settings_command_group($1,$2) as valid", [key, value]);
      assert.equal(rows[0].valid, true, key);
    }
  });
  await test("anonymous and authenticated roles cannot execute command or read receipts", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set role ${role}`);
      try {
        await rejects(() => publish(db, fourGroups, { branding: 0, organization: 0, localization: 0, modules: 0 }), null, "42501");
        await rejects(() => db.query("select * from public.system_settings_commands"), null, "42501");
      } finally { await db.query("reset role"); }
    }
    const { rows } = await db.query("select relrowsecurity from pg_class where oid='public.system_settings_commands'::regclass");
    assert.equal(rows[0].relrowsecurity, true);
  });
  await test("broad default table privileges cannot grant direct service-role receipt writes", async () => {
    const { rows: inherited } = await db.query("select has_table_privilege('service_role','public.system_settings','INSERT') as writable");
    assert.equal(inherited[0].writable, true, "fixture must simulate broad default privileges");
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]) {
        const { rows } = await db.query("select has_table_privilege($1,'public.system_settings_commands',$2) as allowed", [role, privilege]);
        assert.equal(rows[0].allowed, role === "service_role" && privilege === "SELECT", `${role} ${privilege}`);
      }
    }
    await db.query("set role service_role");
    try {
      await rejects(() => db.query("insert into public.system_settings_commands(request_id,actor_account_id,payload_hash,receipt) values($1,$2,$3,'{}')", [randomUUID(), actor, "a".repeat(64)]), null, "42501");
      await rejects(() => db.query("update public.system_settings_commands set receipt='{}'"), null, "42501");
      await rejects(() => db.query("delete from public.system_settings_commands"), null, "42501");
      await rejects(() => db.query("truncate public.system_settings_commands"), null, "42501");
    } finally { await db.query("reset role"); }
  });

  let firstReceipt;
  const firstRequest = randomUUID();
  const zeroVersions = { branding: 0, organization: 0, localization: 0, modules: 0 };
  await test("service role atomically initializes four missing groups, histories, audits and receipt", async () => {
    await db.query("set role service_role");
    try { firstReceipt = await publish(db, fourGroups, zeroVersions, { request: firstRequest }); }
    finally { await db.query("reset role"); }
    assert.deepEqual(firstReceipt, { requestId: firstRequest, versions: { branding: 1, organization: 1, localization: 1, modules: 1 } });
    const state = await databaseState(db);
    assert.equal(state.settings.length, 4);
    assert.equal(state.versions.length, 4);
    assert.equal(state.audits.length, 4);
    assert.equal(state.commands.length, 1);
    for (const audit of state.audits) {
      assert.equal(audit.actor_account_id, actor);
      assert.equal(audit.before_data, null);
      assert.equal(audit.metadata.requestId, firstRequest);
      assert.deepEqual(audit.after_data, fourGroups[audit.entity_id]);
      assert.equal(audit.source, "web");
      assert.equal(audit.severity, "normal");
      assert.equal(audit.actor_employee_id, null);
    }
  });
  await test("service role can read a receipt but cannot alter or remove it", async () => {
    const before = await databaseState(db);
    await db.query("set role service_role");
    try {
      const { rows } = await db.query("select receipt from public.system_settings_commands where request_id=$1", [firstRequest]);
      assert.deepEqual(rows[0].receipt, firstReceipt);
      await rejects(() => db.query("update public.system_settings_commands set receipt='{}' where request_id=$1", [firstRequest]), null, "42501");
      await rejects(() => db.query("delete from public.system_settings_commands where request_id=$1", [firstRequest]), null, "42501");
    } finally { await db.query("reset role"); }
    assert.deepEqual(await databaseState(db), before);
  });
  await test("existing append-only audit protection remains compatible with command inserts", async () => {
    const before = await databaseState(db);
    await rejects(() => db.query("update public.audit_logs set source='test'"), "AUDIT_LOG_APPEND_ONLY");
    await rejects(() => db.query("delete from public.audit_logs"), "AUDIT_LOG_APPEND_ONLY");
    assert.deepEqual(await databaseState(db), before);
  });
  await test("identical retry returns original receipt despite now-stale expected versions", async () => {
    const before = await databaseState(db);
    assert.deepEqual(await publish(db, fourGroups, zeroVersions, { request: firstRequest }), firstReceipt);
    assert.deepEqual(await databaseState(db), before);
  });
  await test("object key ordering does not change an idempotent receipt", async () => {
    const before = await databaseState(db);
    const reordered = Object.fromEntries(Object.entries(fourGroups).reverse().map(([key, value]) => [key, Object.fromEntries(Object.entries(value).reverse())]));
    assert.deepEqual(await publish(db, reordered, Object.fromEntries(Object.entries(zeroVersions).reverse()), { request: firstRequest }), firstReceipt);
    assert.deepEqual(await databaseState(db), before);
  });
  await test("request reuse with changed payload, expected version, actor or action conflicts", async () => {
    const before = await databaseState(db);
    await rejects(() => publish(db, { ...fourGroups, branding: { ...snapshots.branding, systemName: "Changed name" } }, zeroVersions, { request: firstRequest }), "SETTINGS_REQUEST_CONFLICT");
    await rejects(() => publish(db, fourGroups, { ...zeroVersions, branding: 1 }, { request: firstRequest }), "SETTINGS_REQUEST_CONFLICT");
    await rejects(() => publish(db, fourGroups, zeroVersions, { request: firstRequest, actor: actors.other }), "SETTINGS_REQUEST_CONFLICT");
    await rejects(() => publish(db, fourGroups, zeroVersions, { request: firstRequest, changeType: "restore" }), "SETTINGS_REQUEST_CONFLICT");
    assert.deepEqual(await databaseState(db), before);
  });

  for (const [name, actorId, changeType] of [
    ["partial group permissions", actors.limited, "publish"], ["no console permission", actors.noAccess, "publish"],
    ["disabled actor", actors.disabled, "publish"], ["missing actor", randomUUID(), "publish"],
    ["restore permission without group management", actors.restoreOnly, "restore"],
    ["group management without restore permission", actors.limited, "restore"]
  ]) await test(`reject ${name} without writes`, async () => {
    const before = await databaseState(db);
    await rejects(() => publish(db, fourGroups, { branding: 1, organization: 1, localization: 1, modules: 1 }, { actor: actorId, changeType }), "SETTINGS_ACTOR_FORBIDDEN");
    assert.deepEqual(await databaseState(db), before);
  });
  await test("authorization is rechecked on an otherwise identical retry", async () => {
    await db.query("update public.app_accounts set status='disabled' where id=$1", [actor]);
    try { await rejects(() => publish(db, fourGroups, zeroVersions, { request: firstRequest }), "SETTINGS_ACTOR_FORBIDDEN"); }
    finally { await db.query("update public.app_accounts set status='active' where id=$1", [actor]); }
  });
  await test("revoked group permission also blocks a previously successful retry", async () => {
    await db.query("delete from public.role_permissions where role_id='10000000-0000-4000-8000-000000000001' and permission_key='module.manage'");
    try { await rejects(() => publish(db, fourGroups, zeroVersions, { request: firstRequest }), "SETTINGS_ACTOR_FORBIDDEN"); }
    finally { await db.query("insert into public.role_permissions(role_id,permission_key) values('10000000-0000-4000-8000-000000000001','module.manage')"); }
  });

  const invalidCases = [
    ["empty command", {}, {}], ["array command", [], {}], ["null command", null, {}],
    ["unknown group", { extra: {} }, { extra: 0 }],
    ["missing expected key", fourGroups, { branding: 1 }],
    ["extra expected key", { branding: snapshots.branding }, { branding: 1, modules: 1 }],
    ["negative version", { branding: snapshots.branding }, { branding: -1 }],
    ["fractional version", { branding: snapshots.branding }, { branding: 1.5 }],
    ["string version", { branding: snapshots.branding }, { branding: "1" }],
    ["overflow version", { branding: snapshots.branding }, { branding: 2147483647 }],
    ["null snapshot", { branding: null }, { branding: 1 }],
    ["extra branding field", { branding: { ...snapshots.branding, extra: true } }, { branding: 1 }],
    ["missing branding field", { branding: { systemName: "ERP" } }, { branding: 1 }],
    ["null name", { branding: { ...snapshots.branding, systemName: null } }, { branding: 1 }],
    ["short name", { branding: { ...snapshots.branding, systemName: "X" } }, { branding: 1 }],
    ["oversized text", { branding: { ...snapshots.branding, systemName: "x".repeat(101) } }, { branding: 1 }],
    ["oversized command", { branding: { ...snapshots.branding, systemName: "x".repeat(262145) } }, { branding: 1 }],
    ["negative asset version", { branding: { ...snapshots.branding, assetVersion: -1 } }, { branding: 1 }],
    ["fractional asset version", { branding: { ...snapshots.branding, assetVersion: 0.5 } }, { branding: 1 }],
    ["relative asset traversal", { branding: { ...snapshots.branding, logoMainUrl: "/../logo.png" } }, { branding: 1 }],
    ["wrong module type", { modules: { ...snapshots.modules, warehouse: "false" } }, { modules: 1 }],
    ["unknown module", { modules: { ...snapshots.modules, dashboard: true } }, { modules: 1 }],
    ["unknown industry", { modules: { ...snapshots.modules, industryPreset: "unknown" } }, { modules: 1 }],
    ["wrong locale", { localization: { ...snapshots.localization, locale: "en-US" } }, { localization: 1 }],
    ["invalid page size", { appearance: { ...snapshots.appearance, defaultPageSize: 500 } }, { appearance: 0 }],
    ["invalid color", { payslip: { ...snapshots.payslip, primaryColor: "red" } }, { payslip: 0 }],
    ["invalid navigation duplicate", { navigation: { ...snapshots.navigation, itemOrder: navigationPaths.map(() => navigationPaths[0]) } }, { navigation: 0 }],
    ["invalid dashboard nested field", { dashboard: { ...snapshots.dashboard, presets: snapshots.dashboard.presets.map((value, index) => index === 0 ? { ...value, extra: true } : value) } }, { dashboard: 0 }],
    ["invalid dashboard duplicate widget", { dashboard: { ...snapshots.dashboard, presets: snapshots.dashboard.presets.map((value, index) => index === 0 ? { ...value, enabledWidgets: ["quick_actions", "quick_actions"] } : value) } }, { dashboard: 0 }]
  ];
  for (const [name, groups, versions] of invalidCases) await test(`input boundary: ${name}`, async () => {
    const before = await databaseState(db);
    await rejects(() => publish(db, groups, versions), "SETTINGS_INVALID_INPUT");
    assert.deepEqual(await databaseState(db), before);
  });
  await test("reject null actor, request ID and change type", async () => {
    for (const options of [{ actor: null }, { request: null }, { changeType: null }, { changeType: "delete" }]) {
      await rejects(() => publish(db, fourGroups, zeroVersions, options), "SETTINGS_INVALID_INPUT");
    }
  });
  await test("a stale version in the last group rolls back the entire command", async () => {
    const before = await databaseState(db);
    const versions = await expected(db, fourGroups);
    versions.organization = 0;
    await rejects(() => publish(db, fourGroups, versions), "SETTINGS_VERSION_CONFLICT");
    assert.deepEqual(await databaseState(db), before);
  });
  await test("all eight groups publish together and history matches stored snapshots", async () => {
    const receipt = await publish(db, snapshots, await expected(db, snapshots));
    assert.equal(Object.keys(receipt.versions).length, 8);
    const { rows } = await db.query("select s.group_key,s.value,v.snapshot,v.created_by from public.system_settings s join public.settings_versions v on v.group_key=s.group_key and v.version=s.version");
    assert.equal(rows.length, 8);
    for (const row of rows) { assert.deepEqual(row.value, snapshots[row.group_key]); assert.deepEqual(row.value, row.snapshot); assert.equal(row.created_by, actor); }
  });
  await test("restore writes the restore action and snapshot in the same transaction", async () => {
    const receipt = await publish(db, { branding: snapshots.branding }, await expected(db, { branding: snapshots.branding }), { changeType: "restore" });
    const { rows } = await db.query("select action from public.audit_logs where metadata->>'requestId'=$1", [receipt.requestId]);
    assert.deepEqual(rows.map((row) => row.action), ["system_settings.restore"]);
  });

  for (const table of ["settings_versions", "audit_logs", "system_settings_commands"]) await test(`forced ${table} failure rolls back settings, history, audit and receipt`, async () => {
    const before = await databaseState(db);
    await db.query(`create function public.test_settings_failure() returns trigger language plpgsql as $$begin raise exception 'TEST_FORCED_FAILURE'; end;$$;
      create trigger test_settings_failure before insert on public.${table} for each row execute function public.test_settings_failure()`);
    const versions = await expected(db, snapshots);
    try { await rejects(() => publish(db, snapshots, versions), "TEST_FORCED_FAILURE"); }
    finally { await db.query(`drop trigger test_settings_failure on public.${table}; drop function public.test_settings_failure()`); }
    assert.deepEqual(await databaseState(db), before);
  });
  await test("two simultaneous commands using the same versions allow exactly one winner", async () => {
    const versions = await expected(db, fourGroups);
    const results = await Promise.allSettled([publish(db, fourGroups, versions), publish(parallel, fourGroups, versions)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const failure = results.find((result) => result.status === "rejected").reason;
    assert.equal(failure.message, "SETTINGS_VERSION_CONFLICT");
    assert.deepEqual(await expected(db, fourGroups), Object.fromEntries(Object.entries(versions).map(([key, value]) => [key, value + 1])));
  });
  await test("simultaneous retries of a new request create a single receipt and version set", async () => {
    const versions = await expected(db, fourGroups);
    const request = randomUUID();
    const receipts = await Promise.all([publish(db, fourGroups, versions, { request }), publish(parallel, fourGroups, versions, { request })]);
    assert.deepEqual(receipts[0], receipts[1]);
    const { rows } = await db.query("select (select count(*) from public.system_settings_commands where request_id=$1) as commands,(select count(*) from public.audit_logs where metadata->>'requestId'=$2) as audits", [request, request]);
    assert.equal(Number(rows[0].commands), 1);
    assert.equal(Number(rows[0].audits), 4);
    assert.deepEqual(await expected(db, fourGroups), Object.fromEntries(Object.entries(versions).map(([key, value]) => [key, value + 1])));
  });
  await test("opposite group order waits on one command lock then conflicts without deadlock", async () => {
    const versions = await expected(db, fourGroups);
    const reversed = Object.fromEntries(Object.entries(fourGroups).reverse());
    await db.query("begin");
    let waiting;
    try {
      await publish(db, fourGroups, versions);
      waiting = publish(parallel, reversed, versions).then(() => null, (error) => error);
      const observer = await connect("observer");
      let lockObserved = false;
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const { rows } = await observer.query("select wait_event_type from pg_stat_activity where application_name='settings-integration-parallel'");
        if (rows[0]?.wait_event_type === "Lock") { lockObserved = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      assert.equal(lockObserved, true);
      await db.query("commit");
      assert.equal((await waiting)?.message, "SETTINGS_VERSION_CONFLICT");
    } catch (error) {
      await db.query("rollback");
      if (waiting) await waiting;
      throw error;
    }
  });
  const { rows } = await db.query("show server_version");
  const migrationSource = await readFile(path.join(workspace, "supabase/migrations/202610210002_atomic_system_settings.sql"), "utf8");
  const suiteSource = await readFile(fileURLToPath(import.meta.url), "utf8");
  const fixtureSource = await readFile(path.join(workspace, "supabase/tests/atomic-settings.fixture.sql"), "utf8");
  evidence = {
    generatedAt: new Date().toISOString(), postgresVersion: rows[0].server_version,
    scope: "Native PostgreSQL 17, isolated disposable loopback cluster, minimal matching table fixture; full Supabase migration suite and production rollout remain separate.",
    migration: "202610210002_atomic_system_settings.sql",
    migrationSha256: createHash("sha256").update(migrationSource).digest("hex"),
    testSuiteSha256: createHash("sha256").update(suiteSource).digest("hex"),
    fixtureSha256: createHash("sha256").update(fixtureSource).digest("hex"),
    passed: tests.length, failed: 0,
    cloudAccess: false, productionWrites: false, tests
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
process.stdout.write(`Atomic settings PostgreSQL integration: ${tests.length} passed.\n`);
