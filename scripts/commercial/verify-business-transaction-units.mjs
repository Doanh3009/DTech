import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';

const snapshotKeys=['entry_unit','entry_quantity','entry_price','base_unit','unit_factor','unit_effective_on','unit_conversion_id','unit_conversion_version'];
const affected=['stock_moves','purchase_receipts','purchase_lines','sales_lines'];

export async function verifyBusinessTransactionUnitUpgrade(db,applyMigration){
 const actor=(await db.query("select a.id,a.tenant_id from public.business_accounts a join public.business_tenants t on t.id=a.tenant_id where t.industry='construction' and a.role='owner' limit 1")).rows[0];
 const item=(await db.query('select id from public.business_items where tenant_id=$1 order by code limit 1',[actor.tenant_id])).rows[0].id;
 const supplier=(await db.query("select id from public.business_tenant_partners where tenant_id=$1 and partner_type in ('supplier','both') order by code limit 1",[actor.tenant_id])).rows[0].id;
 const zeroOrder=randomUUID(),zeroLine=randomUUID();
 await db.query("insert into public.business_purchase_orders(id,tenant_id,created_by,code,name,partner_id,order_date,expected_on) values($1,$2,$3,$4,'Legacy zero draft',$5,current_date,current_date)",[zeroOrder,actor.tenant_id,actor.id,'LEGACY-'+randomUUID().slice(0,12),supplier]);
 let zeroRejected=false;try{await db.query("insert into public.business_purchase_lines(id,tenant_id,created_by,code,name,purchase_order_id,item_id,quantity,unit_price) values($1,$2,$3,$4,'Legacy zero line',$5,$6,0,0)",[zeroLine,actor.tenant_id,actor.id,'LEGACY-'+randomUUID().slice(0,12),zeroOrder,item]);}catch(error){assert.equal(error.code,'23514');zeroRejected=true;}assert(zeroRejected);
 await db.query("insert into public.business_purchase_lines(id,tenant_id,created_by,code,name,purchase_order_id,item_id,quantity,unit_price) values($1,$2,$3,$4,'Legacy draft line',$5,$6,1,0)",[zeroLine,actor.tenant_id,actor.id,'LEGACY-'+randomUUID().slice(0,12),zeroOrder,item]);
 // A deliberately disabled trigger must remain disabled after the backfill.
 await db.query('alter table public.business_sales_lines disable trigger business_base_line_touch');
 await db.query('create temporary table unit_upgrade_before(name text primary key,rows jsonb)');
 const tables=[...affected,'purchase_orders','sales_orders','audit','commands'];
 for(const kind of tables)await db.query(`insert into unit_upgrade_before select $1,coalesce(jsonb_agg(to_jsonb(x) order by x.${kind==='audit'?'id':kind==='commands'?'request_id':'id'}),'[]') from public.business_${kind} x`,[kind]);
 const triggerBefore=(await db.query("select tgrelid::regclass::text table_name,tgname,tgenabled from pg_trigger where tgrelid=any($1::regclass[]) and not tgisinternal order by tgrelid,tgname",[affected.map(kind=>'public.business_'+kind)])).rows;
 await applyMigration();
 const counts={};
 for(const kind of tables){
  const result=(await db.query(`select (select rows from unit_upgrade_before where name=$1)=coalesce(jsonb_agg(to_jsonb(x)-$2::text[] order by x.${kind==='audit'?'id':kind==='commands'?'request_id':'id'}),'[]') unchanged,(select jsonb_array_length(rows) from unit_upgrade_before where name=$1) rows from public.business_${kind} x`,[kind,affected.includes(kind)?snapshotKeys:[]])).rows[0];
  assert.equal(result.unchanged,true,'Upgrade changed existing '+kind);counts[kind]=result.rows;
 }
 const triggerAfter=(await db.query("select tgrelid::regclass::text table_name,tgname,tgenabled from pg_trigger where tgrelid=any($1::regclass[]) and not tgisinternal and tgname<>'business_transaction_quantity_guard' order by tgrelid,tgname",[affected.map(kind=>'public.business_'+kind)])).rows;
 assert.deepEqual(triggerAfter,triggerBefore);
 for(const kind of affected){
  const invalid=(await db.query(`select count(*)::int n from public.business_${kind} x join public.business_items i on i.tenant_id=x.tenant_id and i.id=x.item_id where x.entry_unit is distinct from i.unit or x.base_unit is distinct from i.unit or x.entry_quantity is distinct from x.quantity or x.entry_price is distinct from x.${kind.endsWith('_lines')?'unit_price':'unit_cost'} or x.unit_factor is distinct from 1 or x.unit_conversion_id is not null or x.unit_effective_on is null`)).rows[0].n;
  assert.equal(invalid,0,'Upgrade fabricated a conversion for '+kind);
 }
 assert.equal(Number((await db.query('select entry_quantity quantity from public.business_purchase_lines where id=$1',[zeroLine])).rows[0].quantity),1);
 await db.query('alter table public.business_sales_lines enable trigger business_base_line_touch');
 return{passed:true,checks:['existing_quantities_prices_statuses_versions_approvals_preserved','existing_parent_versions_preserved','audit_commands_unchanged','existing_trigger_modes_preserved','legacy_draft_preserved_zero_quantity_already_rejected','legacy_rows_marked_base_unit_without_invented_history'],rows:counts,cloudAccess:false,data:'synthetic only'};
}

