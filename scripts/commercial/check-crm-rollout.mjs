import assert from "node:assert/strict";
import { readFile,writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseEnv } from "node:util";
const hash=b=>createHash("sha256").update(b).digest("hex");
async function read(name){const b=await readFile(name);return b[0]===255&&b[1]===254?b.toString("utf16le").slice(1):b.toString("utf8").replace(/^\uFEFF/,"");}
const before=JSON.parse(await read(".tmp/erp-crm-before.json")).rows[0].evidence;
const manifest=JSON.parse(await read("supabase/deployments/dtech-erp.json"));
assert.equal(manifest.projectRef,"tcjjhxqtreemccdbvyza");assert.equal(manifest.application.environment,"development");assert.equal(manifest.includeDevelopmentSeed,false);assert.equal((await read("supabase/.temp/project-ref")).trim(),manifest.projectRef);
const env=parseEnv(await read(".env.local"));assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,manifest.apiUrl);assert.equal(env.DTECH_CONTROL_CENTER_ENABLED,"true");assert.equal(before.latestMigration,"202610220004");assert.equal(before.migrationCount,60);assert.equal(before.customerTableExists,false);
const native=JSON.parse(await read("docs/commercial-erp/evidence/operator-crm-integration.json"));assert(native.passed>=27&&native.failed===0&&native.clusterStopped&&native.cloudAccess===false);
for(const m of native.migrations)assert.equal(hash(await readFile(`supabase/migrations/${m.filename}`)),m.sha256);
assert.equal(hash(await readFile("supabase/tests/operator-crm.integration.mjs")),native.runnerSha256);assert.equal(hash(await readFile("supabase/tests/operator-crm.cases.mjs")),native.casesSha256);
const line=(await read(".tmp/erp-crm-dryrun.log")).split(/\r?\n/).find(s=>s.startsWith('{"upToDate"'));const plan=JSON.parse(line);assert.equal(plan.dryRun,true);assert.deepEqual(plan.migrations,["202610220005_operator_customer_crm.sql"]);assert.deepEqual(plan.seeds,[]);
const sha256=hash(await readFile("supabase/migrations/202610220005_operator_customer_crm.sql"));
if(process.argv.includes("--after")){
 const after=JSON.parse(await read(".tmp/erp-crm-after.json")).rows[0].evidence;const verification=JSON.parse(await read(".tmp/erp-crm-verify.json")).rows[0].evidence;
 assert.equal(after.migrationCount,61);assert.equal(after.latestMigration,"202610220005");assert.equal(after.customerTableExists,true);assert.equal(after.permissions,before.permissions+2);assert.equal(after.roles,before.roles+1);
 for(const key of ["accounts","authUsers","employees","employeeHistoryEvents","projects","inventoryItems","warehouses","settingsVersions","trialCount"])assert.deepEqual(after[key],before[key]);
 assert.equal(verification.customerCount,0);assert.equal(verification.activityCount,0);assert.equal(verification.assignedSetupUsers,0);assert.equal(verification.tables.length,2);
 for(const t of verification.tables){assert(t.rls&&t.serviceSelect&&!t.serviceWrite&&!t.anonSelect&&!t.authenticatedSelect);}
 assert.equal(verification.commands.length,7);for(const c of verification.commands){assert(c.securityDefiner&&!c.anonExecute&&!c.authenticatedExecute);assert.deepEqual(c.config,['search_path=""']);assert.equal(c.serviceExecute,!["crm_assert_actor","crm_validate_documents"].includes(c.name));}
 assert.equal(verification.grants.length,4);assert(verification.grants.every(g=>["admin","deployment_team"].includes(g.role)));
 const evidence={generatedAt:new Date().toISOString(),target:manifest.projectRef,environment:"development",migration:"202610220005_operator_customer_crm.sql",sha256,nativePassed:native.passed,before,after,verification,syntheticCloudWrites:false,customerInstancesProvisioned:false};await writeFile("docs/commercial-erp/evidence/operator-crm-rollout.json",JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({passed:true,stage:process.argv.includes("--after")?"verified":"preflight",target:manifest.projectRef,sha256,nativePassed:native.passed}));
