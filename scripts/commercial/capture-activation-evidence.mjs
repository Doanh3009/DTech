import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { loadDeploymentManifest } from "../database/deployment-manifest.mjs";

async function json(file) {
  const bytes = await readFile(file);
  const text = bytes[0] === 0xff && bytes[1] === 0xfe ? bytes.subarray(2).toString("utf16le") : bytes.toString("utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text);
}
const { target } = await loadDeploymentManifest();
assert.equal(target.projectRef, "tcjjhxqtreemccdbvyza");
assert.equal(target.application.environment, "development");
const before = (await json(".tmp/erp-p2-cloud-preflight.json")).rows[0].preflight;
const after = (await json(".tmp/erp-p2-cloud-verification.json")).rows[0].verification;
const browser = await json(".tmp/erp-p2-setup-published/report.json");
const integration = await json("docs/commercial-erp/evidence/atomic-settings-integration.json");
const sha = createHash("sha256").update(await readFile("supabase/migrations/202610210002_atomic_system_settings.sql")).digest("hex");
assert.equal(integration.migrationSha256, sha);
assert.equal(integration.failed, 0);
assert.equal(integration.clusterStopped, true);
assert.equal(before.commandExists, false);
assert.equal(after.migrationCount, before.migrationCount + 1);
assert.equal(after.latestMigration, "202610210002");
assert.equal(after.commandCount, 1);
for (const group of Object.keys(before.versions)) {
  assert.equal(after.versions[group], before.versions[group] + (["branding", "organization", "localization", "modules"].includes(group) ? 1 : 0));
}
for (const key of ["activeAccounts", "projects", "inventoryItems", "warehouses"]) assert.equal(after[key], before[key]);
assert.equal(after.commandsRls, true);
assert.equal(after.serviceCanReadReceipt, true);
assert.equal(after.serviceCanExecute, true);
for (const key of ["serviceCanInsertReceipt", "serviceCanUpdateReceipt", "serviceCanDeleteReceipt", "anonymousCanExecute", "authenticatedCanExecute"]) assert.equal(after[key], false);
assert.equal(browser.checks.semanticConfigurationPreserved, true);
assert.equal(browser.checks.retryDoesNotIncrementVersions, true);
assert.equal(browser.checks.changedRequestAndStaleVersionsRejected, true);
const evidence = {
  generatedAt: new Date().toISOString(),
  environment: "development", projectRef: target.projectRef,
  migration: { version: after.latestMigration, sha256: sha, beforeCount: before.migrationCount, afterCount: after.migrationCount },
  databaseVersion: before.postgresVersion,
  integration: { postgresVersion: integration.postgresVersion, passed: integration.passed, clusterStopped: true },
  writes: { schemaMigration: true, configurationCommands: after.commandCount, operationalDocuments: false },
  configuration: { semanticValuesPreserved: true, versionsBefore: before.versions, versionsAfter: after.versions },
  security: {
    receiptRls: true, serviceReadsReceipt: true, serviceExecutesCommand: true,
    serviceDirectReceiptWrites: false, anonymousExecution: false, authenticatedExecution: false
  },
  checks: browser.checks,
  scope: "Selected DTech development Supabase project. Four-group UI publish preserved semantic values and advanced versions once; identical retry, changed request and stale version checks completed. No production deployment or operational documents."
};
await writeFile("docs/commercial-erp/evidence/activation-rollout.json", JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ captured: true, environment: evidence.environment, migration: after.latestMigration, configurationCommands: after.commandCount }));
