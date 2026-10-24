import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const projectRef = "tcjjhxqtreemccdbvyza";
const migrations = ["202610220002_account_lifecycle_recovery.sql", "202610220003_atomic_employee_auxiliary.sql"];
const hash = (value) => createHash("sha256").update(value).digest("hex");
async function read(file) {
  const bytes = await readFile(file);
  return bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString("utf16le") : bytes.toString("utf8").replace(/^\uFEFF/, "");
}
const manifest = JSON.parse(await read("supabase/deployments/dtech-erp.json"));
assert.equal(manifest.projectRef, projectRef);
assert.equal(manifest.application.environment, "development");
assert.equal((await read("supabase/.temp/project-ref")).trim(), projectRef);
const native = JSON.parse(await read("docs/commercial-erp/evidence/atomic-lifecycle-integration.json"));
assert.equal(native.failed, 0);
assert(native.passed >= 165 && native.clusterStopped === true && native.cloudAccess === false && native.externalAuthExercised === false);
assert.deepEqual(native.migrations.map((item) => item.filename), migrations);
for (const item of native.migrations) assert.equal(hash(await readFile(`supabase/migrations/${item.filename}`)), item.sha256);
for (const item of native.sources) assert.equal(hash(await readFile(item.filename)), item.sha256);
for (const item of native.baselineMigrations) assert.equal(hash(await readFile(`supabase/migrations/${item.filename}`)), item.sourceSha256);
const before = JSON.parse(await read(".tmp/erp-p3b-preflight.json")).rows[0].evidence;
const after = JSON.parse(await read(".tmp/erp-p3b-after.json")).rows[0].evidence;
const acl = JSON.parse(await read(".tmp/erp-p3b-verify.json")).rows[0].evidence;
assert.equal(before.migrationCount, 57); assert.equal(before.latestMigration, "202610220001");
assert.equal(after.migrationCount, 59); assert.equal(after.latestMigration, "202610220003");
for (const key of ["accounts", "activeAccounts", "deletedAccounts", "authUsers", "employees", "employeeHistoryEvents", "legacyRecoveriesPending", "roles", "projects", "inventoryItems", "warehouses"]) {
  assert.equal(after[key], before[key], `Unexpected record count: ${key}`);
}
assert.equal(before.legacyRecoveriesPending, 0);
assert.equal(after.permissions, before.permissions + 1);
assert.equal(before.deletePermissionExists, false); assert.equal(after.deletePermissionExists, true);
assert.equal(after.rolesGrantedDelete, 1);
assert.deepEqual(after.settingsVersions, before.settingsVersions);
assert.equal(before.operationsTableExists, false); assert.equal(after.operationsTableExists, true);
assert.equal(after.lifecycleTriggers.length, 4);
assert(after.lifecycleTriggers.every((trigger) => trigger.enabled === "O"));
assert.equal(acl.operationsRls, true); assert.equal(acl.operationCount, 0);
assert.equal(acl.serviceCanReadOperations, true);
for (const key of ["serviceCanInsertOperations", "serviceCanUpdateOperations", "serviceCanDeleteOperations", "anonCanReadOperations", "authenticatedCanReadOperations", "legacyProvisionServiceExecute"]) assert.equal(acl[key], false, key);
assert.equal(acl.commands.length, 17);
for (const command of acl.commands) {
  assert.equal(command.exists, true); assert.equal(command.securityDefiner, true);
  assert.deepEqual(command.config, ['search_path=""']);
  assert.equal(command.serviceExecute, command.exposed);
  assert.equal(command.anonExecute, false); assert.equal(command.authenticatedExecute, false);
}
const dryRun = await read(".tmp/erp-p3b-migration-dry-run.log");
const pending = [...new Set(dryRun.match(/\d{12,14}_[a-z_]+\.sql/g) ?? [])];
assert.deepEqual(pending, migrations);
const applyLog = await read(".tmp/erp-p3b-migration-apply.log");
assert(migrations.every((filename) => applyLog.includes(`Applying migration ${filename}`)) && applyLog.includes("Finished supabase db push"));
const probe = JSON.parse(await read(".tmp/erp-p3b-auth-probe.json"));
assert.equal(probe.status, 404); assert.equal(probe.code, "user_not_found"); assert.equal(probe.userPresent, false); assert.equal(probe.writesAuthData, false);
const evidence = {
  generatedAt: new Date().toISOString(), projectRef, environment: "development", applied: true,
  migrations: native.migrations, nativePostgres: { version: native.postgresVersion, passed: native.passed, clusterStopped: true },
  readonlyAuthProbe: probe, dryRun: { pendingMigrations: pending, sha256: hash(dryRun) }, applyLogSha256: hash(applyLog),
  before, after, acl, recordCountsUnchanged: true, settingsVersionsUnchanged: true,
  intentionalPermissionChange: "Added account.delete and granted only to the admin role; non-employee provisioning also requires account.assign_role.",
  boundaries: [
    "Development database migration only; no production application deployment or migration.",
    "No live Auth creation/deletion, account offboarding, archive or sensitive-data mutation was performed for acceptance.",
    "Native Auth table/limited-role tests and mocked HTTP unit tests are not a complete Supabase Auth stack rehearsal.",
    "Migration installs scoped Auth identity, linked-identity deletion, session registration and tombstone-role guards. Direct operator SQL and future schema changes require review.",
    "Existing legacy recovery queue was empty at preflight. No legacy identity was automatically deleted or reconciled.",
    "UAT, dual-instance isolation, retention, restore drill and commercial/IP acceptance remain separate gates."
  ]
};
await writeFile("docs/commercial-erp/evidence/lifecycle-rollout.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ applied: true, environment: evidence.environment, migrations: 2, migrationCount: after.migrationCount, nativeChecks: native.passed, operationCount: acl.operationCount, recordCountsUnchanged: true }));
