import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function runCases(context) {
  const { db, parallel, observer, test, rejectedCommand, state, account, employee, actor, patch, status, roles, roleIds, observeWait } = context;
  const sensitive = async (client, values = { bank_name: "Changed bank" }, options = {}) => {
    const result = await client.query("select public.patch_employee_sensitive_command($1::uuid,$2::integer,$3::jsonb,$4::uuid,$5::date,$6::text) as version", [
      options.employee === undefined ? employee(3) : options.employee,
      options.version === undefined ? 1 : options.version, values,
      options.actor === undefined ? account(15) : options.actor,
      options.eventDate === undefined ? "2026-10-22" : options.eventDate,
      options.reason === undefined ? "Integration correction" : options.reason
    ]);
    return result.rows[0].version;
  };
  const archive = async (client, options = {}) => {
    const result = await client.query("select public.archive_employee_command($1::uuid,$2::integer,$3::uuid,$4::date,$5::text) as version", [
      options.employee === undefined ? employee(3) : options.employee,
      options.version === undefined ? 1 : options.version,
      options.actor === undefined ? account(16) : options.actor,
      options.eventDate === undefined ? "2026-10-22" : options.eventDate,
      options.reason === undefined ? "Integration archive" : options.reason
    ]);
    return result.rows[0].version;
  };
  const forcedFailure = async (client, table, event, condition = "true") => {
    await client.query(`create function public.test_lifecycle_failure() returns trigger language plpgsql as $$begin
      if ${condition} then raise exception 'TEST_FORCED_FAILURE';end if;return new;end;$$;
      create trigger test_lifecycle_failure before ${event} on public.${table} for each row execute function public.test_lifecycle_failure()`);
  };
  const countAdmins = async () => (await db.query("select count(distinct a.id)::int as n from public.app_accounts a join public.account_roles ar on ar.account_id=a.id join public.roles r on r.id=ar.role_id where r.code='admin' and a.status='active'")).rows[0].n;
  const restoreAdmins = async () => {
    await db.query("delete from public.account_lifecycle_operations where kind='delete' and account_id=any($1::uuid[])", [[account(1), account(2)]]);
    await db.query("update public.employees set employment_status='active',profile_status='complete',termination_date=null,termination_reason=null where id=any($1::uuid[])", [[employee(1), employee(2)]]);
    for (const n of [1, 2]) await db.query("update public.app_accounts set status='active',metadata='{}',employee_id=$2,username=$3 where id=$1", [account(n), employee(n), `integration_${n}`]);
    await db.query("insert into public.account_roles(account_id,role_id) select unnest($1::uuid[]),$2::uuid on conflict do nothing", [[account(1), account(2)], roleIds.admin]);
  };

  await test(db, "service role can update sensitive fields with one shared employee CAS increment", async () => {
    const before = await state(db);
    await db.query("set local role service_role");
    assert.equal(await sensitive(db, { bank_name: "  Corrected bank  ", bank_branch: "Synthetic branch" }), 2);
    await db.query("reset role");
    const after = await state(db);
    const row = after.sensitive.find((r) => r.employee_id === employee(3));
    assert.equal(row.bank_name, "Corrected bank");
    assert.equal(row.bank_branch, "Synthetic branch");
    assert.equal(row.national_id_number, "012345678901");
    assert.equal(after.employees.find((r) => r.id === employee(3)).row_version, 2);
    assert.deepEqual(after.accounts, before.accounts);
    assert.deepEqual(after.sessions, before.sessions);
    assert.equal(after.history.length, 1); assert.equal(after.audit.length, 1);
    assert.equal(after.history[0].event_type, "sensitive_updated");
    assert.equal(after.audit[0].action, "employee.sensitive_updated");
  });
  await test(db, "sensitive history and audit record field names and versions without PII values", async () => {
    const values = { national_id_number: "987654321098", bank_account_number: "123123123", personal_tax_code: "PRIVATE-TAX-MARKER" };
    await sensitive(db, values);
    const after = await state(db);
    const history = after.history[0]; const audit = after.audit[0];
    assert.deepEqual(history.before_data, { rowVersion: 1 });
    assert.deepEqual(history.after_data, { rowVersion: 2, fields: Object.keys(values).sort() });
    assert.deepEqual(audit.before_data, { rowVersion: 1 });
    assert.deepEqual(audit.after_data, { rowVersion: 2, changedFields: Object.keys(values).sort() });
    const serialized = JSON.stringify({ history, audit });
    for (const value of [...Object.values(values), "012345678901", "999888777", "TEST-TAX-ONLY"]) assert(!serialized.includes(value));
  });
  await test(db, "sensitive explicit null clears only the provided field and omission preserves stored data", async () => {
    assert.equal(await sensitive(db, { bank_name: null }), 2);
    const row = (await state(db)).sensitive.find((r) => r.employee_id === employee(3));
    assert.equal(row.bank_name, null); assert.equal(row.bank_account_number, "999888777"); assert.equal(row.national_id_expiry_date, "2030-01-02");
  });
  await test(db, "sensitive first write creates the missing profile using real table defaults", async () => {
    assert.equal(await sensitive(db, { bank_name: "First bank" }, { employee: employee(4) }), 2);
    const row = (await state(db)).sensitive.find((r) => r.employee_id === employee(4));
    assert.equal(row.bank_name, "First bank"); assert.equal(row.national_id_number, null); assert(row.created_at); assert(row.updated_at);
  });
  for (const [name, values, options, token] of [
    ["empty object", {}, {}, "EMPLOYEE_INVALID_PATCH"],
    ["null patch", null, {}, "EMPLOYEE_INVALID_PATCH"],
    ["array patch", [], {}, "EMPLOYEE_INVALID_PATCH"],
    ["unknown field", { note: "Hidden write" }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["control field", { row_version: 99 }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["numeric text", { bank_name: 123 }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["blank text", { bank_name: "   " }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["whitespace-only text", { bank_name: "\t\r\n" }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["overlong text", { bank_name: "x".repeat(201) }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["bad identity number", { national_id_number: "123A" }, {}, "EMPLOYEE_INVALID_PATCH"],
    ["invalid calendar date", { national_id_issued_date: "2025-02-29" }, {}, "EMPLOYEE_INVALID_DATES"],
    ["invalid date spelling", { national_id_issued_date: "2026-1-02" }, {}, "EMPLOYEE_INVALID_DATES"],
    ["expiry before stored issue", { national_id_expiry_date: "2019-12-31" }, {}, "EMPLOYEE_INVALID_DATES"],
    ["issue after stored expiry", { national_id_issued_date: "2031-01-01" }, {}, "EMPLOYEE_INVALID_DATES"],
    ["null version", { bank_name: "Valid" }, { version: null }, "EMPLOYEE_INVALID_PATCH"],
    ["zero version", { bank_name: "Valid" }, { version: 0 }, "EMPLOYEE_INVALID_PATCH"],
    ["null target", { bank_name: "Valid" }, { employee: null }, "EMPLOYEE_INVALID_PATCH"],
    ["missing reason", { bank_name: "Valid" }, { reason: null }, "EMPLOYEE_INVALID_PATCH"],
    ["short reason", { bank_name: "Valid" }, { reason: "ab" }, "EMPLOYEE_INVALID_PATCH"],
    ["whitespace-only reason", { bank_name: "Valid" }, { reason: "\t\t\t\t" }, "EMPLOYEE_INVALID_PATCH"],
    ["overlong reason", { bank_name: "Valid" }, { reason: "x".repeat(501) }, "EMPLOYEE_INVALID_PATCH"],
    ["missing event date", { bank_name: "Valid" }, { eventDate: null }, "EMPLOYEE_INVALID_PATCH"]
  ]) await test(db, `sensitive rejects ${name} without partial writes`, async () => {
    const before = await state(db);
    await rejectedCommand(db, () => sensitive(db, values, options), token);
    assert.deepEqual(await state(db), before);
  });
  await test(db, "sensitive accepts the 200 character boundary and clears a date for valid merged chronology", async () => {
    assert.equal(await sensitive(db, { bank_name: "x".repeat(200), national_id_issued_date: null, national_id_expiry_date: "2019-01-01" }), 2);
  });
  await test(db, "sensitive identity uniqueness failure rolls back version history and audit", async () => {
    await db.query("insert into public.employee_sensitive_profiles(employee_id,national_id_number) values($1,'987654321098')", [employee(4)]);
    const before = await state(db);
    await rejectedCommand(db, () => sensitive(db, { national_id_number: "987654321098" }), null, "23505");
    assert.deepEqual(await state(db), before);
  });
  for (const who of [account(10), account(13), randomUUID(), null]) await test(db, `sensitive denies ${who === account(10) ? "ordinary editor" : who === account(13) ? "disabled administrator" : who === null ? "null actor" : "unknown actor"}`, async () => {
    const before = await state(db);
    await rejectedCommand(db, () => sensitive(db, undefined, { actor: who }), who === null ? "EMPLOYEE_INVALID_PATCH" : "EMPLOYEE_ACTOR_FORBIDDEN");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "sensitive missing target and stale version are distinct", async () => {
    await rejectedCommand(db, () => sensitive(db, undefined, { employee: randomUUID() }), "EMPLOYEE_NOT_FOUND");
    await rejectedCommand(db, () => sensitive(db, undefined, { version: 2 }), "EMPLOYEE_VERSION_CONFLICT");
  });
  for (const [table, event] of [["employee_sensitive_profiles", "update"], ["employees", "update"], ["employee_history_events", "insert"], ["audit_logs", "insert"]]) await test(db, `sensitive ${table} failure restores the entire command`, async () => {
    const before = await state(db); await forcedFailure(db, table, event);
    await rejectedCommand(db, () => sensitive(db), "TEST_FORCED_FAILURE");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "archive preserves employment status while revoking account access in one version", async () => {
    const before = await state(db);
    await db.query("set local role service_role"); assert.equal(await archive(db), 2); await db.query("reset role");
    const after = await state(db);
    const row = after.employees.find((r) => r.id === employee(3));
    assert.equal(row.employment_status, "active"); assert.equal(row.profile_status, "archived"); assert.equal(row.row_version, 2);
    assert.equal(after.accounts.find((r) => r.id === account(3)).status, "disabled");
    assert(after.sessions.filter((r) => r.account_id === account(3)).every((r) => r.revoked_at));
    assert.equal(after.sessions.find((r) => r.account_id === actor).revoked_at, null);
    assert.deepEqual(after.sensitive, before.sensitive);
    assert.equal(after.history.filter((r) => r.event_type === "archived").length, 1);
    assert.equal(after.audit.filter((r) => r.action === "employee.archived").length, 1);
    await rejectedCommand(db, () => archive(db, { version: 1 }), "EMPLOYEE_VERSION_CONFLICT");
    await rejectedCommand(db, () => archive(db, { version: 2 }), "EMPLOYEE_ALREADY_ARCHIVED");
  });
  await test(db, "archive does not require a linked account", async () => {
    assert.equal(await archive(db, { employee: employee(4) }), 2);
    assert.equal((await state(db)).accounts.filter((r) => r.employee_id === employee(4)).length, 0);
  });
  await test(db, "authorized sensitive correction of an archived employee preserves disabled access", async () => {
    await archive(db); assert.equal(await sensitive(db, { bank_name: "Historical correction" }, { version: 2 }), 3);
    const after = await state(db); assert.equal(after.employees.find((r) => r.id === employee(3)).profile_status, "archived");
    assert.equal(after.accounts.find((r) => r.id === account(3)).status, "disabled");
    assert(after.sessions.filter((r) => r.account_id === account(3)).every((r) => r.revoked_at));
  });
  await test(db, "archive last administrator guard restores profile and access", async () => {
    await db.query("update public.app_accounts set status='disabled' where id=$1", [account(2)]);
    const before = await state(db);
    await rejectedCommand(db, () => archive(db, { employee: employee(1) }), "LAST_ACTIVE_ADMIN");
    assert.deepEqual(await state(db), before);
  });
  for (const [name, options, token] of [
    ["ordinary editor", { actor: account(10) }, "EMPLOYEE_ACTOR_FORBIDDEN"],
    ["disabled actor", { actor: account(13) }, "EMPLOYEE_ACTOR_FORBIDDEN"],
    ["unknown actor", { actor: randomUUID() }, "EMPLOYEE_ACTOR_FORBIDDEN"],
    ["unknown employee", { employee: randomUUID() }, "EMPLOYEE_NOT_FOUND"],
    ["null expected version", { version: null }, "EMPLOYEE_INVALID_PATCH"],
    ["missing reason", { reason: null }, "EMPLOYEE_INVALID_PATCH"],
    ["stale version", { version: 2 }, "EMPLOYEE_VERSION_CONFLICT"]
  ]) await test(db, `archive denies ${name} without changes`, async () => {
    const before = await state(db); await rejectedCommand(db, () => archive(db, options), token); assert.deepEqual(await state(db), before);
  });
  for (const [table, event, condition] of [["employees", "update", "true"], ["app_accounts", "update", "true"], ["app_sessions", "update", "true"], ["employee_history_events", "insert", "true"], ["audit_logs", "insert", "new.action='employee.archived'"]]) await test(db, `archive ${table} failure restores profile account sessions history and audit`, async () => {
    const before = await state(db); await forcedFailure(db, table, event, condition);
    await rejectedCommand(db, () => archive(db), "TEST_FORCED_FAILURE"); assert.deepEqual(await state(db), before);
  });
  await test(db, "anonymous and authenticated cannot call archive or sensitive commands", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set local role ${role}`);
      await rejectedCommand(db, () => archive(db), null, "42501");
      await rejectedCommand(db, () => sensitive(db), null, "42501");
      await db.query("reset role");
    }
  });

  // Durable account operations are tested below after their prepare/finalize
  // contract. Auth rows are deliberately synthetic local stand-ins, not GoTrue.
  await accountCases(context, { forcedFailure, sensitive, archive, restoreAdmins, countAdmins });

  await test(db, "sensitive and ordinary profile edits sharing a version have one winner", async () => {
    const results = await Promise.allSettled([sensitive(db, { bank_name: "Concurrent" }, { employee: employee(6) }), patch(parallel, { note: "Concurrent" }, { employee: employee(6) })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "EMPLOYEE_VERSION_CONFLICT");
  }, false);
  await test(db, "archive and sensitive edits sharing a version have one winner", async () => {
    const results = await Promise.allSettled([archive(db, { employee: employee(7) }), sensitive(parallel, { bank_name: "Concurrent" }, { employee: employee(7) })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "EMPLOYEE_VERSION_CONFLICT");
  }, false);
  await test(db, "activation queued behind archive waits then rejects archived profile", async () => {
    await db.query("begin"); let waiting;
    try {
      await archive(db); waiting = status(parallel, account(3), "active").then(() => null, (error) => error);
      await observeWait(observer); await db.query("commit");
      assert.equal((await waiting)?.message, "ACCOUNT_EMPLOYEE_INACTIVE");
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  for (const action of ["disable", "role removal", "offboard", "archive"]) await test(db, `administrator archive racing ${action} preserves an active administrator without deadlock`, async () => {
    await restoreAdmins();
    const versions = Object.fromEntries((await db.query("select id,row_version from public.employees where id=any($1::uuid[])", [[employee(1), employee(2)]])).rows.map((r) => [r.id, r.row_version]));
    const competing = () => action === "disable" ? status(parallel, account(2), "disabled", account(14)) : action === "role removal" ? roles(parallel, account(2), [roleIds.employee], account(14)) : action === "archive" ? archive(parallel, { employee: employee(2), version: versions[employee(2)] }) : patch(parallel, { employment_status: "terminated", termination_date: "2026-10-22", termination_reason: "Integration race" }, { employee: employee(2), version: versions[employee(2)], actor: account(11) });
    const results = await Promise.allSettled([archive(db, { employee: employee(1), version: versions[employee(1)] }), competing()]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.find((r) => r.status === "rejected").reason.message, "LAST_ACTIVE_ADMIN");
    assert.equal(await countAdmins(), 1);
  }, false);
}

async function accountCases(context, helpers) {
  const { db, parallel, observer, test, rejectedCommand, state, account, employee, actor, patch, status, roles, provision, roleIds, observeWait } = context;
  const { forcedFailure, archive, restoreAdmins, countAdmins } = helpers;
  const prepare = async (client, options = {}) => {
    const n = options.n ?? 4;
    const result = await client.query("select public.prepare_account_provision($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::uuid[],$8::text,$9::text,$10::date) as receipt", [
      options.request === undefined ? randomUUID() : options.request,
      options.actor === undefined ? account(14) : options.actor,
      options.employee === undefined ? employee(n) : options.employee,
      options.username === undefined ? `integration_new_${n}` : options.username,
      options.email === undefined ? `integration-new-${n}@example.invalid` : options.email,
      options.phone === undefined ? null : options.phone,
      options.roles === undefined ? [roleIds.employee] : options.roles,
      options.fingerprint === undefined ? "a".repeat(64) : options.fingerprint,
      options.mode === undefined ? "provided" : options.mode,
      options.eventDate === undefined ? "2026-10-22" : options.eventDate
    ]);
    return result.rows[0].receipt;
  };
  const command = async (client, name, request, who = account(14)) => (await client.query(`select public.${name}($1::uuid,$2::uuid) as receipt`, [request, who])).rows[0].receipt;
  const complete = (client, request, who) => command(client, "complete_account_provision", request, who);
  const lookup = (client, request, who) => command(client, "get_account_lifecycle_operation", request, who);
  const cancel = (client, request, who) => command(client, "cancel_account_provision", request, who);
  const cleanup = (client, request, who) => command(client, "complete_account_provision_cleanup", request, who);
  const finishDelete = (client, request, who) => command(client, "complete_account_deletion", request, who);
  const deletion = async (client, options = {}) => (await client.query("select public.prepare_account_deletion($1::uuid,$2::uuid,$3::uuid,$4::date) as receipt", [
    options.request === undefined ? randomUUID() : options.request,
    options.actor === undefined ? account(14) : options.actor,
    options.account === undefined ? account(3) : options.account,
    options.eventDate === undefined ? "2026-10-22" : options.eventDate
  ])).rows[0].receipt;
  const identity = async (client, receipt) => {
    await client.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)", [receipt.authUserId, receipt.loginEmail, { dtech_operation_id: receipt.requestId }]);
  };
  const attachIdentity = async (client, target = account(3)) => {
    const id = randomUUID();
    await client.query("insert into auth.users(id,email) values($1,'legacy-local@example.invalid')", [id]);
    await client.query("update public.app_accounts set auth_user_id=$2,primary_email='legacy-local@example.invalid' where id=$1", [target, id]);
    return id;
  };
  const list = async (client, who = account(14)) => (await client.query("select public.list_account_lifecycle_operations($1::uuid) as receipt", [who])).rows[0].receipt;
  const session = (client, target = account(12), id = `integration-late-${randomUUID()}`) => client.query("insert into public.app_sessions(id,account_id,refresh_token_hash,expires_at) values($1,$2,$3,now()+interval '1 day')", [id, target, "d".repeat(64)]);

  for (const status of ["disabled", "locked", "invited", "pending_activation"]) await test(db, `session guard rejects insertion for ${status} account`, async () => {
    await db.query("update public.app_accounts set status=$2 where id=$1", [account(12), status]); const before = await state(db);
    await rejectedCommand(db, () => session(db), "ACCOUNT_SESSION_FORBIDDEN"); assert.deepEqual(await state(db), before);
  });
  await test(db, "session guard rejects an active account carrying a deletion tombstone", async () => {
    await db.query("update public.app_accounts set metadata=jsonb_build_object('deleted_at',now()) where id=$1", [account(12)]); const before = await state(db);
    await rejectedCommand(db, () => session(db), "ACCOUNT_SESSION_FORBIDDEN"); assert.deepEqual(await state(db), before);
  });
  await test(db, "session guard rejects an unknown account before inserting a session", async () => {
    const before = await state(db); await rejectedCommand(db, () => session(db, randomUUID()), "ACCOUNT_SESSION_FORBIDDEN"); assert.deepEqual(await state(db), before);
  });
  await test(db, "service role may register a session only for an active account and cannot call its private guard", async () => {
    await db.query("set local role service_role"); await session(db);
    await rejectedCommand(db, () => db.query("select public.guard_active_account_session()"), null, "42501");
    await db.query("reset role");
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set local role ${role}`); await rejectedCommand(db, () => session(db), null, "42501"); await db.query("reset role");
    }
  });

  await test(db, "provision preparation durably reserves identity without creating account roles or history", async () => {
    const before = await state(db); await db.query("set local role service_role");
    const receipt = await prepare(db); await db.query("reset role");
    assert.equal(receipt.kind, "provision"); assert.equal(receipt.state, "prepared");
    assert.equal(receipt.employeeId, employee(4)); assert(receipt.authUserId); assert(receipt.accountId);
    const after = await state(db); assert.equal(after.operations.length, 1);
    assert.deepEqual(after.accounts, before.accounts); assert.deepEqual(after.roles, before.roles); assert.deepEqual(after.history, before.history);
    assert(!JSON.stringify(after.operations).includes("password"));
  });
  await test(db, "same provision request returns the identical reserved identity and retains first event date", async () => {
    const request = randomUUID(); const receipt = await prepare(db, { request });
    assert.deepEqual(await prepare(db, { request, eventDate: "2026-10-23", roles: [roleIds.employee, roleIds.employee] }), receipt);
    const after = await state(db); assert.equal(after.operations.length, 1);
    assert.equal(after.operations[0].payload.eventDate, "2026-10-22");
  });
  for (const [name, change] of [
    ["actor", { actor }], ["employee", { n: 5 }], ["username", { username: "different_login" }],
    ["email", { email: "changed@example.invalid" }], ["phone", { phone: "123456789" }],
    ["role", { roles: [roleIds.admin] }], ["credential fingerprint", { fingerprint: "b".repeat(64) }], ["credential mode", { mode: "generated" }]
  ]) await test(db, `provision immutable request rejects changed ${name}`, async () => {
    const request = randomUUID(); await prepare(db, { request }); const before = await state(db);
    await rejectedCommand(db, () => prepare(db, { request, ...change }), "ACCOUNT_OPERATION_CONFLICT"); assert.deepEqual(await state(db), before);
  });
  for (const [name, change] of [
    ["employee", { n: 4, username: "other_login", email: "other@example.invalid" }],
    ["case insensitive username", { n: 5, username: "INTEGRATION_NEW_4" }],
    ["case insensitive email", { n: 5, email: "INTEGRATION-NEW-4@EXAMPLE.INVALID" }]
  ]) await test(db, `pending provision blocks another reservation for ${name}`, async () => {
    await prepare(db); const before = await state(db);
    await rejectedCommand(db, () => prepare(db, change), "ACCOUNT_OPERATION_PENDING"); assert.deepEqual(await state(db), before);
  });
  for (const [name, options, token] of [
    ["null request", { request: null }, "ACCOUNT_INVALID_INPUT"],
    ["null employee", { employee: null }, "ACCOUNT_INVALID_INPUT"],
    ["short username", { username: "ab" }, "ACCOUNT_INVALID_INPUT"],
    ["digit first username", { username: "1invalid" }, "ACCOUNT_INVALID_INPUT"],
    ["overlong username", { username: "x".repeat(33) }, "ACCOUNT_INVALID_INPUT"],
    ["invalid email", { email: "invalid" }, "ACCOUNT_INVALID_INPUT"],
    ["invalid fingerprint", { fingerprint: "not-a-hash" }, "ACCOUNT_INVALID_INPUT"],
    ["invalid credential mode", { mode: "unknown" }, "ACCOUNT_INVALID_INPUT"],
    ["missing event date", { eventDate: null }, "ACCOUNT_INVALID_INPUT"],
    ["empty roles", { roles: [] }, "ROLE_REQUIRED"],
    ["null role", { roles: [null] }, "ROLE_NOT_FOUND"],
    ["unknown role", { roles: [randomUUID()] }, "ROLE_NOT_FOUND"],
    ["missing employee", { employee: randomUUID() }, "EMPLOYEE_NOT_FOUND"],
    ["existing account", { n: 3 }, "EMPLOYEE_ACCOUNT_EXISTS"],
    ["existing username", { username: "integration_3" }, "ACCOUNT_IDENTITY_EXISTS"]
  ]) await test(db, `provision preparation rejects ${name} with no reservation`, async () => {
    const before = await state(db); await rejectedCommand(db, () => prepare(db, options), token); assert.deepEqual(await state(db), before);
  });
  await test(db, "provision completion requires the reserved Auth identity", async () => {
    const receipt = await prepare(db); const before = await state(db);
    await rejectedCommand(db, () => complete(db, receipt.requestId), "ACCOUNT_AUTH_IDENTITY_MISMATCH"); assert.deepEqual(await state(db), before);
  });
  await test(db, "account creator without role assignment permission may provision the basic employee role", async () => {
    const prepared = await prepare(db, { actor: account(17) }); await identity(db, prepared);
    assert.equal((await complete(db, prepared.requestId, account(17))).state, "completed");
    assert.deepEqual((await state(db)).roles.filter((r) => r.account_id === prepared.accountId).map((r) => r.role_id), [roleIds.employee]);
  });
  for (const role of ["admin", "hr", "supervisor", "integration_editor"]) await test(db, `account creator cannot reserve elevated ${role} role without account.assign_role`, async () => {
    const before = await state(db);
    await rejectedCommand(db, () => prepare(db, { actor: account(17), roles: [roleIds[role]] }), "ACCOUNT_ACTOR_FORBIDDEN");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "account creator cannot finalize another authorized actor's elevated reservation", async () => {
    const prepared = await prepare(db, { roles: [roleIds.admin] }); await identity(db, prepared); const before = await state(db);
    await rejectedCommand(db, () => complete(db, prepared.requestId, account(17)), "ACCOUNT_ACTOR_FORBIDDEN"); assert.deepEqual(await state(db), before);
  });
  await test(db, "account creator cannot read elevated reservation details and sees only basic requests in the pending list", async () => {
    const elevated = await prepare(db, { roles: [roleIds.admin] }); const basic = await prepare(db, { n: 5 });
    await rejectedCommand(db, () => lookup(db, elevated.requestId, account(17)), "ACCOUNT_ACTOR_FORBIDDEN");
    assert.deepEqual((await list(db, account(17))).map((r) => r.requestId), [basic.requestId]);
    assert.equal((await lookup(db, basic.requestId, account(17))).requestId, basic.requestId);
  });
  await test(db, "revoked role assignment permission blocks finalizing an elevated reservation", async () => {
    const prepared = await prepare(db, { roles: [roleIds.admin] }); await identity(db, prepared);
    await db.query("delete from public.role_permissions where role_id=$1 and permission_key='account.assign_role'", [roleIds.integration_accounts]);
    const before = await state(db); await rejectedCommand(db, () => complete(db, prepared.requestId), "ACCOUNT_ACTOR_FORBIDDEN"); assert.deepEqual(await state(db), before);
  });
  await test(db, "32 character username boundary can complete under the real account constraint", async () => {
    const prepared = await prepare(db, { username: "x".repeat(32) }); await identity(db, prepared);
    assert.equal((await complete(db, prepared.requestId)).state, "completed");
  });
  for (const field of ["email", "operation metadata"]) await test(db, `provision completion rejects a controlled corrupt legacy Auth ${field}`, async () => {
    const receipt = await prepare(db);
    // Construct an inconsistent historical row while temporarily disabling the
    // new Auth INSERT guard inside this rolled-back local transaction.
    await db.query("alter table auth.users disable trigger user");
    await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)", [receipt.authUserId, field === "email" ? "different@example.invalid" : receipt.loginEmail, { dtech_operation_id: field === "operation metadata" ? randomUUID() : receipt.requestId }]);
    await db.query("alter table auth.users enable trigger user"); const before = await state(db);
    await rejectedCommand(db, () => complete(db, receipt.requestId), "ACCOUNT_AUTH_IDENTITY_MISMATCH"); assert.deepEqual(await state(db), before);
  });
  await test(db, "provision completion creates account roles history audit and receipt exactly once", async () => {
    const prepared = await prepare(db); await identity(db, prepared);
    const receipt = await complete(db, prepared.requestId); assert.equal(receipt.state, "completed");
    const before = await state(db); assert.deepEqual(await complete(db, prepared.requestId), receipt); assert.deepEqual(await prepare(db, { request: prepared.requestId }), receipt); assert.deepEqual(await state(db), before);
    const row = before.accounts.find((a) => a.id === receipt.accountId);
    assert.equal(row.auth_user_id, receipt.authUserId); assert.equal(row.employee_id, employee(4)); assert.equal(row.status, "active");
    assert.equal(before.roles.filter((r) => r.account_id === receipt.accountId).length, 1);
    assert.equal(before.history.filter((h) => h.event_type === "account_provisioned").length, 1);
    assert.equal(before.audit.filter((a) => a.action === "account.provisioned").length, 1);
  });
  await test(db, "currently authorized replacement operator can recover a provision after preparer is disabled", async () => {
    const prepared = await prepare(db, { actor }); await identity(db, prepared);
    await db.query("update public.app_accounts set status='disabled' where id=$1", [actor]);
    assert.equal((await lookup(db, prepared.requestId)).accountId, prepared.accountId);
    assert.equal((await complete(db, prepared.requestId)).state, "completed");
    await rejectedCommand(db, () => lookup(db, prepared.requestId, actor), "ACCOUNT_ACTOR_FORBIDDEN");
  });
  for (const who of [account(10), account(13), randomUUID(), null]) await test(db, `account lifecycle denies ${who === account(10) ? "ordinary editor" : who === account(13) ? "disabled administrator" : who === null ? "null actor" : "unknown actor"}`, async () => {
    const prepared = await prepare(db); const before = await state(db);
    for (const operation of [() => prepare(db, { actor: who }), () => complete(db, prepared.requestId, who), () => lookup(db, prepared.requestId, who), () => cancel(db, prepared.requestId, who), () => list(db, who), () => deletion(db, { actor: who })]) await rejectedCommand(db, operation, "ACCOUNT_ACTOR_FORBIDDEN");
    assert.deepEqual(await state(db), before);
  });
  await test(db, "authorized missing operation lookups are distinct from forbidden callers", async () => {
    const request = randomUUID();
    for (const operation of [() => lookup(db, request), () => complete(db, request), () => cancel(db, request), () => cleanup(db, request), () => finishDelete(db, request)]) await rejectedCommand(db, operation, "ACCOUNT_OPERATION_NOT_FOUND");
    await rejectedCommand(db, () => lookup(db, request, account(10)), "ACCOUNT_ACTOR_FORBIDDEN");
  });
  for (const [table, event] of [["app_accounts", "insert"], ["account_roles", "insert"], ["employee_history_events", "insert"], ["audit_logs", "insert"], ["account_lifecycle_operations", "update"]]) await test(db, `provision completion ${table} failure preserves prepared recovery state`, async () => {
    const prepared = await prepare(db); await identity(db, prepared); const before = await state(db);
    await forcedFailure(db, table, event); await rejectedCommand(db, () => complete(db, prepared.requestId), "TEST_FORCED_FAILURE"); assert.deepEqual(await state(db), before);
  });
  await test(db, "provision cancellation keeps identity reserved until Auth absence is verified", async () => {
    const prepared = await prepare(db); await identity(db, prepared);
    const cancelled = await cancel(db, prepared.requestId); assert.equal(cancelled.state, "cleanup_required");
    assert.deepEqual(await cancel(db, prepared.requestId), cancelled);
    await rejectedCommand(db, () => complete(db, prepared.requestId), "ACCOUNT_AUTH_CLEANUP_REQUIRED");
    await rejectedCommand(db, () => cleanup(db, prepared.requestId), "ACCOUNT_AUTH_CLEANUP_REQUIRED");
    await rejectedCommand(db, () => prepare(db), "ACCOUNT_OPERATION_PENDING");
    await db.query("delete from auth.users where id=$1", [prepared.authUserId]);
    const finished = await cleanup(db, prepared.requestId); assert.equal(finished.state, "cancelled");
    assert.deepEqual(await cleanup(db, prepared.requestId), finished);
    assert.notEqual((await prepare(db)).authUserId, prepared.authUserId);
  });
  await test(db, "late Auth identity creation after persisted cancellation cannot reopen an operation", async () => {
    const prepared = await prepare(db); await cancel(db, prepared.requestId);
    await rejectedCommand(db, () => identity(db, prepared), "ACCOUNT_AUTH_IDENTITY_MISMATCH");
    await cleanup(db, prepared.requestId);
    await rejectedCommand(db, () => identity(db, prepared), "ACCOUNT_AUTH_IDENTITY_MISMATCH");
  });
  await test(db, "completed provisioning cannot be cancelled or finalized as a deletion", async () => {
    const prepared = await prepare(db); await identity(db, prepared); await complete(db, prepared.requestId);
    await rejectedCommand(db, () => cancel(db, prepared.requestId), "ACCOUNT_OPERATION_CONFLICT");
    await rejectedCommand(db, () => finishDelete(db, prepared.requestId), "ACCOUNT_OPERATION_CONFLICT");
  });
  await test(db, "Auth insert guard rejects another identity trying to claim an existing operation", async () => {
    const prepared = await prepare(db);
    await rejectedCommand(db, () => db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)", [randomUUID(), prepared.loginEmail, { dtech_operation_id: prepared.requestId }]), "ACCOUNT_AUTH_IDENTITY_MISMATCH");
  });
  await test(db, "linked Auth identity cannot be removed before durable account deletion preparation", async () => {
    const id = await attachIdentity(db); const before = await state(db);
    await rejectedCommand(db, () => db.query("delete from auth.users where id=$1", [id]), "ACCOUNT_AUTH_LINKED"); assert.deepEqual(await state(db), before);
  });
  await test(db, "limited Auth administrator executes identity guards without public table privileges", async () => {
    const prepared = await prepare(db); await db.query("set local role supabase_auth_admin");
    await rejectedCommand(db, () => db.query("select * from public.account_lifecycle_operations"), null, "42501");
    await identity(db, prepared); await db.query("reset role"); await complete(db, prepared.requestId);
    await db.query("set local role supabase_auth_admin");
    await rejectedCommand(db, () => db.query("delete from auth.users where id=$1", [prepared.authUserId]), "ACCOUNT_AUTH_LINKED");
    await db.query("reset role"); const receipt = await deletion(db, { account: prepared.accountId });
    await db.query("set local role supabase_auth_admin"); await db.query("delete from auth.users where id=$1", [prepared.authUserId]); await db.query("reset role");
    assert.equal((await finishDelete(db, receipt.requestId)).state, "completed");
  });
  await test(db, "deletion preparation durably tombstones access before external Auth cleanup", async () => {
    const authId = await attachIdentity(db); const before = await state(db);
    const receipt = await deletion(db); assert.equal(receipt.kind, "delete"); assert.equal(receipt.state, "cleanup_required"); assert.equal(receipt.authUserId, authId);
    const after = await state(db); const row = after.accounts.find((r) => r.id === account(3));
    assert.equal(row.status, "disabled"); assert.equal(row.auth_user_id, null); assert.equal(row.employee_id, null); assert(row.metadata.deleted_at);
    assert.equal(after.roles.filter((r) => r.account_id === account(3)).length, 0);
    assert(after.sessions.filter((r) => r.account_id === account(3)).every((r) => r.revoked_at));
    assert.deepEqual(after.employees, before.employees); assert.deepEqual(after.sensitive, before.sensitive); assert.deepEqual(after.identities, before.identities);
    const pending = await state(db);
    await rejectedCommand(db, () => finishDelete(db, receipt.requestId), "ACCOUNT_AUTH_CLEANUP_REQUIRED"); assert.deepEqual(await state(db), pending);
    await db.query("delete from auth.users where id=$1", [authId]); const completed = await finishDelete(db, receipt.requestId); assert.equal(completed.state, "completed");
    const finalState = await state(db); assert.deepEqual(await finishDelete(db, receipt.requestId), completed); assert.deepEqual(await state(db), finalState);
  });
  await test(db, "same delete request preserves receipt without duplicate history or audit", async () => {
    const request = randomUUID(); const receipt = await deletion(db, { request }); const before = await state(db);
    assert.deepEqual(await deletion(db, { request, eventDate: "2026-10-23" }), receipt); assert.deepEqual(await state(db), before);
    await rejectedCommand(db, () => deletion(db, { request, account: account(12) }), "ACCOUNT_OPERATION_CONFLICT");
    await rejectedCommand(db, () => deletion(db, { request, actor }), "ACCOUNT_OPERATION_CONFLICT");
    await rejectedCommand(db, () => deletion(db), "ACCOUNT_OPERATION_PENDING");
    await rejectedCommand(db, () => complete(db, request), "ACCOUNT_OPERATION_CONFLICT");
  });
  await test(db, "pending deletion reserves prior employee username and email until Auth cleanup completes", async () => {
    const authId = await attachIdentity(db); const receipt = await deletion(db);
    for (const options of [
      { n: 3 }, { n: 4, username: "integration_3" }, { n: 4, email: "legacy-local@example.invalid" }
    ]) await rejectedCommand(db, () => prepare(db, options), "ACCOUNT_OPERATION_PENDING");
    await db.query("delete from auth.users where id=$1", [authId]); await finishDelete(db, receipt.requestId);
    assert.equal((await prepare(db, { n: 3, username: "integration_3", email: "legacy-local@example.invalid" })).state, "prepared");
  });
  await test(db, "pending and completed tombstones reject activation and role assignment", async () => {
    const receipt = await deletion(db);
    for (const completed of [false, true]) {
      if (completed) await finishDelete(db, receipt.requestId);
      const before = await state(db);
      for (const value of ["active", "disabled", "locked"]) await rejectedCommand(db, () => status(db, account(3), value), "ACCOUNT_DELETED");
      await rejectedCommand(db, () => roles(db, account(3), [roleIds.employee]), "ACCOUNT_DELETED"); assert.deepEqual(await state(db), before);
    }
  });
  await test(db, "authorized recovery operator can finish deletion after preparer loses permission", async () => {
    const receipt = await deletion(db, { actor }); await db.query("update public.app_accounts set status='disabled' where id=$1", [actor]);
    assert.equal((await lookup(db, receipt.requestId)).requestId, receipt.requestId); assert.equal((await finishDelete(db, receipt.requestId)).state, "completed");
  });
  for (const [name, options, token] of [
    ["self deletion", { account: account(14) }, "ACCOUNT_SELF_DELETE"],
    ["missing target", { account: randomUUID() }, "ACCOUNT_NOT_FOUND"],
    ["null target", { account: null }, "ACCOUNT_INVALID_INPUT"],
    ["null request", { request: null }, "ACCOUNT_INVALID_INPUT"],
    ["null date", { eventDate: null }, "ACCOUNT_INVALID_INPUT"]
  ]) await test(db, `deletion rejects ${name} without partial access changes`, async () => {
    const before = await state(db); await rejectedCommand(db, () => deletion(db, options), token); assert.deepEqual(await state(db), before);
  });
  await test(db, "deletion rejects the final active administrator atomically", async () => {
    await db.query("update public.app_accounts set status='disabled' where id=$1", [account(2)]); const before = await state(db);
    await rejectedCommand(db, () => deletion(db, { account: actor }), "LAST_ACTIVE_ADMIN"); assert.deepEqual(await state(db), before);
  });
  await test(db, "a preexisting username colliding with a tombstone causes a complete safe rollback", async () => {
    const tombstone = account(3).replaceAll("-", "").replace(/[0-9]/g, (digit) => "ghijklmnop"[Number(digit)]);
    await db.query("insert into public.app_accounts(username,display_name,status) values($1,'Synthetic collision','disabled')", [tombstone]);
    const before = await state(db); await rejectedCommand(db, () => deletion(db), null, "23505"); assert.deepEqual(await state(db), before);
  });
  for (const [table, event] of [["app_sessions", "update"], ["account_roles", "delete"], ["app_accounts", "update"], ["employee_history_events", "insert"], ["audit_logs", "insert"], ["account_lifecycle_operations", "insert"]]) await test(db, `deletion preparation ${table} failure restores account roles sessions and history`, async () => {
    const before = await state(db); await forcedFailure(db, table, event);
    await rejectedCommand(db, () => deletion(db), "TEST_FORCED_FAILURE"); assert.deepEqual(await state(db), before);
  });
  await test(db, "deletion final audit failure retains durable cleanup operation for retry", async () => {
    const receipt = await deletion(db); const before = await state(db); await forcedFailure(db, "audit_logs", "insert", "new.action='account.deleted'");
    await rejectedCommand(db, () => finishDelete(db, receipt.requestId), "TEST_FORCED_FAILURE"); assert.deepEqual(await state(db), before);
  });
  await test(db, "pending operation list excludes completed and cancelled requests", async () => {
    const prepared = await prepare(db); const deleted = await deletion(db); let pending = await list(db);
    assert.deepEqual(new Set(pending.map((r) => r.requestId)), new Set([prepared.requestId, deleted.requestId]));
    await cancel(db, prepared.requestId); await cleanup(db, prepared.requestId); await finishDelete(db, deleted.requestId);
    pending = await list(db); assert.deepEqual(pending, []);
  });
  await test(db, "command tables and RPCs enforce service-only access under broad default grants", async () => {
    const prepared = await prepare(db);
    for (const role of ["anon", "authenticated"]) {
      await db.query(`set local role ${role}`);
      for (const operation of [() => prepare(db), () => complete(db, prepared.requestId), () => lookup(db, prepared.requestId), () => cancel(db, prepared.requestId), () => cleanup(db, prepared.requestId), () => deletion(db), () => finishDelete(db, prepared.requestId), () => list(db), () => db.query("select * from public.account_lifecycle_operations")]) await rejectedCommand(db, operation, null, "42501");
      await db.query("reset role");
    }
    await db.query("set local role service_role");
    assert.equal((await db.query("select count(*)::int n from public.account_lifecycle_operations")).rows[0].n, 1);
    for (const sql of ["update public.account_lifecycle_operations set state='cancelled'", "delete from public.account_lifecycle_operations", "truncate public.account_lifecycle_operations", "insert into public.account_lifecycle_operations(request_id) values(gen_random_uuid())"]) await rejectedCommand(db, () => db.query(sql), null, "42501");
    await rejectedCommand(db, () => db.query("select public.assert_account_lifecycle_actor($1,'account.create')", [actor]), null, "42501");
    await rejectedCommand(db, () => db.query("select public.assert_account_provision_actor($1,$2::uuid[])", [actor, [roleIds.admin]]), null, "42501");
    await rejectedCommand(db, () => provision(db, employee(5)), null, "42501");
    await db.query("reset role");
  });

  await test(db, "simultaneous same reservation request returns one stable identity", async () => {
    const request = randomUUID(); const receipts = await Promise.all([prepare(db, { request, n: 8 }), prepare(parallel, { request, n: 8 })]);
    assert.deepEqual(receipts[0], receipts[1]);
    await cancel(db, request); await cleanup(db, request);
  }, false);
  for (const insertFirst of [true, false]) await test(db, `late session registration ${insertFirst ? "before" : "after"} queued disable cannot survive reactivation`, async () => {
    await status(db, account(12), "active", account(14)); const id = `integration-order-${randomUUID()}`;
    await db.query("begin"); let waiting;
    try {
      if (insertFirst) { await session(db, account(12), id); waiting = status(parallel, account(12), "disabled", account(14)).then(() => null, (error) => error); }
      else { await status(db, account(12), "disabled", account(14)); waiting = session(parallel, account(12), id).then(() => null, (error) => error); }
      await observeWait(observer); await db.query("commit");
      const error = await waiting; if (insertFirst) assert.equal(error, null); else assert.equal(error?.message, "ACCOUNT_SESSION_FORBIDDEN");
      const saved = (await db.query("select revoked_at from public.app_sessions where id=$1", [id])).rows;
      if (insertFirst) { assert.equal(saved.length, 1); assert(saved[0].revoked_at); } else assert.equal(saved.length, 0);
      await status(db, account(12), "active", account(14));
      assert.equal((await db.query("select count(*)::int n from public.app_sessions where id=$1 and revoked_at is null", [id])).rows[0].n, 0);
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  await test(db, "simultaneous different reservations for one employee have exactly one winner", async () => {
    const results = await Promise.allSettled([prepare(db, { n: 9 }), prepare(parallel, { n: 9, username: "other_parallel", email: "other-parallel@example.invalid" })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1); assert.equal(results.find((r) => r.status === "rejected").reason.message, "ACCOUNT_OPERATION_PENDING");
    const receipt = results.find((r) => r.status === "fulfilled").value; await cancel(db, receipt.requestId); await cleanup(db, receipt.requestId);
  }, false);
  await test(db, "provision finalization queued behind archival rejects the archived employee without creating an account", async () => {
    const receipt = await prepare(db, { n: 4 }); await identity(db, receipt); await db.query("begin"); let waiting;
    try {
      await archive(db, { employee: employee(4) }); waiting = complete(parallel, receipt.requestId).then(() => null, (error) => error);
      await observeWait(observer); await db.query("commit"); assert.equal((await waiting)?.message, "ACCOUNT_EMPLOYEE_INACTIVE");
      assert.equal((await db.query("select count(*)::int n from public.app_accounts where id=$1", [receipt.accountId])).rows[0].n, 0);
      await cancel(db, receipt.requestId); await db.query("delete from auth.users where id=$1", [receipt.authUserId]); await cleanup(db, receipt.requestId);
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  for (const completeFirst of [true, false]) await test(db, `Auth deletion ${completeFirst ? "queued behind provision completion" : "before queued provision completion"} cannot orphan a linked account`, async () => {
    const prepared = await prepare(db, { n: 5 }); await identity(db, prepared); await db.query("begin"); let waiting;
    try {
      if (completeFirst) {
        await complete(db, prepared.requestId); waiting = parallel.query("delete from auth.users where id=$1", [prepared.authUserId]).then(() => null, (error) => error);
      } else {
        await db.query("delete from auth.users where id=$1", [prepared.authUserId]); waiting = complete(parallel, prepared.requestId).then(() => null, (error) => error);
      }
      await observeWait(observer); await db.query("commit");
      assert.equal((await waiting)?.message, completeFirst ? "ACCOUNT_AUTH_LINKED" : "ACCOUNT_AUTH_IDENTITY_MISMATCH");
      if (completeFirst) {
        const deleted = await deletion(db, { account: prepared.accountId }); await db.query("delete from auth.users where id=$1", [prepared.authUserId]); await finishDelete(db, deleted.requestId);
      } else { await cancel(db, prepared.requestId); await cleanup(db, prepared.requestId); }
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  await test(db, "archival queued behind provision completion disables the newly linked account", async () => {
    const prepared = await prepare(db, { n: 5 }); await identity(db, prepared); await db.query("begin"); let waiting;
    try {
      await complete(db, prepared.requestId); waiting = archive(parallel, { employee: employee(5) }).then((version) => ({ version }), (error) => ({ error }));
      await observeWait(observer); await db.query("commit"); assert.deepEqual(await waiting, { version: 2 });
      const row = (await db.query("select status from public.app_accounts where id=$1", [prepared.accountId])).rows[0]; assert.equal(row.status, "disabled");
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
  for (const action of ["disable", "role removal", "offboard", "archive", "delete"]) for (const deletionFirst of [true, false]) await test(db, `administrator deletion ${deletionFirst ? "before" : "after"} queued ${action} preserves the final administrator`, async () => {
    await restoreAdmins();
    const versions = Object.fromEntries((await db.query("select id,row_version from public.employees where id=any($1::uuid[])", [[employee(1), employee(2)]])).rows.map((r) => [r.id, r.row_version]));
    const competing = (client) => action === "disable" ? status(client, account(2), "disabled", account(14)) : action === "role removal" ? roles(client, account(2), [roleIds.employee], account(14)) : action === "archive" ? archive(client, { employee: employee(2), version: versions[employee(2)] }) : action === "delete" ? deletion(client, { account: account(2) }) : patch(client, { employment_status: "terminated", termination_date: "2026-10-22", termination_reason: "Integration race" }, { employee: employee(2), version: versions[employee(2)], actor: account(11) });
    await db.query("begin"); let waiting;
    try {
      if (deletionFirst) { await deletion(db, { account: account(1) }); waiting = competing(parallel).then(() => null, (error) => error); }
      else { await competing(db); waiting = deletion(parallel, { account: account(1) }).then(() => null, (error) => error); }
      await observeWait(observer); await db.query("commit"); assert.equal((await waiting)?.message, "LAST_ACTIVE_ADMIN"); assert.equal(await countAdmins(), 1);
    } catch (error) { await db.query("rollback"); if (waiting) await waiting; throw error; }
  }, false);
}
