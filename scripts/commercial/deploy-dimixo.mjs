import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,readdir,writeFile,mkdir,unlink,stat,rm} from 'node:fs/promises';
import {appendFileSync} from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';

// A separate development deployment. The existing internal Vercel project is not changed.
const projectName='dimixo-erp',teamId='team_P6ZUPEQGflrU8soIrX7UPUVD',developmentProject='tcjjhxqtreemccdbvyza';
const env=parseEnv(await readFile('.env.local','utf8'));
assert(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname===`${developmentProject}.supabase.co`,'Unexpected database destination');
const candidates=[];
for(const entry of await readdir(path.join(process.env.LOCALAPPDATA,'npm-cache','_npx'),{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 const dir=path.join(process.env.LOCALAPPDATA,'npm-cache','_npx',entry.name,'node_modules','vercel');
 const pkg=await readFile(path.join(dir,'package.json'),'utf8').then(JSON.parse).catch(()=>null);
 if(pkg)candidates.push({version:pkg.version,filename:path.join(dir,'dist','index.js')});
}
candidates.sort((a,b)=>b.version.localeCompare(a.version,undefined,{numeric:true}));assert(candidates.length,'Vercel CLI is required');
await mkdir('.tmp',{recursive:true});
function redact(s){for(const v of Object.values(env).filter(v=>v.length>=12))s=s.replaceAll(v,'[redacted]');return s;}
async function cli(args,{cwd=process.cwd()}={}){
 const liveFile=args[0]==='deploy'?path.resolve('.tmp/dimixo-vercel-live.private.log'):null;
 if(liveFile)await writeFile(liveFile,'');
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[candidates[0].filename,...args,'--scope',teamId],{cwd,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  p.stdout.on('data',b=>{stdout+=b;if(liveFile)appendFileSync(liveFile,redact(String(b)));});p.stderr.on('data',b=>{stderr+=b;if(liveFile)appendFileSync(liveFile,redact(String(b)));});p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));
 });
}
async function local(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('close',code=>code===0?resolve(output.trim()):reject(Error(redact(output))));});}
async function api(endpoint,method='GET',body){
 const args=['api',endpoint,'--method',method,'--raw'];let input;
 if(body!==undefined){input=path.join('.tmp',`dimixo-vercel-${randomUUID()}.private.json`);await writeFile(input,JSON.stringify(body),{flag:'wx',mode:0o600});args.push('--input',input,'--header','Content-Type: application/json');}
 let r;try{r=await cli(args);}finally{if(input)await unlink(input);}
 if(r.code!==0)throw Error(`Vercel API ${method} failed: ${redact(r.stderr).slice(-1200)}`);
 return JSON.parse(r.stdout);
}
const project=await api(`/v9/projects/${projectName}`);
assert(project.name===projectName&&project.accountId===teamId,'Unexpected Vercel project');
const domains=await api(`/v9/projects/${project.id}/domains`);
const primary=(domains.domains||[]).find(d=>d.name===`${projectName}.vercel.app`)||(domains.domains||[]).find(d=>d.name.endsWith('.vercel.app')&&!d.redirect);
assert(primary,'A Vercel domain is required');
const baseUrl=`https://${primary.name}`;
const action=process.argv[2]||'plan';
if(action==='plan'){
 console.log(JSON.stringify({project:projectName,projectId:project.id,teamId,baseUrl,databaseProject:developmentProject,releaseEnvironment:'development',target:'production',testToolsEnabled:false}));
}else if(action==='configure'){
 const sha=process.argv[3];assert(/^[a-f0-9]{40}$/.test(sha||''),'Use the exact committed source SHA');
 // Only two server secrets are required by this ERP release. Provider/worker keys stay local.
 const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SESSION_HASH_PEPPER','APP_TIMEZONE','DTECH_CONTROL_CENTER_ENABLED'];
 const configuration=Object.fromEntries(keys.filter(k=>env[k]).map(k=>[k,env[k]]));
 for(const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','SESSION_HASH_PEPPER'])assert(configuration[k],`Missing ${k}`);
 Object.assign(configuration,{APP_BASE_URL:baseUrl,APP_ENV:'development',RELEASE_ENVIRONMENT:'development',TEST_TOOLS_ENABLED:'false',RELEASE_SHA:sha});
 let configured=0;
 for(const[key,value]of Object.entries(configuration)){
  const response=await api(`/v10/projects/${project.id}/env?upsert=true`,'POST',{key,value,type:'encrypted',target:['production','preview']});
  assert(!response.failed?.length,`Environment variable ${key} was not accepted`);
  configured++;if(configured%3===0)console.log(JSON.stringify({configured,total:Object.keys(configuration).length}));
 }
 await writeFile('.tmp/dimixo-vercel-project.private.json',JSON.stringify({projectName,projectId:project.id,orgId:teamId,baseUrl,releaseSha:sha}));
 console.log(JSON.stringify({configured:true,variables:Object.keys(configuration).length,project:projectName,baseUrl,releaseSha:sha}));
}else if(action==='release'){
 const sha=process.argv[3];assert(/^[a-f0-9]{40}$/.test(sha||''),'Use the exact committed source SHA');
 const record=JSON.parse(await readFile('.tmp/dimixo-vercel-project.private.json','utf8'));assert(record.projectId===project.id,'Configure the project first');
 const response=await api(`/v10/projects/${project.id}/env?upsert=true`,'POST',{key:'RELEASE_SHA',value:sha,type:'encrypted',target:['production','preview']});
 assert(!response.failed?.length,'Release SHA was not accepted');
 await writeFile('.tmp/dimixo-vercel-project.private.json',JSON.stringify({...record,releaseSha:sha}));console.log(JSON.stringify({releaseSha:sha}));
}else if(action==='deploy'){
 const record=JSON.parse(await readFile('.tmp/dimixo-vercel-project.private.json','utf8'));assert(record.projectId===project.id,'Configure the project first');
 const head=await local('git',['rev-parse','HEAD']);assert(head===record.releaseSha,'Release SHA must match the committed source');
 const releaseDirectory=path.resolve('.tmp/releases',randomUUID()),archive=releaseDirectory+'.tar';
 await mkdir(releaseDirectory,{recursive:true});
 await local('git',['archive','--format=tar',`--output=${archive}`,head]);
 await local('tar',['-xf',archive,'-C',releaseDirectory]);
 // Historical screenshots are documentation artifacts, outside the application source.
 const screenshotDirectory=path.resolve(releaseDirectory,'docs/ui-evidence');
 const screenshotRelative=path.relative(releaseDirectory,screenshotDirectory);
 assert(screenshotRelative&&!screenshotRelative.startsWith('..')&&!path.isAbsolute(screenshotRelative),'Refuse cleanup outside the isolated release');
 await rm(screenshotDirectory,{recursive:true,force:true});
 console.log(JSON.stringify({sourceCommit:head,sourceArchiveBytes:(await stat(archive)).size}));
 const r=await cli(['deploy',releaseDirectory,'--project',project.id,'--prod','--yes','--json','--archive','tgz','--regions','sin1'],{cwd:releaseDirectory});
 await writeFile('.tmp/dimixo-vercel-deployment.private.log',redact(r.stdout+'\n'+r.stderr));
 assert(r.code===0,`Vercel deployment failed: ${redact(r.stderr).slice(-1800)}`);
 const output=JSON.parse(r.stdout);await writeFile('.tmp/dimixo-vercel-deployment.private.json',JSON.stringify(output));
 console.log(JSON.stringify({deployed:true,baseUrl,releaseSha:record.releaseSha,resultKeys:Object.keys(output)}));
}else if(action==='status'){
 const result=await api(`/v6/deployments?projectId=${project.id}&limit=3`);
 console.log(JSON.stringify({project:projectName,baseUrl,deployments:result.deployments.map(d=>({id:d.uid,url:d.url,state:d.state,target:d.target,created:d.created}))}));
}else throw Error('Use plan, configure <SHA>, release <SHA>, deploy, or status');
