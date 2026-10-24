import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

export async function runSalesFulfillmentChecks({ db, parallel, actor, test, fails, checks }) {
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const password=`scrypt$65536$8$2$${'a'.repeat(32)}$${'b'.repeat(128)}`;
 const rpc=async(name,args,conn=db)=>(await conn.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 async function save(t,kind,data,version=0,id=randomUUID()) {
  const d={code:'FUL-'+id.slice(0,12),name:'Synthetic fulfillment',notes:'',...data};
  const r=await rpc('business_save_record',[t.session,t.slug,kind,id,version,d,randomUUID(),hash(d)]);
  return {id,rowVersion:r.rowVersion,data:d};
 }
 const act=(t,kind,row,action='post')=>rpc('business_record_action',[t.session,t.slug,kind,row.id,row.rowVersion,action,'Synthetic fulfillment',randomUUID(),hash(randomUUID())]);
 async function fixture() {
  const customer=randomUUID(),slug='ful-'+customer.slice(0,8);
  await db.query(`insert into public.crm_customers(id,profile,setup,stage) values($1,'{"companyName":"Synthetic fulfillment"}','{"systemName":"Synthetic ERP"}','discovery')`,[customer]);
  const config={slug,industry:'trading',features:['inventory','sales','crm'],systemName:'Synthetic ERP',username:'admin',displayName:'Synthetic owner',trialDays:14};
  const t=await rpc('business_provision_customer',[randomUUID(),customer,1,config,password,hash(config),actor]);
  t.session=hash(randomUUID());await db.query('update public.business_accounts set must_change_password=false where id=$1',[t.accountId]);
  await rpc('business_open_session',[t.accountId,1,t.session]);
  t.item=await save(t,'items',{unit:'pcs',tracking:'none',standard_cost:0});
  t.warehouse=await save(t,'warehouses',{address:null});
  t.partner=await save(t,'partners',{partner_type:'customer',phone:null,email:null,tax_code:null});
  t.order=await save(t,'sales_orders',{partner_id:t.partner.id,order_date:'2026-10-01',due_date:'2026-11-01'});
  await save(t,'sales_lines',{sales_order_id:t.order.id,item_id:t.item.id,quantity:10,unit_price:100});
  await act(t,'sales_orders',t.order,'release');t.order.rowVersion=2;
  const inbound=await save(t,'stock_moves',{item_id:t.item.id,warehouse_id:t.warehouse.id,lot_id:null,direction:'in',quantity:30,unit_cost:10,document_date:'2026-10-01',sales_order_id:null});
  await act(t,'stock_moves',inbound);
  return t;
 }
 const context=t=>rpc('business_sales_fulfillment',[t.session,t.slug,t.order.id]);
 const line=(t,quantity,extra={})=>({itemId:t.item.id,warehouseId:t.warehouse.id,lotId:null,quantity,unitCost:10,...extra});
 const deliver=(t,lines,version=t.order.rowVersion,request=randomUUID(),conn=db,date='2026-10-23')=>rpc('business_deliver_sales_order',[t.session,t.slug,request,t.order.id,version,date,JSON.stringify(lines)],conn);
 const stock=t=>rpc('business_overview',[t.session,t.slug]);

 await test(db,'partial delivery advances order version, reduces inventory and exposes remaining quantity',async()=>{
  const t=await fixture();const receipt=await deliver(t,[line(t,4)]);
  assert.equal(receipt.rowVersion,3);assert.equal(receipt.stockMoveIds.length,1);
  const state=await context(t);assert.equal(state.items[0].ordered,10);assert.equal(state.items[0].shipped,4);assert.equal(state.stock[0].available,26);
  assert.equal((await stock(t)).receivables[0].amount,1000);
  await fails(db,()=>act(t,'sales_orders',{...t.order,rowVersion:3},'complete'),/BUSINESS_DELIVERY_INCOMPLETE/);
 });
 await test(db,'delivery retry after completion returns original receipt and never posts twice',async()=>{
  const t=await fixture();const request=randomUUID();const lines=[line(t,10)];const r=await deliver(t,lines,2,request);
  await act(t,'sales_orders',{...t.order,rowVersion:r.rowVersion},'complete');
  assert.deepEqual(await deliver(t,lines,2,request),r);assert.equal((await stock(t)).stock[0].quantity,20);
  await fails(db,()=>deliver(t,[line(t,9)],2,request),/BUSINESS_COMMAND_CONFLICT/);
 });
 await test(db,'a multi-line delivery rolls the whole command back if one line exceeds the order',async()=>{
  const t=await fixture();const before=await db.query('select count(*)::int n from public.business_audit where tenant_id=$1',[t.tenantId]);
  await fails(db,()=>deliver(t,[line(t,6),line(t,5)]),/BUSINESS_DELIVERY_EXCEEDED/);
  assert.equal((await context(t)).items[0].shipped,0);assert.equal((await stock(t)).stock[0].quantity,30);
  assert.equal((await context(t)).rowVersion,2);assert.equal((await db.query('select count(*)::int n from public.business_audit where tenant_id=$1',[t.tenantId])).rows[0].n,before.rows[0].n);
 });
 await test(db,'manual stock posting cannot bypass order quantity or unrelated-item validation',async()=>{
  const t=await fixture();
  const out=await save(t,'stock_moves',{item_id:t.item.id,warehouse_id:t.warehouse.id,lot_id:null,direction:'out',quantity:11,unit_cost:10,document_date:'2026-10-23',sales_order_id:t.order.id});
  await fails(db,()=>act(t,'stock_moves',out),/BUSINESS_DELIVERY_EXCEEDED/);
  const other=await save(t,'items',{unit:'pcs',tracking:'none',standard_cost:0});
  const inbound=await save(t,'stock_moves',{...out.data,code:'IN-'+randomUUID(),item_id:other.id,quantity:1,direction:'in',sales_order_id:null});await act(t,'stock_moves',inbound);
  const unrelated=await save(t,'stock_moves',{...out.data,code:'OUT-'+randomUUID(),item_id:other.id,quantity:1});
  await fails(db,()=>act(t,'stock_moves',unrelated),/BUSINESS_SALES_ITEM_MISMATCH/);
  const early=await save(t,'stock_moves',{...out.data,code:'DATE-'+randomUUID(),quantity:1,document_date:'2026-09-01'});
  await fails(db,()=>act(t,'stock_moves',early),/BUSINESS_INVALID_DATE/);
 });
 await test(db,'reversing completed delivery restores stock and reopens the order',async()=>{
  const t=await fixture();const r=await deliver(t,[line(t,10)]);await act(t,'sales_orders',{...t.order,rowVersion:r.rowVersion},'complete');
  await act(t,'stock_moves',{id:r.stockMoveIds[0],rowVersion:1},'reverse');
  const state=await context(t);assert.equal(state.status,'released');assert.equal(state.items[0].shipped,0);assert.equal((await stock(t)).stock[0].quantity,30);
  await fails(db,()=>act(t,'sales_orders',{...t.order,rowVersion:state.rowVersion},'complete'),/BUSINESS_DELIVERY_INCOMPLETE/);
 });
 await test(db,'a manual return cannot exceed the net delivered quantity',async()=>{
  const t=await fixture();await deliver(t,[line(t,2)]);
  const returned=await save(t,'stock_moves',{item_id:t.item.id,warehouse_id:t.warehouse.id,lot_id:null,direction:'in',quantity:3,unit_cost:10,document_date:'2026-10-23',sales_order_id:t.order.id});
  await fails(db,()=>act(t,'stock_moves',returned),/BUSINESS_RETURN_EXCEEDED/);
 });
 await test(db,'delivery validates version, dates, decimal precision and exact input shape',async()=>{
  const t=await fixture();
  await fails(db,()=>deliver(t,[line(t,1)],1),/BUSINESS_VERSION_CONFLICT/);
  await fails(db,()=>deliver(t,[line(t,1)],2,randomUUID(),db,'2026-09-01'),/BUSINESS_INVALID_DATE/);
  await fails(db,()=>deliver(t,[line(t,1)],2,randomUUID(),db,'2099-01-01'),/BUSINESS_INVALID_INPUT/);
  await fails(db,()=>deliver(t,[line(t,0.00001)]),/BUSINESS_INVALID_INPUT/);
  await fails(db,()=>deliver(t,[line(t,1,{tenantId:randomUUID()})]),/BUSINESS_INVALID_INPUT/);
  await fails(db,()=>deliver(t,[]),/BUSINESS_INVALID_INPUT/);
 });
 await test(db,'same-company and inventory checks apply to every batch line',async()=>{
  const t=await fixture(),foreign=await fixture();
  await fails(db,()=>deliver(t,[line(t,1,{warehouseId:foreign.warehouse.id})]),/BUSINESS_INVALID_REFERENCE/);
  await fails(db,()=>deliver(t,[line(t,31)]),/BUSINESS_INSUFFICIENT_STOCK/);
  await fails(db,()=>rpc('business_sales_fulfillment',[t.session,t.slug,foreign.order.id]),/BUSINESS_NOT_FOUND/);
 });
 await test(db,'viewers can inspect delivery progress but cannot post a batch',async()=>{
  const t=await fixture();await db.query("update public.business_accounts set role='viewer' where id=$1",[t.accountId]);
  assert.equal((await context(t)).orderId,t.order.id);await fails(db,()=>deliver(t,[line(t,1)]),/BUSINESS_FORBIDDEN/);
 });
 await test(db,'delivery command remains service-only and ledger guard is private',async()=>{
  for(const role of ['anon','authenticated']){
   await db.query('set local role '+role);
   assert.equal((await db.query("select has_function_privilege(current_user,'public.business_deliver_sales_order(text,text,uuid,uuid,integer,date,jsonb)','execute') x")).rows[0].x,false);
   await db.query('reset role');
  }
  assert.equal((await db.query("select has_function_privilege('service_role','public.business_guard_sales_stock()','execute') x")).rows[0].x,false);
 });
 await test(db,'audit failure after delivery rolls ledger, order version and receipt back together',async()=>{
  const t=await fixture();
  await db.query(`create function public.synthetic_delivery_audit_fail() returns trigger language plpgsql as $$begin if new.action='sales.delivered' then raise exception 'SYNTHETIC_DELIVERY_AUDIT_FAILURE';end if;return new;end$$;create trigger synthetic_delivery_audit_fail before insert on public.business_audit for each row execute function public.synthetic_delivery_audit_fail()`);
  const request=randomUUID();await fails(db,()=>deliver(t,[line(t,4)],2,request),/SYNTHETIC_DELIVERY_AUDIT_FAILURE/);
  assert.equal((await context(t)).rowVersion,2);assert.equal((await context(t)).items[0].shipped,0);
  assert.equal((await stock(t)).stock[0].quantity,30);
  assert.equal((await db.query('select count(*)::int n from public.business_commands where request_id=$1',[request])).rows[0].n,0);
 });
 // Use committed synthetic fixtures to exercise the tenant lock with two real connections.
 const t=await fixture();const results=await Promise.allSettled([deliver(t,[line(t,7)],2,randomUUID(),db),deliver(t,[line(t,7)],2,randomUUID(),parallel)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/BUSINESS_VERSION_CONFLICT/);
 assert.equal((await context(t)).items[0].shipped,7);
 checks.push({name:'two delivery connections cannot overfulfill the remaining order',passed:true});
 const revoked=await fixture();
 await parallel.query('begin');
 try {
  await parallel.query('select id from public.business_accounts where id=$1 for update',[revoked.accountId]);
  const reading=context(revoked).then(value=>({value}),error=>({error}));
  let blocked=false;
  for(let n=0;n<30;n++){
   blocked=(await parallel.query('select $1::integer=any(pg_blocking_pids($2::integer)) blocked',[parallel.processID,db.processID])).rows[0].blocked;
   if(blocked)break;await parallel.query('select pg_sleep(0.01)');
  }
  assert.equal(blocked,true,'session resolver must reach the account lock before logout');
  await rpc('business_logout',[revoked.session],parallel);await parallel.query('commit');
  const result=await reading;assert.match(result.error?.message??'',/BUSINESS_SESSION_REQUIRED/);
  checks.push({name:'logout committed during session resolution prevents the pending command',passed:true});
 }finally{await parallel.query('rollback');}
 const credentials=await fixture();const second=hash(randomUUID());await rpc('business_open_session',[credentials.accountId,1,second]);
 const change=(token,conn)=>rpc('business_change_password',[token,credentials.slug,1,password],conn);
 const changing=await Promise.allSettled([change(credentials.session,db),change(second,parallel)]);
 assert.equal(changing.filter(result=>result.status==='fulfilled').length,1);
 assert.match(changing.find(result=>result.status==='rejected').reason.message,/BUSINESS_SESSION_REQUIRED|BUSINESS_VERSION_CONFLICT/);
 checks.push({name:'simultaneous password changes from two sessions resolve without deadlock',passed:true});
}
