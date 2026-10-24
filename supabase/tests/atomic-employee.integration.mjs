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
const runDirectory = path.join(workspace, ".tmp/erp-employee-db", randomUUID());
const dataDirectory = path.join(runDirectory, "data");
const migration = "202610220001_atomic_employee_profile.sql";
const output = path.join(workspace, "docs/commercial-erp/evidence/atomic-employee-integration.json");
const binaryRoot = process.env.ERP_TEST_PG_BIN;
if (!binaryRoot && process.platform !== "win32") throw new Error("Set ERP_TEST_PG_BIN to a PostgreSQL 17 bin directory.");
const binaries = binaryRoot ? {
  initdb: path.join(binaryRoot, process.platform === "win32" ? "initdb.exe" : "initdb"),
  pg_ctl: path.join(binaryRoot, process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl")
} : await import(pathToFileURL(pgRequire.resolve("@embedded-postgres/windows-x64")).href);
const account = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const employee = (n) => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = account(1);
const terminated = { employment_status: "terminated", termination_date: "2026-10-22", termination_reason: "Integration offboarding" };
const tests = [];
const clients = [];
const baselineMigrations = [];
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
  const client = new Client({ ...config, application_name: `employee-integration-${name}`, statement_timeout: 10000 });
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
    const { rows } = await observer.query("select wait_event_type from pg_stat_activity where application_name=$1", [`employee-integration-${name}`]);
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
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
    create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid';`);
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
  await db.query(await readFile(path.join(workspace, "supabase/migrations", migration), "utf8"));
  roleIds = Object.fromEntries((await db.query("select code,id from public.roles")).rows.map((r) => [r.code, r.id]));

  await test(db, "actual baseline enforces employee row versions, account uniqueness and audit append-only", async () => {
    await db.query("update public.employees set note='Trigger check' where id=$1", [employee(3)]);
    assert.equal((await db.query("select row_version from public.employees where id=$1", [employee(3)])).rows[0].row_version, 2);
    await rejectedCommand(db, () => db.query("insert into public.app_accounts(employee_id,username,display_name) values($1,'duplicate_employee','Duplicate')", [employee(3)]), null, "23505");
    await db.query("insert into public.audit_logs(action,entity_type,entity_id) values('integration','test','test')");
    await rejectedCommand(db, () => db.query("update public.audit_logs set reason='Changed'"), "AUDIT_LOG_APPEND_ONLY");
  });
  await test(db, "anonymous and authenticated cannot execute profile, account or provisioning commands", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set local role ${role}`);
      await rejectedCommand(db, () => patch(db, { full_name: "Denied name" }), null, "42501");
      await rejectedCommand(db, () => status(db, account(3), "disabled"), null, "42501");
      await rejectedCommand(db, () => roles(db, account(3), [roleIds.employee]), null, "42501");
      await rejectedCommand(db, () => provision(db, employee(4)), null, "42501");
      await db.query("reset role");
    }
  });
  await test(db, "private status helper cannot bypass actor checks under broad default grants", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await db.query(`set local role ${role}`);
      await rejectedCommand(db, () => db.query("select public.apply_app_account_status_locked($1,'disabled',$2,'Bypass')", [actor, actor]), null, "42501");
      await db.query("reset role");
    }
  });
  await test(db, "service role updates profile once with faithful history and audit", async () => {
    const before = await state(db);
    const values = { full_name: "Integration revised", date_of_birth: "1995-04-06", gender: "female", marital_status: "single", permanent_address: "Integration address", probation_start_date: "2026-01-01", probation_end_date: "2026-02-01" };
    await db.query("set local role service_role");
    assert.equal(await patch(db, values), 2);
    await db.query("reset role");
    const after = await state(db);
    const updated = after.employees.find((e) => e.id === employee(3));
    for (const [key, value] of Object.entries(values)) assert.equal(updated[key], value, key);
    assert.equal(updated.row_version, 2);
    assert.equal(updated.employment_status, "active");
    assert.equal(after.accounts.length, before.accounts.length);
    assert.deepEqual(after.sessions, before.sessions);
    assert.equal(after.history.length, 1);
    assert.equal(after.history[0].actor_account_id, actor);
    assert.equal(after.history[0].event_type, "profile_updated");
    assert.equal(after.history[0].event_date, "2026-10-22");
    assert.equal(after.audit.length, 1);
    assert.equal(after.audit[0].actor_account_id, actor);
    assert.equal(after.audit[0].entity_id, employee(3));
  });
  await test(db, "optional JSON null clears a field without changing omitted fields", async () => {
    await patch(db, { display_name: "Existing display", note: "Existing note" });
    assert.equal(await patch(db, { display_name: null }, { version: 2 }), 3);
    const row = (await db.query("select display_name,note from public.employees where id=$1", [employee(3)])).rows[0];
    assert.deepEqual(row, { display_name: null, note: "Existing note" });
    const history = (await db.query("select before_data,after_data from public.employee_history_events where after_data->>'rowVersion'='3'")).rows[0];
    assert.equal(history.before_data.display_name, "Existing display");
    assert.equal(history.after_data.display_name, null);
  });
  await test(db, "phone normalization remains atomic with the profile and nullable clear", async () => {
    assert.equal(await patch(db, { personal_phone: "0912 345 678", normalized_phone: "84912345678" }), 2);
    assert.equal((await db.query("select normalized_phone from public.employees where id=$1", [employee(3)])).rows[0].normalized_phone, "84912345678");
    await rejectedCommand(db, () => patch(db, { personal_phone: "0912 345 678", normalized_phone: "wrong" }, { version: 2 }), "EMPLOYEE_INVALID_PATCH");
    assert.equal(await patch(db, { personal_phone: null }, { version: 2 }), 3);
    assert.deepEqual((await db.query("select personal_phone,normalized_phone from public.employees where id=$1", [employee(3)])).rows[0], { personal_phone: null, normalized_phone: null });
  });
  await test(db, "offboarding archives once, disables the linked account and revokes every live session", async () => {
    const before = await state(db);
    assert.equal(await patch(db, terminated), 2);
    const after = await state(db);
    const row = after.employees.find((e) => e.id === employee(3));
    assert.equal(row.employment_status, "terminated"); assert.equal(row.profile_status, "archived"); assert.equal(row.row_version, 2);
    const disabled = after.accounts.find((a) => a.id === account(3));
    assert.equal(disabled.status, "disabled"); assert(disabled.disabled_at);
    assert(after.sessions.filter((s) => s.account_id === account(3)).every((s) => s.revoked_at));
    assert.equal(after.sessions.find((s) => s.id.endsWith("0000000000000003")).revoked_at, before.sessions.find((s) => s.id.endsWith("0000000000000003")).revoked_at);
    assert.equal(after.sessions.find((s) => s.account_id === actor).revoked_at, null);
    assert.equal(after.history.filter((h) => h.event_type === "terminated").length, 1);
    assert.equal(after.audit.filter((a) => a.entity_type === "employee").length, 1);
    assert.equal(after.audit.filter((a) => a.action === "account.status_updated").length, 1);
  });
  await test(db, "offboard-only permission can disable linked account without standalone account.disable", async () => {
    assert.equal(await patch(db, terminated, { actor: account(11) }), 2);
    assert.equal((await db.query("select status from public.app_accounts where id=$1", [account(3)])).rows[0].status, "disabled");
  });
  await test(db, "offboarding a profile with no login account still writes one history and audit", async () => {
    assert.equal(await patch(db, terminated, { employee: employee(4) }), 2);
    const after = await state(db);
    assert.equal(after.history.length, 1); assert.equal(after.audit.length, 1);
  });
  await test(db, "legacy duplicate account defense disables every linked account and session", async () => {
    await db.query("drop index public.app_accounts_employee_unique_idx");
    await db.query("insert into public.app_accounts(id,employee_id,username,display_name,status) values($1,$2,'integration_legacy','Legacy account','locked')", [account(99), employee(3)]);
    await db.query("insert into public.app_sessions(id,account_id,refresh_token_hash,expires_at) values('integration-legacy-session-000001',$1,repeat('c',64),now()+interval '1 day')", [account(99)]);
    assert.equal(await patch(db, terminated), 2);
    const after = await state(db);
    assert(after.accounts.filter((a) => a.employee_id === employee(3)).every((a) => a.status === "disabled"));
    assert(after.sessions.filter((s) => [account(3), account(99)].includes(s.account_id)).every((s) => s.revoked_at));
    assert.equal(after.audit.filter((a) => a.action === "account.status_updated").length, 2);
  });

  const invalidCases = [
    ["null patch", null], ["array patch", []], ["empty patch", {}],
    ["unknown column", { privileged: true }], ["protected row version", { row_version: 500 }],
    ["direct profile status", { profile_status: "archived" }], ["wrong scalar type", { full_name: 42 }],
    ["blank full name", { full_name: " " }], ["null required join date", { join_date: null }],
    ["invalid calendar date", { date_of_birth: "2025-02-29" }, "EMPLOYEE_INVALID_DATES"], ["invalid gender", { gender: "unknown" }],
    ["invalid employment status", { employment_status: "unknown" }],
    ["missing termination date", { employment_status: "terminated", termination_reason: "Valid reason" }, "EMPLOYEE_OFFBOARD_DETAILS_REQUIRED"],
    ["missing termination reason", { employment_status: "terminated", termination_date: "2026-10-22" }, "EMPLOYEE_OFFBOARD_DETAILS_REQUIRED"],
    ["short termination reason", { ...terminated, termination_reason: "x" }, "EMPLOYEE_OFFBOARD_DETAILS_REQUIRED"],
    ["oversize termination reason", { ...terminated, termination_reason: "x".repeat(501) }, "EMPLOYEE_OFFBOARD_DETAILS_REQUIRED"],
    ["termination before stored join date", { ...terminated, termination_date: "2025-12-31" }, "EMPLOYEE_INVALID_DATES"],
    ["probation before stored start date", { probation_start_date: "2026-03-01", probation_end_date: "2026-02-01" }, "EMPLOYEE_INVALID_DATES"]
  ];
  for (const [name, values, token = "EMPLOYEE_INVALID_PATCH"] of invalidCases) await test(db, `input boundary: ${name}`, async () => {
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, values), token);
    assert.deepEqual(await state(db), before);
  });
  for (const version of [null, 0, -1, 2147483647]) await test(db, `mandatory CAS rejects version ${version}`, async () => {
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { note: "Rejected CAS" }, { version }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "missing actor, employee ID and event date fail closed without writes", async () => {
    const before = await state(db);
    for (const options of [{ actor: null }, { employee: null }, { eventDate: null }]) {
      await rejectedCommand(db, () => patch(db, { note: "Rejected identity" }, options), "EMPLOYEE_INVALID_PATCH");
    }
    assert.deepEqual(await state(db), before);
  });
  await test(db, "merged stored dates are validated when only one boundary changes", async () => {
    await patch(db, { official_date: "2026-02-01", probation_start_date: "2026-01-01", probation_end_date: "2026-02-01" });
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { join_date: "2026-03-01" }, { version: 2 }), "EMPLOYEE_INVALID_DATES");
    await rejectedCommand(db, () => patch(db, { probation_start_date: "2026-03-01" }, { version: 2 }), "EMPLOYEE_INVALID_DATES");
    assert.deepEqual(await state(db), before);
  });
  const referenceCases = [
    { table: "departments", field: "department_id", existing: "d0000000-0000-4000-8000-000000000001", alternate: "d0000000-0000-4000-8000-000000000002" },
    { table: "positions", field: "position_id", existing: "e0000000-0000-4000-8000-000000000001", alternate: "e0000000-0000-4000-8000-000000000002" },
    { table: "employment_types", field: "employment_type_id", existing: "f0000000-0000-4000-8000-000000000001", alternate: "f0000000-0000-4000-8000-000000000002" }
  ];
  for (const { table, field, existing, alternate } of referenceCases) {
    await test(db, `changed ${field} rejects an inactive catalog entry without writes`, async () => {
      const extra = table === "employment_types" ? ",worker_category" : "";
      const extraValue = table === "employment_types" ? ",'office'" : "";
      await db.query(`insert into public.${table}(id,code,name,active${extra}) values($1,'INTEGRATION-INACTIVE','Inactive integration',false${extraValue})`, [alternate]);
      const before = await state(db);
      await rejectedCommand(db, () => patch(db, { [field]: alternate }), "EMPLOYEE_INVALID_PATCH");
      assert.deepEqual(await state(db), before);
    });
    await test(db, `unchanged inactive ${field} preserves historical assignment during unrelated edits`, async () => {
      await db.query(`update public.${table} set active=false where id=$1`, [existing]);
      assert.equal(await patch(db, { note: "Keep historical inactive assignment" }), 2);
      assert.equal(await patch(db, { [field]: existing, note: "Explicitly unchanged historical assignment" }, { version: 2 }), 3);
      assert.equal((await db.query(`select ${field} from public.employees where id=$1`, [employee(3)])).rows[0][field], existing);
    });
    await test(db, `changed ${field} accepts an active catalog entry`, async () => {
      const extra = table === "employment_types" ? ",worker_category" : "";
      const extraValue = table === "employment_types" ? ",'office'" : "";
      await db.query(`insert into public.${table}(id,code,name,active${extra}) values($1,'INTEGRATION-ACTIVE','Active integration',true${extraValue})`, [alternate]);
      assert.equal(await patch(db, { [field]: alternate }), 2);
      assert.equal((await db.query(`select ${field} from public.employees where id=$1`, [employee(3)])).rows[0][field], alternate);
    });
  }
  await test(db, "manager cannot be the employee itself", async () => {
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { manager_employee_id: employee(3) }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "manager assignment rejects a direct reporting cycle", async () => {
    await db.query("update public.employees set manager_employee_id=$1 where id=$2", [employee(3), employee(6)]);
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { manager_employee_id: employee(6) }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "manager assignment rejects an indirect reporting cycle", async () => {
    await db.query("update public.employees set manager_employee_id=$1 where id=$2", [employee(7), employee(6)]);
    await db.query("update public.employees set manager_employee_id=$1 where id=$2", [employee(3), employee(7)]);
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { manager_employee_id: employee(6) }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "manager assignment rejects a preexisting cycle within the proposed manager chain", async () => {
    // Simulate an imported legacy inconsistency, then restore the real trigger
    // before exercising the command. The whole case rolls back afterward.
    await db.query("alter table public.employees disable trigger employees_prevent_manager_cycle");
    await db.query("update public.employees set manager_employee_id=$1 where id=$2", [employee(7), employee(6)]);
    await db.query("update public.employees set manager_employee_id=$1 where id=$2", [employee(6), employee(7)]);
    await db.query("alter table public.employees enable trigger employees_prevent_manager_cycle");
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { manager_employee_id: employee(6) }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  for (const status of ["terminated", "on_leave", "pending_onboarding", "probation"]) await test(db, `changed manager rejects ${status} employment status`, async () => {
    await db.query("update public.employees set employment_status=$1::public.employee_status where id=$2", [status, employee(6)]);
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { manager_employee_id: employee(6) }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "changed manager rejects an archived profile even with active employment status", async () => {
    await db.query("update public.employees set profile_status='archived' where id=$1", [employee(6)]);
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { manager_employee_id: employee(6) }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "active manager assignment succeeds and can be explicitly cleared", async () => {
    assert.equal(await patch(db, { manager_employee_id: employee(6) }), 2);
    assert.equal((await db.query("select manager_employee_id from public.employees where id=$1", [employee(3)])).rows[0].manager_employee_id, employee(6));
    assert.equal(await patch(db, { manager_employee_id: null }, { version: 2 }), 3);
    assert.equal((await db.query("select manager_employee_id from public.employees where id=$1", [employee(3)])).rows[0].manager_employee_id, null);
  });
  await test(db, "unchanged historical inactive manager does not block unrelated profile edits", async () => {
    await db.query("update public.employees set manager_employee_id=$1 where id=$2", [employee(6), employee(3)]);
    await db.query("update public.employees set employment_status='terminated',profile_status='archived' where id=$1", [employee(6)]);
    assert.equal(await patch(db, { note: "Retain historical manager" }, { version: 2 }), 3);
    assert.equal(await patch(db, { manager_employee_id: employee(6), note: "Explicitly unchanged manager" }, { version: 3 }), 4);
  });
  await test(db, "missing catalog and manager references reject without profile writes", async () => {
    const before = await state(db);
    for (const field of ["department_id", "position_id", "employment_type_id"]) {
      await rejectedCommand(db, () => patch(db, { [field]: randomUUID() }), null, "23503");
    }
    await rejectedCommand(db, () => patch(db, { manager_employee_id: randomUUID() }), "EMPLOYEE_INVALID_PATCH");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "missing employee is distinct from a stale version", async () => {
    await rejectedCommand(db, () => patch(db, { note: "Missing" }, { employee: randomUUID() }), "EMPLOYEE_NOT_FOUND");
    await rejectedCommand(db, () => patch(db, { note: "Stale" }, { version: 999 }), "EMPLOYEE_VERSION_CONFLICT");
  });
  await test(db, "retry with original version has no duplicate history or account effects", async () => {
    assert.equal(await patch(db, terminated), 2);
    const after = await state(db);
    await rejectedCommand(db, () => patch(db, terminated), "EMPLOYEE_VERSION_CONFLICT");
    assert.deepEqual(await state(db), after);
  });
  const deniedCases = [
    ["unknown actor", { note: "Denied" }, randomUUID()], ["disabled actor", { note: "Denied" }, account(13)],
    ["employee without edit", { note: "Denied" }, account(12)], ["edit-only cannot offboard", terminated, account(10)],
    ["offboard-only cannot edit profile", { note: "Denied" }, account(11)],
    ["mixed edit requires both permissions", { ...terminated, full_name: "Changed while offboarding" }, account(11)],
    ["termination metadata requires offboard", { termination_reason: "Denied reason" }, account(10)]
  ];
  for (const [name, values, who] of deniedCases) await test(db, `actor boundary: ${name}`, async () => {
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, values, { actor: who }), "EMPLOYEE_ACTOR_FORBIDDEN");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "terminated employee cannot return to active through a generic profile patch", async () => {
    await patch(db, terminated);
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, { employment_status: "active" }, { version: 2 }), "EMPLOYEE_REHIRE_REQUIRED");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "last active administrator guard rolls back the employee, account, history and sessions", async () => {
    await db.query("update public.app_accounts set status='disabled' where id=$1", [account(2)]);
    const before = await state(db);
    await rejectedCommand(db, () => patch(db, terminated, { employee: employee(1) }), "LAST_ACTIVE_ADMIN");
    assert.deepEqual(await state(db), before);
  });
  for (const [table, event] of [["employees", "update"], ["app_accounts", "update"], ["app_sessions", "update"], ["employee_history_events", "insert"], ["audit_logs", "insert"]]) {
    await test(db, `forced ${table} ${event} failure rolls back every offboarding write`, async () => {
      const before = await state(db);
      await db.query(`create function public.test_employee_failure() returns trigger language plpgsql as $$begin raise exception 'TEST_FORCED_FAILURE';end;$$;
        create trigger test_employee_failure before ${event} on public.${table} for each row execute function public.test_employee_failure()`);
      await rejectedCommand(db, () => patch(db, terminated), "TEST_FORCED_FAILURE");
      assert.deepEqual(await state(db), before);
    });
  }
  await test(db, "final employee audit failure rolls back account audits, sessions and history already written", async () => {
    const before = await state(db);
    await db.query(`create function public.test_employee_failure() returns trigger language plpgsql as $$begin
      if new.action='employee.offboarded' then raise exception 'TEST_FORCED_FAILURE';end if;return new;end;$$;
      create trigger test_employee_failure before insert on public.audit_logs for each row execute function public.test_employee_failure()`);
    await rejectedCommand(db, () => patch(db, terminated), "TEST_FORCED_FAILURE");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "a failure disabling the second legacy account also restores the first account and sessions", async () => {
    await db.query("drop index public.app_accounts_employee_unique_idx");
    await db.query("insert into public.app_accounts(id,employee_id,username,display_name,status) values($1,$2,'integration_legacy','Legacy account','active')", [account(99), employee(3)]);
    const before = await state(db);
    await db.query(`create function public.test_employee_failure() returns trigger language plpgsql as $$begin
      if new.id='20000000-0000-4000-8000-000000000099'::uuid then raise exception 'TEST_FORCED_FAILURE';end if;return new;end;$$;
      create trigger test_employee_failure before update on public.app_accounts for each row execute function public.test_employee_failure()`);
    await rejectedCommand(db, () => patch(db, terminated), "TEST_FORCED_FAILURE");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "standalone account disable enforces permission and revokes sessions atomically", async () => {
    const before = await state(db);
    await rejectedCommand(db, () => status(db, account(3), "disabled", account(10)), "ACCOUNT_ACTOR_FORBIDDEN");
    assert.deepEqual(await state(db), before);
    assert.equal((await status(db, account(3), "disabled", account(14))).status, "disabled");
    assert((await state(db)).sessions.filter((s) => s.account_id === account(3)).every((s) => s.revoked_at));
  });
  await test(db, "role assignment enforces singular account.assign_role permission and last administrator", async () => {
    await rejectedCommand(db, () => roles(db, account(3), [roleIds.employee], account(10)), "ACCOUNT_ACTOR_FORBIDDEN");
    await roles(db, account(3), [roleIds.employee], account(14));
    await db.query("update public.app_accounts set status='disabled' where id=$1", [account(2)]);
    await rejectedCommand(db, () => roles(db, actor, [roleIds.employee]), "LAST_ACTIVE_ADMIN");
  });
  await test(db, "disabled and unknown actors cannot invoke any public account lifecycle writer", async () => {
    const before = await state(db);
    for (const who of [account(13), randomUUID()]) {
      await rejectedCommand(db, () => status(db, account(3), "disabled", who), "ACCOUNT_ACTOR_FORBIDDEN");
      await rejectedCommand(db, () => roles(db, account(3), [roleIds.employee], who), "ACCOUNT_ACTOR_FORBIDDEN");
      await rejectedCommand(db, () => provision(db, employee(4), who), "ACCOUNT_ACTOR_FORBIDDEN");
    }
    assert.deepEqual(await state(db), before);
  });
  await test(db, "archived profiles cannot gain a new account or reactivate an existing account", async () => {
    await db.query("update public.employees set profile_status='archived' where id=any($1::uuid[])", [[employee(3), employee(4)]]);
    const before = await state(db);
    await rejectedCommand(db, () => status(db, account(3), "active"), "ACCOUNT_EMPLOYEE_INACTIVE");
    await rejectedCommand(db, () => provision(db, employee(4)), "ACCOUNT_EMPLOYEE_INACTIVE");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "public account commands distinguish missing targets and invalid role arrays", async () => {
    await rejectedCommand(db, () => status(db, randomUUID(), "disabled"), "ACCOUNT_NOT_FOUND");
    await rejectedCommand(db, () => status(db, account(3), "unknown"), "INVALID_STATUS");
    await rejectedCommand(db, () => roles(db, randomUUID(), [roleIds.employee]), "ACCOUNT_NOT_FOUND");
    await rejectedCommand(db, () => roles(db, account(3), []), "ROLE_REQUIRED");
    await rejectedCommand(db, () => roles(db, account(3), [null]), "ROLE_NOT_FOUND");
    await rejectedCommand(db, () => roles(db, account(3), [randomUUID()]), "ROLE_NOT_FOUND");
    await roles(db, account(3), [roleIds.employee, roleIds.employee]);
    assert.equal((await db.query("select count(*)::int as n from public.account_roles where account_id=$1", [account(3)])).rows[0].n, 1);
  });
  await test(db, "provisioning history failure restores the employee account and role assignment", async () => {
    const before = await state(db);
    await db.query(`create function public.test_employee_failure() returns trigger language plpgsql as $$begin raise exception 'TEST_FORCED_FAILURE';end;$$;
      create trigger test_employee_failure before insert on public.employee_history_events for each row execute function public.test_employee_failure()`);
    await rejectedCommand(db, () => provision(db, employee(4)), "TEST_FORCED_FAILURE");
    assert.deepEqual(await state(db), before);
  });

  await test(db, "simultaneous profile commands using the same version have exactly one winner", async () => {
    const results = await Promise.allSettled([patch(db, { note: "Concurrent A" }), patch(parallel, { note: "Concurrent B" })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "EMPLOYEE_VERSION_CONFLICT");
    assert.equal((await db.query("select row_version from public.employees where id=$1", [employee(3)])).rows[0].row_version, 2);
    assert.equal((await db.query("select count(*)::int as n from public.employee_history_events where employee_id=$1", [employee(3)])).rows[0].n, 1);
  }, false);
  await test(db, "simultaneous opposite manager assignments cannot create a reporting cycle", async () => {
    const results = await Promise.allSettled([
      patch(db, { manager_employee_id: employee(9) }, { employee: employee(8) }),
      patch(parallel, { manager_employee_id: employee(8) }, { employee: employee(9) })
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "EMPLOYEE_INVALID_PATCH");
    const { rows } = await db.query("select id,manager_employee_id,row_version from public.employees where id=any($1::uuid[])", [[employee(8), employee(9)]]);
    assert.equal(rows.filter((r) => r.manager_employee_id !== null).length, 1);
    assert.equal(rows.filter((r) => r.row_version === 2).length, 1);
  }, false);

  await test(db, "queued enable waits for offboarding then rejects the terminated employee", async () => {
    await db.query("begin");
    let waiting;
    try {
      await patch(db, terminated, { version: 2 });
      waiting = status(parallel, account(3), "active").then(() => null, (error) => error);
      await observeWait(observer);
      await db.query("commit");
      assert.equal((await waiting)?.message, "ACCOUNT_EMPLOYEE_INACTIVE");
      assert.equal((await db.query("select status from public.app_accounts where id=$1", [account(3)])).rows[0].status, "disabled");
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  await test(db, "queued provisioning waits for offboarding then rejects the terminated employee", async () => {
    await db.query("begin");
    let waiting;
    try {
      await patch(db, terminated, { employee: employee(4) });
      waiting = provision(parallel, employee(4)).then(() => null, (error) => error);
      await observeWait(observer);
      await db.query("commit");
      assert.equal((await waiting)?.message, "ACCOUNT_EMPLOYEE_INACTIVE");
      assert.equal((await db.query("select count(*)::int as n from public.app_accounts where employee_id=$1", [employee(4)])).rows[0].n, 0);
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  await test(db, "provisioning before queued offboarding leaves the new account disabled", async () => {
    await db.query("begin");
    let waiting;
    let newAccount;
    try {
      newAccount = await provision(db, employee(5));
      waiting = patch(parallel, terminated, { employee: employee(5) }).then((version) => ({ version }), (error) => ({ error }));
      await observeWait(observer);
      await db.query("commit");
      assert.deepEqual(await waiting, { version: 2 });
      assert.equal((await db.query("select status from public.app_accounts where id=$1", [newAccount])).rows[0].status, "disabled");
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  await test(db, "simultaneous administrator disables preserve one active administrator without deadlock", async () => {
    const results = await Promise.allSettled([status(db, account(1), "disabled", account(14)), status(parallel, account(2), "disabled", account(14))]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "LAST_ACTIVE_ADMIN");
    assert.equal((await db.query("select count(distinct a.id)::int as n from public.app_accounts a join public.account_roles ar on ar.account_id=a.id join public.roles r on r.id=ar.role_id where r.code='admin' and a.status='active'")).rows[0].n, 1);
  }, false);
  await test(db, "administrator role removal racing another administrator offboard preserves one admin", async () => {
    await db.query("update public.app_accounts set status='active' where id=any($1::uuid[])", [[account(1), account(2)]]);
    await db.query("insert into public.account_roles(account_id,role_id) values($1,$2) on conflict do nothing", [account(14), roleIds.integration_offboard]);
    const results = await Promise.allSettled([
      patch(db, terminated, { employee: employee(1), actor: account(14) }),
      roles(parallel, account(2), [roleIds.employee], account(14))
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "LAST_ACTIVE_ADMIN");
    assert.equal((await db.query("select count(distinct a.id)::int as n from public.app_accounts a join public.account_roles ar on ar.account_id=a.id join public.roles r on r.id=ar.role_id where r.code='admin' and a.status='active'")).rows[0].n, 1);
  }, false);
  for (const offboardFirst of [false, true]) await test(db, `${offboardFirst ? "offboarding" : "account disable"} blocks the competing final-admin writer until commit`, async () => {
    // Explicitly restore these synthetic fixtures between race cases; the
    // assertion concerns public command ordering, never a real admin account.
    await db.query("update public.employees set employment_status='active',profile_status='complete',termination_date=null,termination_reason=null where id=any($1::uuid[])", [[employee(1), employee(2)]]);
    await db.query("update public.app_accounts set status='active' where id=any($1::uuid[])", [[account(1), account(2)]]);
    await db.query("insert into public.account_roles(account_id,role_id) select unnest($1::uuid[]),$2::uuid on conflict do nothing", [[account(1), account(2)], roleIds.admin]);
    const versions = Object.fromEntries((await db.query("select id,row_version from public.employees where id=any($1::uuid[])", [[employee(1), employee(2)]])).rows.map((r) => [r.id, r.row_version]));
    await db.query("begin");
    let waiting;
    try {
      if (offboardFirst) {
        await patch(db, terminated, { employee: employee(1), version: versions[employee(1)], actor: account(14) });
        waiting = status(parallel, account(2), "disabled", account(14)).then(() => null, (error) => error);
      } else {
        await status(db, account(1), "disabled", account(14));
        waiting = patch(parallel, terminated, { employee: employee(2), version: versions[employee(2)], actor: account(14) }).then(() => null, (error) => error);
      }
      await observeWait(observer);
      await db.query("commit");
      assert.equal((await waiting)?.message, "LAST_ACTIVE_ADMIN");
      assert.equal((await db.query("select count(distinct a.id)::int as n from public.app_accounts a join public.account_roles ar on ar.account_id=a.id join public.roles r on r.id=ar.role_id where r.code='admin' and a.status='active'")).rows[0].n, 1);
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);

  const migrationSource = await readFile(path.join(workspace, "supabase/migrations", migration), "utf8");
  const suiteSource = await readFile(fileURLToPath(import.meta.url), "utf8");
  const fixtureSource = await readFile(path.join(workspace, "supabase/tests/atomic-employee.fixture.sql"), "utf8");
  evidence = {
    generatedAt: new Date().toISOString(), postgresVersion: (await db.query("show server_version")).rows[0].server_version,
    scope: "Native PostgreSQL 17 isolated disposable loopback cluster, actual foundation/HR/account migrations and exact relevant later fragments; not a full Supabase stack rehearsal.",
    migration, migrationSha256: createHash("sha256").update(migrationSource).digest("hex"),
    testSuiteSha256: createHash("sha256").update(suiteSource).digest("hex"),
    fixtureSha256: createHash("sha256").update(fixtureSource).digest("hex"), baselineMigrations,
    passed: tests.length, failed: 0, cloudAccess: false, productionWrites: false, tests
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
process.stdout.write(`Atomic employee PostgreSQL integration: ${tests.length} passed.\n`);
