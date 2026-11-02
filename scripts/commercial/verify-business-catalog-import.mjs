import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
export async function verifyBusinessCatalogImport(db,{registry,companies,credentials}){
 const company=companies.find(row=>row.industry==='construction'),other=companies.find(row=>row.industry==='metalworking');
 const tenant=(await db.query('select * from public.business_tenants where slug=$1',[company.slug])).rows[0],hash=credentials[company.slug].ownerHash,otherHash=credentials[other.slug].ownerHash;
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const data=(kind,code,name='Synthetic import')=>({code,name,notes:'Synthetic import acceptance',...Object.fromEntries(Object.entries(registry[kind].fields).map(([key,field])=>[key,field.default??(field.type==='number'?0:null)])),...(kind==='items'?{unit:'kg'}:{})});
 const row=(values,extra={})=>({rowNumber:2,action:'create',recordId:randomUUID(),rowVersion:0,data:values,...extra});
 const matches=async(codes,session=hash,slug=company.slug,kind='items')=>(await db.query('select public.business_catalog_import_matches($1,$2,$3,$4::jsonb) data',[session,slug,kind,JSON.stringify(codes)])).rows[0].data;
 const make=(kind,rows)=>({kind,rows,requestId:randomUUID(),fileName:'synthetic-import.xlsx',fileHash:digest('synthetic source'),hash:digest({kind,rows})});
 const commit=async(command,session=hash,slug=company.slug)=>(await db.query('select public.business_catalog_import_commit($1,$2,$3,$4,$5,$6,$7::jsonb,$8) data',[session,slug,command.kind,command.requestId,command.fileName,command.fileHash,JSON.stringify(command.rows),command.hash])).rows[0].data;
 const history=async(session=hash,slug=company.slug)=>(await db.query("select public.business_catalog_import_history($1,$2,'items') data",[session,slug])).rows[0].data;
 const reject=async(fn,code)=>{let caught=false;try{await fn();}catch(error){if(!String(error.message).includes(code))throw error;caught=true;}assert(caught,`Expected ${code}`);};
 const prefix='IMP-'+randomUUID().slice(0,8),initial=row(data('items',prefix));const create=make('items',[initial]);
 const first=await commit(create);assert.equal(first.created,1);assert.equal(first.failed,0);assert.deepEqual(await commit(create),first);
 const match=(await matches([prefix.toLowerCase()]))[0];assert.equal(match.recordId,initial.recordId);assert.equal(match.rowVersion,1);assert.equal(match.data.unit,'kg');assert.equal(match.data.code,prefix);
 await reject(()=>commit({...create,hash:digest('different payload')}),'BUSINESS_COMMAND_CONFLICT');
 const update=row({...initial.data,name:'Updated through import'},{action:'update',recordId:initial.recordId,rowVersion:1});const updateCommand=make('items',[update]);assert.equal((await commit(updateCommand)).updated,1);assert.equal((await commit(updateCommand)).updated,1);
 const mixed=make('items',[{...update,data:{...update.data,name:'Must not overwrite'},rowNumber:2},row(data('items',prefix+'-NEW'),{rowNumber:3})]);
 const mixedResult=await commit(mixed);assert.equal(mixedResult.created,1);assert.equal(mixedResult.failed,1);assert.equal(mixedResult.results[0].errorCode,'BUSINESS_VERSION_CONFLICT');assert.equal((await matches([prefix]))[0].data.name,'Updated through import');
 assert.deepEqual(await commit(mixed),mixedResult);
 const duplicate=await commit(make('items',[row(data('items',prefix))]));assert.equal(duplicate.failed,1);assert.equal(duplicate.results[0].errorCode,'BUSINESS_DUPLICATE');
 await reject(()=>commit(make('items',[row(data('items',prefix+'-X')) ,row(data('items',(prefix+'-X').toLowerCase()),{rowNumber:3})])),'BUSINESS_INVALID_INPUT');
 await reject(()=>commit(make('items',[{...row(data('items',prefix+'-NULL')),rowNumber:null}])),'BUSINESS_INVALID_INPUT');
 const stock=(await db.query("select i.* from public.business_items i where i.tenant_id=$1 and exists(select 1 from public.business_stock_moves m where m.tenant_id=i.tenant_id and m.item_id=i.id) order by i.code limit 1",[tenant.id])).rows[0];assert(stock);
 const locked=await commit(make('items',[row({code:stock.code,name:stock.name,notes:stock.notes,unit:stock.unit+'-new',tracking:stock.tracking,standard_cost:Number(stock.standard_cost)},{action:'update',recordId:stock.id,rowVersion:stock.row_version})]));assert.equal(locked.failed,1);assert.equal(locked.results[0].errorCode,'BUSINESS_ITEM_UNIT_LOCKED');
 const noLeak=await matches([prefix],otherHash,other.slug);assert.deepEqual(noLeak,[]);assert.deepEqual(await history(otherHash,other.slug),[]);
 const cross=await commit(make('items',[{...update,rowVersion:2}]),otherHash,other.slug);assert.equal(cross.failed,1);assert.equal(cross.results[0].errorCode,'BUSINESS_VERSION_CONFLICT');
 for(const kind of ['partners','warehouses']){const command=make(kind,[row(data(kind,prefix+'-'+kind))]);assert.equal((await commit(command)).created,1);}
 const limited=(await db.query("insert into public.business_accounts(tenant_id,username,display_name,password_hash,role,must_change_password) select $1,$2,'Synthetic importer',password_hash,'editor',false from public.business_accounts where tenant_id=$1 and role='owner' returning id,credential_version",[tenant.id,'imp'+randomUUID().replaceAll('-','').slice(0,12)])).rows[0],limitedHash=digest(randomUUID());
 await db.query("insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",[limitedHash,tenant.id,limited.id,limited.credential_version]);
 await db.query('insert into public.business_access_profiles(tenant_id,account_id,custom_access) values($1,$2,true)',[tenant.id,limited.id]);
 await db.query("insert into public.business_access_grants(tenant_id,account_id,kind,actions,scope) values($1,$2,'items',array['read','update'],'own')",[tenant.id,limited.id]);
 await reject(()=>matches([prefix],limitedHash),'BUSINESS_SCOPED_IMPORT');await reject(()=>history(limitedHash),'BUSINESS_SCOPED_IMPORT');
 await db.query("update public.business_access_grants set scope='tenant' where tenant_id=$1 and account_id=$2",[tenant.id,limited.id]);
 await reject(()=>commit(make('items',[row(data('items',prefix+'-NO'))]),limitedHash),'BUSINESS_FORBIDDEN');
 await db.query("update public.business_accounts set role='viewer' where tenant_id=$1 and id=$2",[tenant.id,limited.id]);await reject(()=>matches([prefix],limitedHash),'BUSINESS_FORBIDDEN');
 await db.query("update public.business_tenants set features=features-'inventory' where id=$1",[tenant.id]);try{await reject(()=>matches([prefix]),'BUSINESS_FORBIDDEN');}finally{await db.query('update public.business_tenants set features=$2::jsonb where id=$1',[tenant.id,JSON.stringify(tenant.features)]);}
 const maxRows=Array.from({length:200},(_,i)=>row(data('items',prefix+'-B'+i),{rowNumber:i+2})),started=performance.now();const bulk=await commit(make('items',maxRows));assert.equal(bulk.created,200);assert.equal(bulk.failed,0);const durationMs=Math.round(performance.now()-started);
 assert(durationMs<10000,`Import 200 rows exceeded RPC target: ${durationMs}ms`);
 assert((await history()).some(item=>item.requestId===create.requestId&&item.created===1));
 const acl=(await db.query("select c.relrowsecurity rls,has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') exposed from pg_class c where c.oid='public.business_catalog_imports'::regclass")).rows[0];assert(acl.rls&&!acl.exposed);
 return {passed:true,checks:['create_update_three_catalogs','per_row_cas_conflict','partial_result_preserves_failed_row','exact_retry_no_duplicates','request_payload_conflict','case_insensitive_code_matching','duplicate_file_codes_rejected','manual_save_invariants_preserved','tenant_isolation','read_scope_required','create_permission_required','viewer_denied','module_disabled','import_history','rls_and_no_direct_access','bounded_200_row_batch'],batchRows:200,batchDurationMs:durationMs,data:'synthetic only',cloudAccess:false};
}
