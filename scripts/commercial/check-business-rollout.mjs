import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function read(file){const b=await readFile(file);return b[0]===255&&b[1]===254?b.toString('utf16le').slice(1):b.toString('utf8').replace(/^\uFEFF/,'');}
const files=['202610230001_shared_business_platform.sql','202610230002_business_industry_entities.sql','202610230003_business_record_commands.sql','202610230004_business_crm_lifecycle.sql','202610230010_business_sales_fulfillment.sql'];
const target='tcjjhxqtreemccdbvyza';const manifest=JSON.parse(await read('supabase/deployments/dtech-erp.json'));
assert.equal(manifest.projectRef,target);assert.equal(manifest.application.environment,'development');assert.equal(manifest.includeDevelopmentSeed,false);assert.equal((await read('supabase/.temp/project-ref')).trim(),target);
const env=parseEnv(await read('.env.local'));assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,manifest.apiUrl);assert.equal(env.DTECH_CONTROL_CENTER_ENABLED,'true');assert(env.SESSION_HASH_PEPPER?.length>=32);
const before=JSON.parse(await read('.tmp/business-before.json')).rows[0].evidence;assert.equal(before.migrationCount,61);assert.equal(before.latestMigration,'202610220005');assert.equal(before.businessTableExists,false);
const native=JSON.parse(await read('docs/commercial-erp/evidence/business-platform-integration.json'));assert(native.passed>=27&&native.failed===0&&native.clusterStopped&&native.cloudAccess===false);
for(const m of native.migrations)assert.equal(hash(await readFile('supabase/migrations/'+m.filename)),m.sha256,m.filename);
assert.equal(hash(await readFile('supabase/tests/business-platform.integration.mjs')),native.runnerSha256);assert.equal(hash(await readFile('supabase/tests/business-platform.cases.mjs')),native.casesSha256);
const line=(await read('.tmp/business-dryrun.log')).split(/\r?\n/).find(l=>l.startsWith('{"upToDate"'));const plan=JSON.parse(line);assert.equal(plan.dryRun,true);assert.deepEqual(plan.migrations,files);assert.deepEqual(plan.seeds,[]);assert.deepEqual(plan.roles,[]);
const migrations=await Promise.all(files.map(async filename=>({filename,sha256:hash(await readFile('supabase/migrations/'+filename))})));
if(process.argv.includes('--after')){
 const after=JSON.parse(await read('.tmp/business-after.json')).rows[0].evidence;const acl=JSON.parse(await read('.tmp/business-acl.json')).rows[0].evidence;
 assert.equal(after.migrationCount,66);assert.equal(after.latestMigration,'202610230010');assert.equal(after.businessTableExists,true);
 for(const [key,value]of Object.entries(before))if(!['migrationCount','latestMigration','businessTableExists'].includes(key))assert.deepEqual(after[key],value,key);
 assert.equal(acl.industryCount,6);assert.equal(acl.entityCount,23);for(const key of ['tenantCount','accountCount','sessionCount','commandCount'])assert.equal(acl[key],0,key);
 assert.equal(acl.tables.length,31);for(const t of acl.tables){assert(t.rls);for(const key of ['anonSelect','authenticatedSelect','serviceSelect','serviceWrite'])assert.equal(t[key],false,t.name+':'+key);}
 for(const f of acl.functions){assert(f.definer);assert.deepEqual(f.config,['search_path=""']);assert(!f.anonExecute&&!f.authenticatedExecute);assert.equal(f.serviceExecute,!['business_assert_session','business_assert_kind','business_command_replay','business_check_stock','business_guard_sales_stock'].includes(f.name));}
 const evidence={generatedAt:new Date().toISOString(),target,environment:'development',migrations,nativeChecks:native.passed,before,after,acl,preservedExistingData:true,syntheticCustomerWrites:false,customerAccountsCreated:false};await writeFile('docs/commercial-erp/evidence/business-platform-rollout.json',JSON.stringify(evidence,null,2));
}
console.log(JSON.stringify({passed:true,stage:process.argv.includes('--after')?'verified':'preflight',target,migrations:files.length,nativeChecks:native.passed}));
