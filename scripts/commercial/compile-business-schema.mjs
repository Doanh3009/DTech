import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.cwd();const req=createRequire(path.join(root,'.tmp/erp-postgres/package.json'));
const {Client}=req('pg');const binaries=await import(pathToFileURL(req.resolve('@embedded-postgres/windows-x64')).href);
const directory=path.join(root,'.tmp/erp-schema-build',randomUUID());const data=path.join(directory,'data');let db;let started=false;let completed=false;
function binary(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',v=>output+=v);p.stderr.on('data',v=>output+=v);p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(output)));});}
try{
 await mkdir(directory,{recursive:true});const password=randomUUID();const passwordFile=path.join(directory,'password');await writeFile(passwordFile,password);
 await binary(binaries.initdb,['-D',data,'-U','postgres','--auth=scram-sha-256','--pwfile',passwordFile,'--encoding=UTF8','--locale=C']);
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 await binary(binaries.pg_ctl,['-D',data,'-l',path.join(directory,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);started=true;
 db=new Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres',statement_timeout:20000});await db.connect();
 await db.query("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as 'select null::uuid';");
 const files=['202609090001_foundation_system_primitives.sql','202609090002_employee_rbac_foundation.sql','202610220004_product_trial_requests.sql','202610220005_operator_customer_crm.sql',...(await readdir('supabase/migrations')).filter(n=>/^202610(?:23|24)\d+_.*business.*\.sql$/.test(n)).sort()];
 const migrations=[];for(const filename of files){const source=await readFile(path.join(root,'supabase/migrations',filename));await db.query(source.toString());migrations.push({filename,sha256:createHash('sha256').update(source).digest('hex')});}
 const registry=JSON.parse(await readFile('src/config/businessEntities.json','utf8'));const definitions=(await db.query('select kind,definition from public.business_entity_definitions order by kind')).rows;
 // jsonb key order is canonicalized by PostgreSQL; compare recursively with sorted keys.
 const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
 if(definitions.some(r=>canonical(registry[r.kind])!==canonical(r.definition))||definitions.length!==Object.keys(registry).length)throw new Error('Entity registry differs from SQL definitions');
 if(process.argv.includes('--populate-experience')){
  await db.query("insert into public.app_accounts(display_name) values('Quản trị cục bộ');");
  try {const sampleSql=(await readFile('.tmp/dimixo-experience.sql','utf8')).replace(/(public\.business_entity_definitions\)<>)[0-9]+/,(_,prefix)=>prefix+Object.keys(registry).length);await db.query(sampleSql);}catch(e){console.error(e.where);throw e;}
  const capture=(await import('./finance-demo-sql.mjs')).financeDemoSql(JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8')));
  if(process.argv.includes('--populate-operations'))await (await import('./populate-business-operations.mjs')).populateBusinessOperations(db,{capture});
  if(process.argv.includes('--populate-attendance'))await (await import('./populate-business-attendance.mjs')).populateBusinessAttendance(db,{capture});
  if(process.argv.includes('--populate-misa')){
   await (await import('./populate-misa-finance.mjs')).populateMisaFinance(db,{capture});
   console.log(JSON.stringify({businessSql:await capture.write('.tmp/misa-business-development.sql')}));
  }
  if(process.argv.includes('--replay-misa'))await db.query(await readFile('.tmp/misa-business-development.sql','utf8'));
  if(process.argv.includes('--populate-crm')){
   const crmCapture=(await import('./finance-demo-sql.mjs')).financeDemoSql(JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8')),{domain:'crm'});
   await (await import('./populate-business-crm.mjs')).populateBusinessCrm(db,{capture:crmCapture});
   console.log(JSON.stringify({crmSql:await crmCapture.write('.tmp/misa-crm-development.sql')}));
  }
  if(process.argv.includes('--replay-crm'))await db.query(await readFile('.tmp/misa-crm-development.sql','utf8'));
  console.log(JSON.stringify({experience:(await db.query('select t.slug,(select count(*) from public.business_accounts where tenant_id=t.id) accounts,(select count(*) from public.business_journal_entries where tenant_id=t.id and status=\'posted\') journals from public.business_tenants t order by slug')).rows}));
  const credentials=JSON.parse(await readFile('.tmp/dimixo-experience-credentials.json','utf8'));const snapshots={};
  for(const company of JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8'))){
   await db.query('update public.business_sessions set revoked_at=null,expires_at=now()+interval \'1 hour\' where token_hash=$1',[credentials[company.slug].ownerHash]);
   const snapshot=(await db.query('select public.business_company_dashboard($1,$2,$3) data',[credentials[company.slug].ownerHash,company.slug,'2026-10-01'])).rows[0].data;
   snapshots[company.industry]=snapshot;console.log(JSON.stringify({dashboard:company.industry,workRows:snapshot.work.length,alerts:snapshot.alerts.total}));
   const procurement=(await db.query('select public.business_procurement_matching($1,$2,1,\'\') data',[credentials[company.slug].ownerHash,company.slug])).rows[0].data;
   console.log(JSON.stringify({procurement:company.industry,orders:procurement.totals.count,discrepancies:procurement.totals.discrepancies}));
   if(process.argv.includes('--populate-attendance')){const people=(await db.query('select public.business_people_workspace($1,$2,$3,$4,1) data',[credentials[company.slug].ownerHash,company.slug,'2026-10-01','2026-10-24'])).rows[0].data;console.log(JSON.stringify({peopleWorkspace:company.industry,staff:people.total,totals:people.totals}));}
   if(process.argv.includes('--populate-crm')||process.argv.includes('--replay-crm'))for(const view of ['pipeline','quotes','tickets','campaigns']){const crm=(await db.query('select public.business_crm_workspace($1,$2,$3,1) data',[credentials[company.slug].ownerHash,company.slug,view])).rows[0].data;console.log(JSON.stringify({crmWorkspace:company.industry,view,total:crm.total}));}
   if(process.argv.includes('--populate-operations')){
    const data=(await db.query('select public.business_workflow_workspace($1,$2,\'procurement\',1,null) data',[credentials[company.slug].ownerHash,company.slug])).rows[0].data;
    for(const row of data.rows)await db.query('select public.business_workflow_workspace($1,$2,\'procurement\',1,$3)',[credentials[company.slug].ownerHash,company.slug,row.id]);
    console.log(JSON.stringify({workflow:company.industry,requests:data.total}));
    if(company.industry==='construction')console.log(JSON.stringify({projectWorkflow:(await db.query('select public.business_workflow_workspace($1,$2,\'projects\',1,null) data',[credentials[company.slug].ownerHash,company.slug])).rows[0].data.total}));
   }
   if(process.argv.includes('--populate-misa'))for(const view of ['assets','bank','advances','loans','costing','tax','payroll','reports']){const data=(await db.query('select public.business_misa_snapshot($1,$2,$3,$4,$5,1) data',[credentials[company.slug].ownerHash,company.slug,view,'2026-10-01','2026-10-24'])).rows[0].data;console.log(JSON.stringify({readModel:company.industry,view,total:data.total}));}
  }
  await writeFile('src/config/businessDashboardPreviews.json',JSON.stringify(snapshots,null,2)+'\n');
 }
 await writeFile('docs/commercial-erp/evidence/industry-schema-build.json',JSON.stringify({generatedAt:new Date().toISOString(),schemaCompiled:true,entityCount:definitions.length,migrations,cloudAccess:false,realCustomerRecordsCreated:false,syntheticDataPopulated:process.argv.includes("--populate-experience"),testSuiteRun:false},null,2));
 completed=true;console.log(JSON.stringify({schemaCompiled:true,migrations:files.length,entities:definitions.length,cloudAccess:false,testSuiteRun:false}));
}finally{await db?.end();if(started)await binary(binaries.pg_ctl,['-D',data,'-m','fast','-w','stop']);if(completed&&!process.argv.includes('--keep-local-data')){const temporaryRoot=path.resolve(root,'.tmp/erp-schema-build');const relative=path.relative(temporaryRoot,path.resolve(directory));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Refuse cleanup outside generated cluster');await rm(directory,{recursive:true,force:false,maxRetries:5,retryDelay:100}).catch(error=>{if(["EPERM","EBUSY","ENOTEMPTY"].includes(error.code))console.warn(JSON.stringify({cleanupPending:relative,code:error.code}));else throw error;});}}