export async function verifyBusinessTransactionUnits(db,{registry,companies,credentials,createConnection}){
 const company=companies.find(row=>row.industry==='construction'),other=companies.find(row=>row.industry==='metalworking');
 const hash=credentials[company.slug].ownerHash,otherHash=credentials[other.slug].ownerHash;
 const tenant=(await db.query('select id,features from public.business_tenants where slug=$1',[company.slug])).rows[0];
 await db.query("update public.business_sessions set revoked_at=null,expires_at=now()+interval '1 hour' where token_hash=any($1::text[])",[[hash,otherHash]]);
 const today=(await db.query("select (now() at time zone 'Asia/Ho_Chi_Minh')::date::text today")).rows[0].today;
 const day=offset=>{const value=new Date(today+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10);};
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const dataFor=(kind,values={})=>({code:'UNIT-'+randomUUID().slice(0,12),name:'Synthetic transaction units',notes:'Local isolated unit acceptance',...Object.fromEntries(Object.entries(registry[kind].fields).filter(([,field])=>!field.computed).map(([key,field])=>[key,field.default??null])),...values});
 const makeCommand=(kind,id,data,version=0)=>({kind,id,data,version,request:randomUUID(),payload:digest({kind,id,data,version,nonce:randomUUID()})});
 const saveCommand=async(command,session=hash,slug=company.slug,client=db)=>(await client.query('select public.business_save_record($1,$2,$3,$4,$5,$6::jsonb,$7,$8) data',[session,slug,command.kind,command.id,command.version,JSON.stringify(command.data),command.request,command.payload])).rows[0].data;
 const save=async(kind,id,data,version=0,session=hash)=>saveCommand(makeCommand(kind,id,data,version),session);
 const create=async(kind,values)=>{const id=randomUUID(),data=dataFor(kind,values);await save(kind,id,data);return{id,data};};
 const row=async(kind,id)=>(await db.query(`select to_jsonb(x) data from public.business_${kind} x where tenant_id=$1 and id=$2`,[tenant.id,id])).rows[0]?.data;
 const action=async(kind,id,verb)=>{const current=await row(kind,id),request=randomUUID();return(await db.query('select public.business_record_action($1,$2,$3,$4,$5,$6,$7,$8,$9) data',[hash,company.slug,kind,id,current.row_version,verb,'Synthetic unit acceptance',request,digest({kind,id,verb,request})])).rows[0].data;};
 const reject=async(run,code)=>{try{await run();}catch(error){assert(String(error.message).includes(code),`Expected ${code}, received ${error.message}`);return;}throw Error('Expected '+code);};
 const checkSnapshot=(value,unit,quantity,factor,price)=>{assert.equal(value.entry_unit,unit);assert.equal(Number(value.entry_quantity),quantity);assert.equal(Number(value.unit_factor),factor);assert.equal(Number(value.entry_price),price);assert.equal(Number(value.quantity),Math.round(quantity*factor*10000)/10000);};
 const warehouse=(await db.query("select id from public.business_warehouses where tenant_id=$1 and status='active' order by code limit 1",[tenant.id])).rows[0].id;
 const supplier=(await db.query("select id from public.business_tenant_partners where tenant_id=$1 and status='active' and partner_type in ('supplier','both') order by code limit 1",[tenant.id])).rows[0].id;
 const customer=(await db.query("select id from public.business_tenant_partners where tenant_id=$1 and status='active' and partner_type in ('customer','both') order by code limit 1",[tenant.id])).rows[0].id;
 const item=await create('items',{unit:'cái',tracking:'none',standard_cost:0});
 const current=await create('item_unit_conversions',{item_id:item.id,alternate_unit:'thùng',factor:12,effective_from:day(-30),effective_to:null});
 const options=(await db.query('select public.business_item_unit_options($1,$2,$3,$4) data',[hash,company.slug,item.id,today])).rows[0].data;
 assert.deepEqual(options.options,[{unit:'cái',factor:1},{unit:'thùng',factor:12}]);assert.equal(options.effectiveOn,today);
 const po=await create('purchase_orders',{partner_id:supplier,order_date:today,expected_on:today});
 const line=await create('purchase_lines',{purchase_order_id:po.id,item_id:item.id,quantity:999,unit_price:999,entry_unit:' THÙNG ',entry_quantity:2,entry_price:240000});
 const lineRow=await row('purchase_lines',line.id);checkSnapshot(lineRow,'thùng',2,12,240000);assert.equal(lineRow.unit_price,20000);assert.equal(lineRow.base_unit,'cái');assert.equal(lineRow.unit_conversion_id,current.id);
 await reject(async()=>save('purchase_orders',po.id,{...po.data,order_date:day(-1)},(await row('purchase_orders',po.id)).row_version),'BUSINESS_UOM_DOCUMENT_DATE_LOCKED');
 await action('purchase_orders',po.id,'release');
 const receiptData={purchase_order_id:po.id,item_id:item.id,warehouse_id:warehouse,lot_id:null,quantity:1,unit_cost:1,document_date:today,entry_unit:'thùng',entry_quantity:2,entry_price:240000};
 const receipt=await create('purchase_receipts',receiptData);await action('purchase_receipts',receipt.id,'post');
 const balance=async()=>Number((await db.query("select coalesce(sum(case direction when 'in' then quantity else -quantity end),0) q from public.business_stock_moves where tenant_id=$1 and item_id=$2 and warehouse_id=$3 and status='posted'",[tenant.id,item.id,warehouse])).rows[0].q);
 assert.equal(await balance(),24);const receivedMove=(await db.query("select to_jsonb(x) data from public.business_stock_moves x where tenant_id=$1 and source_kind='purchase_receipt' and source_id=$2",[tenant.id,receipt.id])).rows[0].data;
 checkSnapshot(receivedMove,'cái',24,1,20000);assert.equal(receivedMove.unit_cost,20000);
 await action('purchase_receipts',receipt.id,'reverse');assert.equal(await balance(),0);const reversedReceipt=await row('purchase_receipts',receipt.id);checkSnapshot(reversedReceipt,'thùng',2,12,240000);assert.equal(reversedReceipt.status,'cancelled');
 const receipt2=await create('purchase_receipts',receiptData);await action('purchase_receipts',receipt2.id,'post');
 const excess=await create('purchase_receipts',{...receiptData,entry_unit:'cái',entry_quantity:1,entry_price:20000});await reject(()=>action('purchase_receipts',excess.id,'post'),'BUSINESS_RECEIPT_EXCEEDED');
 const sales=await create('sales_orders',{partner_id:customer,order_date:today,due_date:day(30)});
 const salesLine=await create('sales_lines',{sales_order_id:sales.id,item_id:item.id,quantity:1,unit_price:1,entry_unit:'thùng',entry_quantity:1,entry_price:360000});
 checkSnapshot(await row('sales_lines',salesLine.id),'thùng',1,12,360000);assert.equal((await row('sales_lines',salesLine.id)).unit_price,30000);await action('sales_orders',sales.id,'release');
 const deliveryRequest=randomUUID(),deliveryVersion=(await row('sales_orders',sales.id)).row_version,deliveryLines=[{itemId:item.id,warehouseId:warehouse,lotId:null,quantity:12,unitCost:20000}];
 const deliver=()=>db.query('select public.business_deliver_sales_order($1,$2,$3,$4,$5,$6,$7::jsonb) data',[hash,company.slug,deliveryRequest,sales.id,deliveryVersion,today,JSON.stringify(deliveryLines)]);
 const delivered=(await deliver()).rows[0].data;assert.deepEqual((await deliver()).rows[0].data,delivered);assert.equal(await balance(),12);
 const fulfillment=(await db.query('select public.business_sales_fulfillment($1,$2,$3) data',[hash,company.slug,sales.id])).rows[0].data;
 assert.equal(Number(fulfillment.items[0].ordered),12);
 await reject(()=>action('purchase_receipts',receipt2.id,'reverse'),'BUSINESS_INSUFFICIENT_STOCK');
 const move=await create('stock_moves',{item_id:item.id,warehouse_id:warehouse,lot_id:null,direction:'out',quantity:1,unit_cost:1,document_date:today,sales_order_id:null,entry_unit:'thùng',entry_quantity:1,entry_price:240000});
 await action('stock_moves',move.id,'post');assert.equal(await balance(),0);await action('stock_moves',move.id,'reverse');assert.equal(await balance(),12);checkSnapshot(await row('stock_moves',move.id),'thùng',1,12,240000);
 const precision=await create('stock_moves',{item_id:item.id,warehouse_id:warehouse,direction:'in',quantity:1,unit_cost:1,document_date:today,entry_unit:'thùng',entry_quantity:2,entry_price:100});
 const precisionValue=(await db.query('select round(quantity*unit_cost,2)::text amount from public.business_stock_moves where id=$1',[precision.id])).rows[0].amount;assert.equal(precisionValue,'200.00');
 const legacy=await create('stock_moves',{item_id:item.id,warehouse_id:warehouse,direction:'in',quantity:3,unit_cost:7,document_date:today});checkSnapshot(await row('stock_moves',legacy.id),'cái',3,1,7);
 const future=await create('item_unit_conversions',{item_id:item.id,alternate_unit:'kiện',factor:10,effective_from:day(10),effective_to:null});
 const futureOrder=await create('purchase_orders',{partner_id:supplier,order_date:day(10),expected_on:day(11)});
 const futureLine=await create('purchase_lines',{purchase_order_id:futureOrder.id,item_id:item.id,quantity:1,unit_price:1,entry_unit:'kiện',entry_quantity:2,entry_price:100});
 const futureBefore=await row('purchase_lines',futureLine.id);checkSnapshot(futureBefore,'kiện',2,10,100);
 await save('item_unit_conversions',future.id,{...future.data,factor:14},1);
 await save('purchase_lines',futureLine.id,{...futureLine.data,notes:'Retain the original conversion'},1);
 const futureAfter=await row('purchase_lines',futureLine.id);checkSnapshot(futureAfter,'kiện',2,10,100);assert.equal(futureAfter.unit_conversion_version,1);
 const newFutureLine=await create('purchase_lines',{...futureLine.data,code:'UNIT-'+randomUUID().slice(0,12)});checkSnapshot(await row('purchase_lines',newFutureLine.id),'kiện',2,14,100);
 const futureOptions=(await db.query('select public.business_item_unit_options($1,$2,$3,$4) data',[hash,company.slug,item.id,day(10)])).rows[0].data;assert.equal(futureOptions.options.find(x=>x.unit==='kiện').factor,14);
 await action('purchase_lines',futureLine.id,'deactivate');await action('purchase_lines',newFutureLine.id,'deactivate');
 await save('purchase_orders',futureOrder.id,{...futureOrder.data,order_date:day(11)},(await row('purchase_orders',futureOrder.id)).row_version);
 await action('purchase_lines',futureLine.id,'activate');const reactivated=await row('purchase_lines',futureLine.id);checkSnapshot(reactivated,'kiện',2,14,100);assert.equal(reactivated.unit_effective_on,day(11));
 const badBase=dataFor('stock_moves',{item_id:item.id,warehouse_id:warehouse,direction:'in',quantity:1,unit_cost:1,document_date:today,entry_unit:'thùng',entry_quantity:1,entry_price:1});
 for(const key of ['base_unit','unit_factor','unit_effective_on','unit_conversion_id','unit_conversion_version'])await reject(()=>save('stock_moves',randomUUID(),{...badBase,[key]:key==='unit_factor'?1:'forged'}),'BUSINESS_INVALID_INPUT');
 await reject(()=>save('stock_moves',randomUUID(),{...badBase,entry_quantity:0}),'BUSINESS_INVALID_INPUT');
 await reject(()=>save('stock_moves',randomUUID(),{...badBase,entry_quantity:1e15}),'BUSINESS_INVALID_INPUT');
 await reject(()=>save('stock_moves',randomUUID(),{...badBase,entry_quantity:0.00001}),'BUSINESS_INVALID_INPUT');
 await reject(()=>save('stock_moves',randomUUID(),{...badBase,entry_unit:'missing'}),'BUSINESS_UOM_NOT_FOUND');
 const serial=await create('items',{unit:'cái',tracking:'serial',standard_cost:0});await create('item_unit_conversions',{item_id:serial.id,alternate_unit:'bộ',factor:1.5,effective_from:day(-1),effective_to:null});
 await reject(()=>save('stock_moves',randomUUID(),{...badBase,item_id:serial.id,entry_unit:'bộ',entry_quantity:1}),'BUSINESS_UOM_SERIAL_QUANTITY');
 const concurrent=await create('stock_moves',{...badBase,entry_unit:'cái',entry_quantity:1});
 const commands=[makeCommand('stock_moves',concurrent.id,{...concurrent.data,entry_unit:'thùng',entry_quantity:2},1),makeCommand('stock_moves',concurrent.id,{...concurrent.data,entry_unit:'thùng',entry_quantity:3},1)];
 const clients=await Promise.all([createConnection(),createConnection()]);let outcomes;
 try{outcomes=await Promise.all(commands.map((command,index)=>saveCommand(command,hash,company.slug,clients[index]).then(data=>({ok:true,data,index}),error=>({ok:false,message:error.message,index}))));}finally{await Promise.all(clients.map(client=>client.end()));}
 assert.equal(outcomes.filter(x=>x.ok).length,1);assert(outcomes.find(x=>!x.ok).message.includes('BUSINESS_VERSION_CONFLICT'));const winner=outcomes.find(x=>x.ok);assert.deepEqual(await saveCommand(commands[winner.index]),winner.data);assert.equal((await row('stock_moves',concurrent.id)).row_version,2);
 await reject(()=>saveCommand({...commands[winner.index],payload:digest('changed payload')}),'BUSINESS_COMMAND_CONFLICT');
 await reject(()=>save('stock_moves',concurrent.id,concurrent.data,1),'BUSINESS_VERSION_CONFLICT');
 await reject(()=>db.query('select public.business_item_unit_options($1,$2,$3,$4)',[otherHash,other.slug,item.id,today]),'BUSINESS_NOT_FOUND');
 await reject(()=>saveCommand(makeCommand('stock_moves',randomUUID(),badBase),otherHash,other.slug),'BUSINESS_INVALID_REFERENCE');
 const account=(await db.query("insert into public.business_accounts(tenant_id,username,display_name,password_hash,role,must_change_password) select $1,$2,'Synthetic unit scope editor',password_hash,'editor',false from public.business_accounts where tenant_id=$1 and role='owner' limit 1 returning id,credential_version",[tenant.id,'uq'+randomUUID().replaceAll('-','').slice(0,12)])).rows[0],limitedHash=digest(randomUUID());
 await db.query("insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')",[limitedHash,tenant.id,account.id,account.credential_version]);await db.query('insert into public.business_access_profiles(tenant_id,account_id,custom_access) values($1,$2,true)',[tenant.id,account.id]);
 await db.query("insert into public.business_access_grants(tenant_id,account_id,kind,actions,scope) values($1,$2,'items',array['read'],'tenant'),($1,$2,'item_unit_conversions',array['read'],'own'),($1,$2,'stock_moves',array['create','read','update'],'tenant')",[tenant.id,account.id]);
 const limitedOptions=(await db.query('select public.business_item_unit_options($1,$2,$3,$4) data',[limitedHash,company.slug,item.id,today])).rows[0].data;assert.deepEqual(limitedOptions.options,[{unit:'cái',factor:1}]);await reject(()=>save('stock_moves',randomUUID(),badBase,0,limitedHash),'BUSINESS_FORBIDDEN');
 await db.query("insert into public.business_access_grants(tenant_id,account_id,kind,actions,scope) values($1,$2,'purchase_lines',array['create','read','update'],'tenant'),($1,$2,'purchase_orders',array['read','update'],'own')",[tenant.id,account.id]);
 const ownDestination=randomUUID();await db.query("insert into public.business_purchase_orders(id,tenant_id,created_by,code,name,partner_id,order_date,expected_on) values($1,$2,$3,$4,'Synthetic owned destination',$5,$6,$7)",[ownDestination,tenant.id,account.id,'UNIT-'+randomUUID().slice(0,12),supplier,day(11),day(12)]);
 const movedLine={...futureLine.data,purchase_order_id:ownDestination};
 // Destination access succeeds, but the existing line's previous header is
 // outside this actor's own scope. That denial precedes any CAS disclosure.
 await reject(()=>save('purchase_lines',futureLine.id,movedLine,0,limitedHash),'BUSINESS_FORBIDDEN');
 await db.query("update public.business_access_grants set scope='tenant' where tenant_id=$1 and account_id=$2 and kind='purchase_orders'",[tenant.id,account.id]);
 await reject(()=>save('purchase_lines',futureLine.id,movedLine,0,limitedHash),'BUSINESS_VERSION_CONFLICT');
 await db.query("update public.business_access_grants set scope='own' where tenant_id=$1 and account_id=$2 and kind='items'",[tenant.id,account.id]);await reject(()=>db.query('select public.business_item_unit_options($1,$2,$3,$4)',[limitedHash,company.slug,item.id,today]),'BUSINESS_FORBIDDEN');
 await db.query("update public.business_tenants set features=features-'inventory' where id=$1",[tenant.id]);try{await reject(()=>db.query('select public.business_item_unit_options($1,$2,$3,$4)',[hash,company.slug,item.id,today]),'BUSINESS_FORBIDDEN');await reject(()=>save('stock_moves',randomUUID(),badBase),'BUSINESS_FORBIDDEN');}finally{await db.query('update public.business_tenants set features=$2::jsonb where id=$1',[tenant.id,JSON.stringify(tenant.features)]);}
 const acl=(await db.query("select bool_and(not has_function_privilege(r, 'public.business_transaction_quantity(uuid,text,jsonb,jsonb)','EXECUTE') and not has_function_privilege(r,'public.business_transaction_quantity_guard()','EXECUTE') and not has_function_privilege(r,'public.business_save_record_before_transaction_units(text,text,text,uuid,integer,jsonb,uuid,text)','EXECUTE')) private_helpers,bool_and(case when r='service_role' then has_function_privilege(r,'public.business_item_unit_options(text,text,uuid,date)','EXECUTE') else not has_function_privilege(r,'public.business_item_unit_options(text,text,uuid,date)','EXECUTE') end) server_rpc from unnest(array['anon','authenticated','service_role']) r")).rows[0];assert(acl.private_helpers&&acl.server_rpc);
 const checks=['effective_unit_options','normalized_purchase_quantity_and_price','server_overrides_client_base_values','purchase_date_change_requires_line_removal','purchase_receipt_posts_base_stock','receipt_reversal_preserves_entry_snapshot','receipt_overrun_checked_in_base_units','normalized_sales_quantity_and_price','sales_delivery_uses_base_units','delivery_retry_idempotent','used_receipt_cannot_reverse','converted_manual_issue_and_reverse','recurring_base_price_preserves_money','legacy_base_payload_supported','future_catalog_change_preserves_existing_snapshot','new_documents_use_new_conversion_version','reactivation_uses_changed_parent_date','forged_snapshot_fields_rejected','zero_overflow_and_precision_rejected','unknown_unit_rejected','serial_integrality','concurrent_update_cas','stable_save_replay','changed_retry_conflict','stale_version_denied','tenant_isolation','conversion_read_scope','parent_authorization_precedes_cas','item_read_scope','module_disabled','private_helper_acl','server_only_options_rpc'];
 return{passed:true,checks,cloudAccess:false,data:'synthetic only'};
}
