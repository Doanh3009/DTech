import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const migration = "202610220001_atomic_employee_profile.sql";
const projectRef = "tcjjhxqtreemccdbvyza";
async function read(file) {
  const bytes = await readFile(file);
  return bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString("utf16le") : bytes.toString("utf8").replace(/^\uFEFF/, "");
}
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const localRef = (await read("supabase/.temp/project-ref")).trim();
assert.equal(localRef, projectRef, "Development target mismatch.");
const native = JSON.parse(await read("docs/commercial-erp/evidence/atomic-employee-integration.json"));
assert.equal(native.failed, 0);
assert(native.passed >= 88 && native.clusterStopped === true && native.cloudAccess === false);
assert.equal(native.migration, migration);
assert.equal(sha256(await read(`supabase/migrations/${migration}`)), native.migrationSha256);
assert.equal(sha256(await read("supabase/tests/atomic-employee.integration.mjs")), native.testSuiteSha256);
assert.equal(sha256(await read("supabase/tests/atomic-employee.fixture.sql")), native.fixtureSha256);
for (const source of native.baselineMigrations) {
  assert.equal(sha256(await read(`supabase/migrations/${source.filename}`)), source.sourceSha256);
}
const before = JSON.parse(await read(".tmp/erp-p3-preflight.json")).rows[0].evidence;
const after = JSON.parse(await read(".tmp/erp-p3-verify.json")).rows[0].evidence;
assert.equal(before.migrationCount, 56);
assert.equal(before.latestMigration, "202610210002");
assert.equal(after.migrationCount, 57);
assert.equal(after.latestMigration, "202610220001");
const countKeys = ["accounts", "activeAccounts", "employees", "terminatedEmployees", "employeeHistoryEvents", "projects", "inventoryItems", "warehouses"];
for (const key of countKeys) assert.equal(after[key], before[key], `Unexpected count change: ${key}`);
assert.deepEqual(after.settingsVersions, before.settingsVersions);
assert.equal(after.commands.length, 5);
for (const command of after.commands) {
  assert.equal(command.exists, true);
  assert.equal(command.securityDefiner, true);
  assert.deepEqual(command.config, ['search_path=""']);
  assert.equal(command.anonCanExecute, false);
  assert.equal(command.authenticatedCanExecute, false);
  assert.equal(command.serviceCanExecute, !command.privateHelper);
  if (!command.privateHelper) assert.equal(command.hasLifecycleLock, true);
}
const dryRun = await read(".tmp/erp-p3-migration-dry-run.log");
const pending = [...new Set(dryRun.match(/\d{12,14}_[a-z_]+\.sql/g) ?? [])];
assert.deepEqual(pending, [migration]);
const applyLog = await read(".tmp/erp-p3-migration-apply.log");
assert(applyLog.includes(`Applying migration ${migration}`) && applyLog.includes("Finished supabase db push"));
const evidence = {
  generatedAt: new Date().toISOString(), projectRef, environment: "development", migration,
  migrationSha256: native.migrationSha256,
  nativePostgres: { version: native.postgresVersion, passed: native.passed, clusterStopped: native.clusterStopped },
  dryRun: { pendingMigrations: pending, sha256: sha256(dryRun) },
  applied: true, applyLogSha256: sha256(applyLog),
  before, after,
  recordCountsUnchanged: true, settingsVersionsUnchanged: true,
  boundaries: [
    "Additive function migration on the explicitly selected DTech development project; no production deployment.",
    "No live employee profile edits, offboarding, account deletion or Auth provisioning were executed for acceptance.",
    "Counts and function ACLs were verified remotely. Business rollback and concurrency tests ran only on isolated native PostgreSQL.",
    "Auth compensation, account deletion, sensitive/archive commands, external writers and full Supabase/UAT remain separate release work."
  ]
};
await writeFile("docs/commercial-erp/evidence/employee-rollout.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ applied: evidence.applied, environment: evidence.environment, migration, migrationCount: after.migrationCount, nativeChecks: native.passed, recordCountsUnchanged: true }));
