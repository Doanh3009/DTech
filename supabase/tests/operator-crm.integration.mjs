import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash,randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace=process.cwd();
const pgRequire=createRequire(path.join(workspace,".tmp/erp-postgres/package.json"));
const {Client}=pgRequire("pg");
const binaryRoot=process.env.ERP_TEST_PG_BIN;
if(!binaryRoot&&process.platform!=="win32")throw new Error("Set ERP_TEST_PG_BIN to PostgreSQL 17 binaries.");
const binaries=binaryRoot?{initdb:path.join(binaryRoot,process.platform==="win32"?"initdb.exe":"initdb"),pg_ctl:path.join(binaryRoot,process.platform==="win32"?"pg_ctl.exe":"pg_ctl")}:await import(pathToFileURL(pgRequire.resolve("@embedded-postgres/windows-x64")).href);
const directory=path.join(workspace,".tmp/erp-crm-db",randomUUID());
const dataDirectory=path.join(directory,"data");
const migration="202610220005_operator_customer_crm.sql";
const migrations=[];const checks=[];const connections=[];
const actor="10000000-0000-4000-8000-000000000001";
const other="10000000-0000-4000-8000-000000000002";
const role="20000000-0000-4000-8000-000000000001";
const digest=value=>createHash("sha256").update(value).digest("hex");
let started=false;let evidence;let config;
function binary(command,args){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:workspace,shell:false,windowsHide:true,stdio:["ignore","pipe","pipe"]});let output="";child.stdout.on("data",chunk=>output+=chunk);child.stderr.on("data",chunk=>output+=chunk);child.on("error",reject);child.on("exit",code=>{if(code===0)resolve();else reject(new Error(`PostgreSQL process failed: ${output}`));});});}
async function connect(){const client=new Client({...config,statement_timeout:10_000});await client.connect();connections.push(client);return client;}
async function test(db,name,fn){await db.query("begin");try{await fn();checks.push({name,passed:true});}finally{await db.query("rollback");}}
async function fails(db,fn,code){await db.query("savepoint expected_error");try{await assert.rejects(fn,code);}finally{await db.query("rollback to savepoint expected_error; release savepoint expected_error");}}
const {runCrmChecks}=await import("./operator-crm.cases.mjs");

try{
 await mkdir(directory,{recursive:true});const password=randomUUID();const passwordFile=path.join(directory,"password");await writeFile(passwordFile,password,{mode:0o600});
 await binary(binaries.initdb,["-D",dataDirectory,"-U","postgres","--auth=scram-sha-256","--pwfile",passwordFile,"--encoding=UTF8","--locale=C"]);
 const socket=createServer();await new Promise((resolve,reject)=>{socket.once("error",reject);socket.listen(0,"127.0.0.1",resolve);});const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
 await binary(binaries.pg_ctl,["-D",dataDirectory,"-l",path.join(directory,"postgres.log"),"-o",`-h 127.0.0.1 -p ${port}`,"-w","start"]);started=true;
 config={host:"127.0.0.1",port,user:"postgres",password,database:"postgres"};const db=await connect();const parallel=await connect();
 await db.query("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create schema auth; create function auth.uid() returns uuid language sql stable as 'select null::uuid'; alter default privileges in schema public grant all on tables to anon,authenticated,service_role;");
 for(const filename of ["202609090001_foundation_system_primitives.sql","202609090002_employee_rbac_foundation.sql"]){const source=await readFile(path.join(workspace,"supabase/migrations",filename));await db.query(source.toString());migrations.push({filename,sha256:digest(source)});}
 await db.query("insert into public.app_accounts(id,display_name,status) values($1,'Synthetic admin','active'),($2,'Synthetic other','active')",[actor,other]);
 await db.query("insert into public.roles(id,code,name) values($1,'native_trial','Synthetic reviewer')",[role]);
 for(const filename of ["202610220004_product_trial_requests.sql",migration]){const source=await readFile(path.join(workspace,"supabase/migrations",filename));await db.query(source.toString());migrations.push({filename,sha256:digest(source)});}
 await db.query("insert into public.account_roles(account_id,role_id) select $1,id from public.roles where code='deployment_team'",[actor]);
 await runCrmChecks({db,parallel,actor,other,test,fails,checks});
 evidence={generatedAt:new Date().toISOString(),postgresVersion:(await db.query("show server_version")).rows[0].server_version,passed:checks.length,failed:0,checks,migrations,cloudAccess:false,syntheticDataOnly:true,authExercised:false};
}finally{
 await Promise.allSettled(connections.map(client=>client.end()));if(started)await binary(binaries.pg_ctl,["-D",dataDirectory,"-m","fast","-w","stop"]);
 if(evidence){evidence.clusterStopped=true;const ownSource=await readFile(new URL(import.meta.url));evidence.runnerSha256=digest(ownSource);evidence.casesSha256=digest(await readFile(new URL("./operator-crm.cases.mjs",import.meta.url)));await writeFile(path.join(workspace,"docs/commercial-erp/evidence/operator-crm-integration.json"),JSON.stringify(evidence,null,2));console.log(JSON.stringify({passed:evidence.passed,failed:0,clusterStopped:true,cloudAccess:false}));}
}
