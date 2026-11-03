import{createServer}from'node:http';import{randomBytes,randomUUID}from'node:crypto';import{mkdir,writeFile,readFile}from'node:fs/promises';import path from'node:path';
// A loopback-only HTTP transport over the real isolated PostgreSQL compiler.
// SQL functions, grants, roles and transactions are executed without substitution.
// This does not claim to test the hosted PostgREST or Supabase Storage service.
export async function serveLocalBusinessRpc({createConnection,directory}){
 const apiKey='sb_secret_local_'+randomBytes(32).toString('hex'),pepper=randomBytes(48).toString('hex'),storage=new Map(),storageRoot=path.resolve(directory,'objects');await mkdir(storageRoot,{recursive:true});
 const metadataClient=await createConnection();let signatures;try{signatures=(await metadataClient.query("select p.oid,p.proname,p.proargnames,p.proretset,p.pronargs,p.pronargdefaults,array(select format_type(t,null) from unnest(p.proargtypes) t) argument_types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'business_%' and has_function_privilege('service_role',p.oid,'EXECUTE')")).rows;}finally{await metadataClient.end();}
 async function body(request,limit=1_048_576){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>limit)throw Error('LOCAL_BODY_LIMIT');chunks.push(chunk);}return Buffer.concat(chunks);}
 const counts={rpc:0,storageUploads:0,storageDownloads:0,denied:0},server=createServer(async(request,response)=>{
  function json(status,value){response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(value));}
  try{
   if(request.headers.apikey!==apiKey&&request.headers.authorization!==`Bearer ${apiKey}`){counts.denied++;return json(401,{code:'LOCAL_AUTH_REQUIRED',message:'Local transport key required'});}
   const url=new URL(request.url,'http://127.0.0.1');
   if(request.method==='GET'&&url.pathname==='/rest/v1/system_settings'){const client=await createConnection();try{return json(200,(await client.query('select * from public.system_settings')).rows);}finally{await client.end();}}
   const object=url.pathname.match(/^\/storage\/v1\/object\/(?:authenticated\/)?business-private\/([a-f0-9-]{36}\/[a-z_]+\/[a-f0-9-]{36}\/[a-f0-9-]{36})$/);
   if(object){const objectPath=object[1],target=path.resolve(storageRoot,...objectPath.split('/'));if(!target.startsWith(storageRoot+path.sep))throw Error('LOCAL_STORAGE_PATH');
    if(['POST','PUT'].includes(request.method)){const bytes=await body(request,15*1024*1024);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);storage.set(objectPath,{type:request.headers['content-type']??'application/octet-stream'});counts.storageUploads++;return json(200,{Key:'business-private/'+objectPath,Id:randomUUID()});}
    if(request.method==='GET'){if(!storage.has(objectPath))return json(404,{message:'Object not found'});const bytes=await readFile(target);counts.storageDownloads++;response.writeHead(200,{'content-type':storage.get(objectPath).type,'content-length':bytes.length,'cache-control':'no-store'});return response.end(bytes);}
   }
   const match=url.pathname.match(/^\/rest\/v1\/rpc\/(business_[a-z_]+)$/);if(!match||request.method!=='POST'){counts.denied++;return json(404,{code:'LOCAL_ROUTE_DENIED',message:'Only registered business RPCs and private object storage are exposed'});}
   const candidates=signatures.filter(row=>row.proname===match[1]);if(candidates.length!==1){counts.denied++;return json(403,{code:'42501',message:'RPC execute permission required'});}const signature=candidates[0],args=JSON.parse((await body(request)).toString('utf8'));
   if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!signature.proargnames.includes(key)))return json(400,{code:'LOCAL_RPC_ARGUMENT',message:'Unknown RPC argument'});
   const required=signature.proargnames.slice(0,signature.pronargs-signature.pronargdefaults);if(required.some(key=>!(key in args)))return json(400,{code:'LOCAL_RPC_ARGUMENT',message:'Missing RPC argument'});
   const values=[],parameters=[];for(let index=0;index<signature.pronargs;index++){const name=signature.proargnames[index];if(!(name in args))continue;const value=args[name],type=signature.argument_types[index];values.push((type==='jsonb'||type==='json')&&value!==null?JSON.stringify(value):value);parameters.push(`"${name}" => $${values.length}::${type}`);}
   const client=await createConnection();try{await client.query('begin');await client.query('set local role service_role');const result=await client.query(`select public."${signature.proname}"(${parameters.join(',')}) data`,values);await client.query('commit');counts.rpc++;return json(200,signature.proretset?result.rows.map(row=>row.data):result.rows[0]?.data??null);}catch(error){await client.query('rollback');return json(400,{code:error.code??'LOCAL_RPC_ERROR',message:error.message,details:null,hint:null});}finally{await client.end();}
  }catch(error){return json(400,{code:'LOCAL_TRANSPORT_ERROR',message:error.message});}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const config={origin:`http://127.0.0.1:${server.address().port}`,apiKey,pepper,syntheticOnly:true,cloudAccess:false};await writeFile('.tmp/misa-launch-rpc.private.json',JSON.stringify(config));
 console.log(JSON.stringify({localBusinessRpc:'ready',address:'loopback only',cloudAccess:false,transport:'real PostgreSQL RPC over local HTTP bridge',objectStorage:'local private files'}));
 await new Promise(resolve=>{for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(resolve));});await writeFile('.tmp/misa-launch-local-transport-counts.json',JSON.stringify(counts,null,2));
}
