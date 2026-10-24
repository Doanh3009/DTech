import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile,writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
const target="tcjjhxqtreemccdbvyza";
const filename="202610220004_product_trial_requests.sql";
const hash=value=>createHash("sha256").update(value).digest("hex");
async function read(file){const bytes=await readFile(file);return bytes[0]===0xff&&bytes[1]===0xfe?bytes.subarray(2).toString("utf16le"):bytes.toString("utf8").replace(/^\uFEFF/,"");}
const manifest=JSON.parse(await read("supabase/deployments/dtech-erp.json"));assert.equal(manifest.projectRef,target);assert.equal(manifest.application.environment,"development");assert.equal((await read("supabase/.temp/project-ref")).trim(),target);
const native=JSON.parse(await read("docs/commercial-erp/evidence/trial-requests-integration.json"));assert.equal(native.failed,0);assert(native.passed>=32&&native.clusterStopped&&native.cloudAccess===false);
for(const migration of native.migrations)assert.equal(hash(await readFile(`supabase/migrations/${migration.filename}`)),migration.sha256);
assert.equal(hash(await readFile("supabase/tests/trial-requests.integration.mjs")),native.runnerSha256);
const before=JSON.parse(await read(".tmp/erp-marketing-before.json")).rows[0].evidence;
const after=JSON.parse(await read(".tmp/erp-marketing-after.json")).rows[0].evidence;
const acl=JSON.parse(await read(".tmp/erp-marketing-verify.json")).rows[0].evidence;
assert.equal(before.migrationCount,59);assert.equal(after.migrationCount,60);assert.equal(after.latestMigration,"202610220004");assert.equal(before.trialTableExists,false);assert.equal(after.trialTableExists,true);assert.equal(after.permissions,before.permissions+2);
for(const key of ["accounts","activeAccounts","authUsers","employees","employeeHistoryEvents","projects","inventoryItems","warehouses"])assert.equal(after[key],before[key],key);
assert.deepEqual(after.settingsVersions,before.settingsVersions);
assert.equal(acl.trialCount,0);assert.equal(acl.rls,true);assert.equal(acl.serviceSelect,true);for(const key of ["serviceWrite","anonSelect","authenticatedSelect"])assert.equal(acl[key],false,key);
assert.deepEqual(acl.grantedRoles,[{permission:"trial_request.manage",role:"admin"},{permission:"trial_request.view",role:"admin"}]);assert.equal(acl.commands.length,2);
for(const command of acl.commands){assert.equal(command.securityDefiner,true);assert.deepEqual(command.config,['search_path=""']);assert.equal(command.serviceExecute,true);assert.equal(command.anonExecute,false);assert.equal(command.authenticatedExecute,false);}
const dryRun=await read(".tmp/erp-marketing-dry-run.log");assert.deepEqual([...new Set(dryRun.match(/\d{12,14}_[a-z_]+\.sql/g)??[])],[filename]);const apply=await read(".tmp/erp-marketing-apply.log");assert(apply.includes(`Applying migration ${filename}`)&&apply.includes("Finished supabase db push"));
const env=parseEnv(await readFile(".env.local","utf8"));assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,`${target}.supabase.co`);assert(env.SESSION_HASH_PEPPER?.length>=32);assert((env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY)?.length>=12);
const evidence={generatedAt:new Date().toISOString(),environment:"development",projectRef:target,applied:true,migration:native.migrations.find(m=>m.filename===filename),nativePostgres:{version:native.postgresVersion,passed:native.passed,clusterStopped:true,cloudAccess:false},applicationSecretConfigurationPresent:true,dryRunSha256:hash(dryRun),applyLogSha256:hash(apply),before,after,acl,existingRecordCountsUnchanged:true,settingsVersionsUnchanged:true,boundaries:["No production deployment, customer instance provisioning or production migration.","No live trial lead or Auth account was created/deleted or provisioned for acceptance. Audit sign-in/out updates its own authentication/session metadata; synthetic lead commands are intercepted.","Manual qualification and account/environment provisioning remain operator work; no email automation is enabled.","Contact retention/purge, ingress abuse protection and customer case-study approval remain operational publication requirements."]};
await writeFile("docs/commercial-erp/evidence/marketing-rollout.json",JSON.stringify(evidence,null,2));console.log(JSON.stringify({applied:true,migrations:after.migrationCount,nativeChecks:native.passed,leadCount:acl.trialCount,existingRecordCountsUnchanged:true}));
