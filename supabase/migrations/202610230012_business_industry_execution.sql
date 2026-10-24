-- Industry execution: finished goods receiving and material allocation to projects.

alter table public.business_work_orders add column mold_snapshot jsonb;
alter table public.business_operations add column labor_rate_snapshot numeric(20,4), add column machine_rate_snapshot numeric(20,4);
alter table public.business_lot_links add column source_receipt_id uuid;


insert into public.business_entity_definitions(kind,definition) values('production_receipts','{"label":"Nhập kho thành phẩm","feature":"production","mode":"document","fields":{"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","required":true},"warehouse_id":{"label":"Kho","type":"ref","ref":"warehouses","required":true},"lot_id":{"label":"Lô","type":"ref","ref":"lots"},"quantity":{"label":"Số lượng","type":"number","min":0.0001,"required":true},"unit_cost":{"label":"Đơn giá được duyệt","type":"number","min":0,"default":0},"document_date":{"label":"Ngày chứng từ","type":"date","required":true}}}'::jsonb);

create table public.business_production_receipts(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 work_order_id uuid not null,
 foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id),
 warehouse_id uuid not null,
 foreign key(tenant_id,warehouse_id) references public.business_warehouses(tenant_id,id),
 lot_id uuid,
 foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id),
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_cost numeric(20,4) not null default 0 check(unit_cost>=0 and unit_cost<=1000000000000000),
 document_date date not null
);
create unique index business_production_receipts_code_idx on public.business_production_receipts(tenant_id,lower(code));
create index business_production_receipts_tenant_date_idx on public.business_production_receipts(tenant_id,updated_at desc);
alter table public.business_production_receipts enable row level security;
revoke all on public.business_production_receipts from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('project_materials','{"label":"Vật tư công trình","feature":"projects","mode":"document","fields":{"project_id":{"label":"Công trình","type":"ref","ref":"projects","required":true},"item_id":{"label":"Vật tư","type":"ref","ref":"items","required":true},"warehouse_id":{"label":"Kho","type":"ref","ref":"warehouses","required":true},"lot_id":{"label":"Lô","type":"ref","ref":"lots"},"quantity":{"label":"Số lượng","type":"number","min":0.0001,"required":true},"unit_cost":{"label":"Đơn giá được duyệt","type":"number","min":0,"default":0},"document_date":{"label":"Ngày chứng từ","type":"date","required":true}}}'::jsonb);

create table public.business_project_materials(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 project_id uuid not null,
 foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id),
 item_id uuid not null,
 foreign key(tenant_id,item_id) references public.business_items(tenant_id,id),
 warehouse_id uuid not null,
 foreign key(tenant_id,warehouse_id) references public.business_warehouses(tenant_id,id),
 lot_id uuid,
 foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id),
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_cost numeric(20,4) not null default 0 check(unit_cost>=0 and unit_cost<=1000000000000000),
 document_date date not null
);
create unique index business_project_materials_code_idx on public.business_project_materials(tenant_id,lower(code));
create index business_project_materials_tenant_date_idx on public.business_project_materials(tenant_id,updated_at desc);
alter table public.business_project_materials enable row level security;
revoke all on public.business_project_materials from public,anon,authenticated,service_role;

alter table public.business_lot_links add foreign key(tenant_id,source_receipt_id) references public.business_production_receipts(tenant_id,id);
-- Keep trace edges when a proportional amount rounds to zero; manual links stay positive.
alter table public.business_lot_links drop constraint business_lot_links_quantity_check;
alter table public.business_lot_links add constraint business_lot_links_quantity_check check(quantity<=1000000000000000 and (quantity>=0.0001 or (source_receipt_id is not null and quantity=0)));
create index business_production_receipts_order_idx on public.business_production_receipts(tenant_id,work_order_id,status);
create index business_project_materials_project_idx on public.business_project_materials(tenant_id,project_id,status);
create index business_lot_links_receipt_idx on public.business_lot_links(tenant_id,source_receipt_id) where source_receipt_id is not null;
create index business_lot_links_assembly_idx on public.business_lot_links(tenant_id,assembly_lot_id) where status='posted';
create index business_lot_links_component_idx on public.business_lot_links(tenant_id,component_lot_id) where status='posted';


-- Good output is counted at the final operation, never added across operations.
create function public.business_terminal_quantity(p_tenant uuid,p_order uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(r.good_quantity),0) from public.business_production_reports r
 where r.tenant_id=p_tenant and r.work_order_id=p_order and r.status='posted'
 and r.operation_id is not distinct from
 (select o.id from public.business_operations o where o.tenant_id=p_tenant and o.work_order_id=p_order and o.status='active' order by o.sequence desc limit 1)
$$;

create or replace function public.business_save_record(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;old jsonb;r jsonb;k text;f jsonb;cols text;vals text;assignments text;parent_state text;parent_item uuid;v uuid;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if p_id is null or p_expected_version is null or p_expected_version<0 or coalesce(jsonb_typeof(p_data),'')<>'object' or not(p_data ?& array['code','name','notes']) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for k in select jsonb_object_keys(p_data) loop
  if k not in ('code','name','notes') and (not(d->'fields' ? k) or coalesce((d->'fields'->k->>'computed')::boolean,false)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 end loop;
 for k,f in select key,value from jsonb_each(d->'fields') loop
  if not coalesce((f->>'computed')::boolean,false) and not(p_data ? k) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f->>'type'='ref' and p_data->>k is not null then
   -- Composite foreign keys enforce ownership even if the referenced feature is disabled.
   execute format('select id from public.%I where tenant_id=$1 and id=$2 and status not in (''inactive'',''cancelled'')',public.business_entity_table(f->>'ref')) into v using a.tenant_id,(p_data->>k)::uuid;
   if v is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  end if;
 end loop;
 execute format('select to_jsonb(r) from public.%I r where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into old using a.tenant_id,p_id;
 if p_expected_version=0 and old is not null then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_expected_version>0 and old is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 if old is not null and (old->>'row_version')::integer<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if old is not null and old->>'status' not in ('active','inactive','draft') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if p_kind='sales_lines' then
  select status into parent_state from public.business_sales_orders where tenant_id=a.tenant_id and id=(p_data->>'sales_order_id')::uuid;
  if parent_state<>'draft' or (old is not null and exists(select 1 from public.business_sales_orders where tenant_id=a.tenant_id and id=(old->>'sales_order_id')::uuid and status<>'draft')) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 end if;
 if p_kind='operations' and exists(select 1 from public.business_work_orders where tenant_id=a.tenant_id and id in ((p_data->>'work_order_id')::uuid,(old->>'work_order_id')::uuid) and status<>'draft') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if p_kind='lot_links' and old->>'source_receipt_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if p_kind='work_orders' then
  if p_data->>'bom_id' is not null and not exists(select 1 from public.business_boms where tenant_id=a.tenant_id and id=(p_data->>'bom_id')::uuid and item_id=(p_data->>'item_id')::uuid) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if p_data->>'mold_id' is not null and not exists(select 1 from public.business_molds where tenant_id=a.tenant_id and id=(p_data->>'mold_id')::uuid and item_id=(p_data->>'item_id')::uuid) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 end if;
 if p_kind='bom_lines' then
  select item_id into parent_item from public.business_boms where tenant_id=a.tenant_id and id=(p_data->>'bom_id')::uuid;
  if parent_item=(p_data->>'item_id')::uuid then raise exception 'BUSINESS_CYCLE';end if;
  if exists(with recursive edges as (select b.item_id parent,l.item_id child from public.business_bom_lines l join public.business_boms b on b.tenant_id=l.tenant_id and b.id=l.bom_id where l.tenant_id=a.tenant_id and l.id<>p_id), walk(id) as (select (p_data->>'item_id')::uuid union select e.child from edges e join walk w on e.parent=w.id) select 1 from walk where id=parent_item) then raise exception 'BUSINESS_CYCLE';end if;
 end if;
 if p_kind='items' and p_data->>'tracking'='none' and exists(select 1 from public.business_tenants where id=a.tenant_id and industry in ('electronics','food_beverage')) then raise exception 'BUSINESS_LOT_REQUIRED';end if;
 if p_kind='lots' and exists(select 1 from public.business_tenants where id=a.tenant_id and industry='food_beverage') and p_data->>'expires_on' is null then raise exception 'BUSINESS_EXPIRY_REQUIRED';end if;
 if p_kind='lots' and old is not null and (old->>'item_id' is distinct from p_data->>'item_id' or old->>'manufactured_on' is distinct from p_data->>'manufactured_on' or old->>'expires_on' is distinct from p_data->>'expires_on') and exists(select 1 from public.business_stock_moves where tenant_id=a.tenant_id and lot_id=p_id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if p_kind='items' and old is not null and old->>'tracking' is distinct from p_data->>'tracking' and exists(select 1 from public.business_stock_moves where tenant_id=a.tenant_id and item_id=p_id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 select string_agg(format('%I',key),',' order by key),string_agg(format('x.%I',key),',' order by key),string_agg(format('%I=x.%I',key,key),',' order by key) into cols,vals,assignments from jsonb_object_keys(p_data) as t(key);
 if old is null then
  execute format('insert into public.%I(id,tenant_id,created_by,%s) select $1,$2,$3,%s from jsonb_populate_record(null::public.%I,$4) x returning to_jsonb(%I.*)',public.business_entity_table(p_kind),cols,vals,public.business_entity_table(p_kind),public.business_entity_table(p_kind)) into r using p_id,a.tenant_id,a.id,p_data;
 else
  execute format('update public.%I t set %s,row_version=t.row_version+1,updated_at=now() from jsonb_populate_record(null::public.%I,$3) x where t.tenant_id=$1 and t.id=$2 returning to_jsonb(t.*)',public.business_entity_table(p_kind),assignments,public.business_entity_table(p_kind)) into r using a.tenant_id,p_id,p_data;
 end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'record.saved',p_kind,p_id,jsonb_build_object('rowVersion',r->'row_version'));
 r:=jsonb_build_object('recordId',p_id,'rowVersion',r->'row_version');
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash,r);return r;
exception when unique_violation then raise exception 'BUSINESS_DUPLICATE';when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range or foreign_key_violation then raise exception 'BUSINESS_INVALID_INPUT';
end $$;


create or replace function public.business_record_action(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_action text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;v jsonb;r jsonb;new_state text;wo public.business_work_orders%rowtype;ar public.business_receivables%rowtype;op public.business_operations%rowtype;wc public.business_work_centers%rowtype;total numeric;reverse_id uuid;snapshot jsonb;t public.business_tenants%rowtype;item uuid;received numeric;produced numeric;prior numeric;issued numeric;move public.business_stock_moves%rowtype;link record;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 or p_expected_version is null or p_expected_version<1 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select to_jsonb(t) from public.%I t where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 if (v->>'row_version')::integer<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into t from public.business_tenants where id=a.tenant_id;
 if p_action='post' and d->>'mode'='document' then
  perform public.business_assert_kind(a.tenant_id,p_kind);
  if coalesce(v->>'document_date',v->>'report_date',v->>'checked_on',v->>'paid_on',v->>'occurred_on',v->>'reported_on')::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 end if;
 if p_action='cancel' and d->>'mode'<>'master' and v->>'status'='draft' then new_state:='cancelled';
 elsif p_action='release' and d->>'mode'='order' and v->>'status'='draft' then
  new_state:='released';
  if p_kind='work_orders' then
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=p_id;
   if wo.bom_id is null then raise exception 'BUSINESS_BOM_EMPTY';end if;
   if not exists(select 1 from public.business_boms where tenant_id=a.tenant_id and id=wo.bom_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   if exists(select 1 from public.business_operations o join public.business_work_centers c on c.tenant_id=o.tenant_id and c.id=o.work_center_id where o.tenant_id=a.tenant_id and o.work_order_id=p_id and c.status<>'active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   if t.features ? 'mes' and not exists(select 1 from public.business_operations where tenant_id=a.tenant_id and work_order_id=p_id and status='active') then raise exception 'BUSINESS_OPERATION_REQUIRED';end if;
   if t.industry='plastics_packaging' and wo.mold_id is null then raise exception 'BUSINESS_MOLD_REQUIRED';end if;
   if wo.mold_id is not null then
    if not exists(select 1 from public.business_molds where tenant_id=a.tenant_id and id=wo.mold_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
    update public.business_work_orders set mold_snapshot=(select jsonb_build_object('code',code,'cavities',cavities,'cycleSeconds',cycle_seconds) from public.business_molds where tenant_id=a.tenant_id and id=wo.mold_id and status='active') where tenant_id=a.tenant_id and id=p_id;
   end if;
   update public.business_operations o set labor_rate_snapshot=w.labor_rate,machine_rate_snapshot=w.machine_rate from public.business_work_centers w where o.tenant_id=a.tenant_id and o.work_order_id=p_id and w.tenant_id=o.tenant_id and w.id=o.work_center_id;
   if t.industry in ('electronics','food_beverage') and exists(select 1 from public.business_items where tenant_id=a.tenant_id and id=wo.item_id and tracking='none') then raise exception 'BUSINESS_LOT_REQUIRED';end if;
   if wo.bom_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('itemId',l.item_id,'quantity',l.quantity*wo.quantity/b.output_quantity,'wastePercent',l.waste_percent)),'[]'::jsonb) into snapshot from public.business_bom_lines l join public.business_boms b on b.tenant_id=l.tenant_id and b.id=l.bom_id where l.tenant_id=a.tenant_id and b.id=wo.bom_id and l.status='active';
    if jsonb_array_length(snapshot)=0 then raise exception 'BUSINESS_BOM_EMPTY';end if;
    update public.business_work_orders set bom_snapshot=snapshot where tenant_id=a.tenant_id and id=p_id;
   end if;
  elsif p_kind='sales_orders' then
   select sum(quantity*unit_price) into total from public.business_sales_lines where tenant_id=a.tenant_id and sales_order_id=p_id and status='active';
   if total is null or total<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
   insert into public.business_receivables(tenant_id,code,name,created_by,status,partner_id,sales_order_id,amount,due_date) values(a.tenant_id,'AR-'||p_id::text,'Công nợ '||(v->>'code'),a.id,'posted',(v->>'partner_id')::uuid,p_id,total,(v->>'due_date')::date);
  end if;
 elsif p_action='complete' and d->>'mode'='order' and v->>'status'='released' then
  new_state:='completed';
  if p_kind='work_orders' then
   if public.business_terminal_quantity(a.tenant_id,p_id)<(v->>'quantity')::numeric or (select coalesce(sum(quantity),0) from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=p_id and status='posted')<(v->>'quantity')::numeric then raise exception 'BUSINESS_PRODUCTION_INCOMPLETE';end if;
   if t.features ? 'quality' and exists(select 1 from public.business_production_receipts r join public.business_lots l on l.tenant_id=r.tenant_id and l.id=r.lot_id where r.tenant_id=a.tenant_id and r.work_order_id=p_id and r.status='posted' and l.quality_state<>'released') then raise exception 'BUSINESS_LOT_BLOCKED';end if;
  end if;
  if p_kind='sales_orders' and exists(select 1 from public.business_sales_lines l where l.tenant_id=a.tenant_id and sales_order_id=p_id and status='active' group by item_id having sum(quantity)>(select coalesce(sum(case m.direction when 'out' then m.quantity else -m.quantity end),0) from public.business_stock_moves m where m.tenant_id=a.tenant_id and m.sales_order_id=p_id and m.item_id=l.item_id and m.status='posted')) then raise exception 'BUSINESS_DELIVERY_INCOMPLETE';end if;
 elsif p_action='post' and d->>'mode'='document' and v->>'status'='draft' then
  new_state:='posted';
  if p_kind='stock_moves' then
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,v->>'direction',(v->>'quantity')::numeric,(v->>'document_date')::date);
   if v->>'sales_order_id' is not null and not exists(select 1 from public.business_sales_orders where tenant_id=a.tenant_id and id=(v->>'sales_order_id')::uuid and status in ('released','completed')) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  elsif p_kind='production_receipts' then
   perform public.business_assert_kind(a.tenant_id,'stock_moves');
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid and status='released';
   if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   produced:=public.business_terminal_quantity(a.tenant_id,wo.id);
   select coalesce(sum(quantity),0) into received from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted';
   if received+(v->>'quantity')::numeric>least(produced,wo.quantity) then raise exception 'BUSINESS_RECEIPT_EXCEEDED';end if;
   if exists(select 1 from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted' and report_date>(v->>'document_date')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if exists(select 1 from jsonb_array_elements(wo.bom_snapshot) x group by x->>'itemId' having sum((x->>'quantity')::numeric)>(select coalesce(sum(m.quantity),0) from public.business_material_issues m where m.tenant_id=a.tenant_id and m.work_order_id=wo.id and m.item_id=(x->>'itemId')::uuid and m.status='posted')) then raise exception 'BUSINESS_MATERIAL_INCOMPLETE';end if;
   if exists(select 1 from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted' and document_date>(v->>'document_date')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if (t.features ? 'quality' or t.features ? 'traceability') and v->>'lot_id' is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
   perform public.business_check_stock(a.tenant_id,wo.item_id,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'FG-'||p_id::text,v->>'name',a.id,'posted',wo.item_id,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'production_receipt',p_id);
   if t.features ? 'traceability' then
    for link in select lot_id,sum(quantity) quantity from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted' group by lot_id loop
     if link.lot_id is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
     if link.lot_id=(v->>'lot_id')::uuid or exists(with recursive walk(id) as (select link.lot_id union select l.component_lot_id from public.business_lot_links l join walk w on l.assembly_lot_id=w.id where l.tenant_id=a.tenant_id and l.status='posted') select 1 from walk where id=(v->>'lot_id')::uuid) then raise exception 'BUSINESS_CYCLE';end if;
     insert into public.business_lot_links(tenant_id,code,name,created_by,status,assembly_lot_id,component_lot_id,quantity,source_receipt_id) values(a.tenant_id,'TR-'||gen_random_uuid()::text,'Truy xuất '||(v->>'code'),a.id,'posted',(v->>'lot_id')::uuid,link.lot_id,greatest(0,round(link.quantity*(received+(v->>'quantity')::numeric)/wo.quantity,4)-(select coalesce(sum(z.quantity),0) from public.business_lot_links z join public.business_production_receipts pr on pr.tenant_id=z.tenant_id and pr.id=z.source_receipt_id where z.tenant_id=a.tenant_id and z.component_lot_id=link.lot_id and z.status='posted' and pr.work_order_id=wo.id and pr.status='posted')),p_id);
    end loop;
   end if;
  elsif p_kind='project_materials' then
   perform public.business_assert_kind(a.tenant_id,'stock_moves');
   if not exists(select 1 from public.business_projects where tenant_id=a.tenant_id and id=(v->>'project_id')::uuid and status='active' and starts_on<=(v->>'document_date')::date) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'PM-'||p_id::text,v->>'name',a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'project_material',p_id);
  elsif p_kind='material_issues' then
   perform public.business_assert_kind(a.tenant_id,'stock_moves');
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid;
   if exists(select 1 from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   select sum((x->>'quantity')::numeric*(1+(x->>'wastePercent')::numeric/100)) into prior from jsonb_array_elements(wo.bom_snapshot) x where x->>'itemId'=v->>'item_id';
   if prior is null then raise exception 'BUSINESS_MATERIAL_NOT_IN_BOM';end if;
   select coalesce(sum(quantity),0) into issued from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=wo.id and item_id=(v->>'item_id')::uuid and status='posted';
   if issued+(v->>'quantity')::numeric>round(prior,4) then raise exception 'BUSINESS_MATERIAL_EXCEEDED';end if;
   if t.features ? 'traceability' and v->>'lot_id' is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
   if not exists(select 1 from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid and status='released') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'MI-'||p_id::text,v->>'name',a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'material_issue',p_id);
  elsif p_kind='production_reports' then
   if not exists(select 1 from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid and status='released') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid;
   if exists(select 1 from public.business_operations where tenant_id=a.tenant_id and work_order_id=wo.id and status='active') and v->>'operation_id' is null then raise exception 'BUSINESS_OPERATION_REQUIRED';end if;
   select coalesce(sum(good_quantity),0) into prior from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=wo.id and operation_id is not distinct from (v->>'operation_id')::uuid and status='posted';
   if (v->>'operation_id')::uuid is not distinct from (select id from public.business_operations where tenant_id=a.tenant_id and work_order_id=wo.id and status='active' order by sequence desc limit 1) and prior+(v->>'good_quantity')::numeric>wo.quantity then raise exception 'BUSINESS_PRODUCTION_EXCEEDED';end if;
   if v->>'operation_id' is not null then
    select * into op from public.business_operations where tenant_id=a.tenant_id and id=(v->>'operation_id')::uuid and work_order_id=wo.id and status='active';
    if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
    select id into item from public.business_operations where tenant_id=a.tenant_id and work_order_id=wo.id and status='active' and sequence<op.sequence order by sequence desc limit 1;
    if item is not null and prior+(v->>'good_quantity')::numeric+(v->>'scrap_quantity')::numeric+(select coalesce(sum(scrap_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and operation_id=op.id and status='posted')>(select coalesce(sum(good_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and operation_id=item and status='posted' and report_date<=(v->>'report_date')::date) then raise exception 'BUSINESS_PREVIOUS_OPERATION_INCOMPLETE';end if;
   end if;
   if (v->>'good_quantity')::numeric+(v->>'scrap_quantity')::numeric+(v->>'labor_hours')::numeric+(v->>'machine_hours')::numeric<=0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if v->>'operation_id' is not null then
    select * into op from public.business_operations where tenant_id=a.tenant_id and id=(v->>'operation_id')::uuid and work_order_id=(v->>'work_order_id')::uuid;
    if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
    select * into wc from public.business_work_centers where tenant_id=a.tenant_id and id=op.work_center_id;
    update public.business_production_reports set labor_cost=labor_hours*coalesce(op.labor_rate_snapshot,wc.labor_rate),machine_cost=machine_hours*coalesce(op.machine_rate_snapshot,wc.machine_rate) where tenant_id=a.tenant_id and id=p_id;
   elsif (v->>'labor_hours')::numeric+(v->>'machine_hours')::numeric>0 then raise exception 'BUSINESS_OPERATION_REQUIRED';end if;
  elsif p_kind in ('project_costs','project_updates') then
   if not exists(select 1 from public.business_projects where tenant_id=a.tenant_id and id=(v->>'project_id')::uuid and status='active' and starts_on<=coalesce(v->>'occurred_on',v->>'reported_on')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
  elsif p_kind='quality_checks' then
   if not exists(select 1 from public.business_lots where tenant_id=a.tenant_id and id=(v->>'lot_id')::uuid and manufactured_on<=(v->>'checked_on')::date and (expires_on is null or expires_on>=(v->>'checked_on')::date)) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if exists(select 1 from public.business_quality_checks where tenant_id=a.tenant_id and lot_id=(v->>'lot_id')::uuid and status='posted' and checked_on>(v->>'checked_on')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   update public.business_lots set quality_state=case v->>'result' when 'passed' then 'released' else 'rejected' end,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'lot_id')::uuid;
  elsif p_kind='lot_links' then
   if v->>'assembly_lot_id'=v->>'component_lot_id' or exists(with recursive walk(id) as (select (v->>'component_lot_id')::uuid union select l.component_lot_id from public.business_lot_links l join walk w on l.assembly_lot_id=w.id where l.tenant_id=a.tenant_id and l.status='posted') select 1 from walk where id=(v->>'assembly_lot_id')::uuid) then raise exception 'BUSINESS_CYCLE';end if;
  elsif p_kind='receivables' and v->>'sales_order_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';
  elsif p_kind='payments' then
   select * into ar from public.business_receivables where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid and status='posted' for update;
   if not found or (v->>'amount')::numeric>ar.amount-ar.paid_amount then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
   update public.business_receivables set paid_amount=paid_amount+(v->>'amount')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=ar.id;
  end if;
 elsif p_action='reverse' and d->>'mode'='document' and p_kind<>'stock_moves' and v->>'status'='posted' then
  new_state:='cancelled';
  if p_kind in ('production_receipts','material_issues','production_reports') then
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid;
   if wo.status<>'released' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if p_kind<>'production_receipts' and exists(select 1 from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if p_kind='production_reports' and exists(select 1 from public.business_production_reports r join public.business_operations o on o.tenant_id=r.tenant_id and o.id=r.operation_id where r.tenant_id=a.tenant_id and r.work_order_id=wo.id and r.status='posted' and o.sequence>(select sequence from public.business_operations where tenant_id=a.tenant_id and id=(v->>'operation_id')::uuid)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  end if;
  if p_kind in ('production_receipts','material_issues','project_materials') then
   select * into move from public.business_stock_moves where tenant_id=a.tenant_id and source_id=p_id and source_kind=case p_kind when 'production_receipts' then 'production_receipt' when 'material_issues' then 'material_issue' else 'project_material' end and status='posted' and reversed_by is null;
   if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   reverse_id:=gen_random_uuid();
   -- Receipts may be recalled from quarantine; consumed stock is never allowed below zero.
   if move.direction='in' then
    select coalesce(sum(case direction when 'in' then quantity else -quantity end),0) into prior from public.business_stock_moves where tenant_id=a.tenant_id and item_id=move.item_id and warehouse_id=move.warehouse_id and lot_id is not distinct from move.lot_id and status='posted';
    if prior<move.quantity then raise exception 'BUSINESS_INSUFFICIENT_STOCK';end if;
   else
    perform public.business_check_stock(a.tenant_id,move.item_id,move.warehouse_id,move.lot_id,'in',move.quantity,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
   end if;
   insert into public.business_stock_moves(id,tenant_id,code,name,notes,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(reverse_id,a.tenant_id,'RV-'||move.id::text,'Đảo '||(v->>'code'),p_reason,a.id,'posted',move.item_id,move.warehouse_id,move.lot_id,case move.direction when 'in' then 'out' else 'in' end,move.quantity,move.unit_cost,(now() at time zone 'Asia/Ho_Chi_Minh')::date,'reversal',move.id);
   update public.business_stock_moves set reversed_by=reverse_id,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=move.id;
   if p_kind='production_receipts' then update public.business_lot_links set status='cancelled',row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and source_receipt_id=p_id and status='posted';end if;
  elsif p_kind='payments' then
   update public.business_receivables set paid_amount=paid_amount-(v->>'amount')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid;
  elsif p_kind='receivables' then
   if v->>'sales_order_id' is not null or (v->>'paid_amount')::numeric>0 then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  elsif p_kind='quality_checks' then
   if exists(select 1 from public.business_stock_moves where tenant_id=a.tenant_id and lot_id=(v->>'lot_id')::uuid and direction='out' and status='posted' and source_kind is distinct from 'reversal') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_lots set quality_state=coalesce((select case result when 'passed' then 'released' else 'rejected' end from public.business_quality_checks where tenant_id=a.tenant_id and lot_id=(v->>'lot_id')::uuid and id<>p_id and status='posted' order by checked_on desc,created_at desc limit 1),'quarantine'),row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'lot_id')::uuid;
  elsif p_kind='lot_links' and v->>'source_receipt_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';
  end if;
 elsif p_action='reverse' and p_kind='stock_moves' and v->>'status'='posted' and v->>'reversed_by' is null and v->>'source_id' is null then
  reverse_id:=gen_random_uuid();new_state:='posted';
  perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,case v->>'direction' when 'in' then 'out' else 'in' end,(v->>'quantity')::numeric,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
  insert into public.business_stock_moves(id,tenant_id,code,name,notes,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id,sales_order_id) values(reverse_id,a.tenant_id,'RV-'||p_id::text,'Đảo '||(v->>'code'),p_reason,a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,case v->>'direction' when 'in' then 'out' else 'in' end,(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(now() at time zone 'Asia/Ho_Chi_Minh')::date,'reversal',p_id,(v->>'sales_order_id')::uuid);
  update public.business_stock_moves set reversed_by=reverse_id where tenant_id=a.tenant_id and id=p_id;
 else raise exception 'BUSINESS_INVALID_TRANSITION';end if;
 execute format('update public.%I set status=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,new_state;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'record.'||p_action,p_kind,p_id,jsonb_build_object('reason',p_reason,'rowVersion',p_expected_version+1));
 r:=jsonb_build_object('recordId',p_id,'rowVersion',p_expected_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);return r;
exception when unique_violation then raise exception 'BUSINESS_DUPLICATE';when check_violation or not_null_violation or numeric_value_out_of_range then raise exception 'BUSINESS_INVALID_INPUT';
end $$;


revoke all on function public.business_terminal_quantity(uuid,uuid) from public,anon,authenticated,service_role;

update public.business_entity_definitions set definition='{"label":"Sản lượng & hao hụt","feature":"production","mode":"document","fields":{"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","required":true},"operation_id":{"label":"Công đoạn","type":"ref","ref":"operations","requiresFeature":"mes"},"good_quantity":{"label":"Sản lượng đạt","type":"number","min":0,"default":0},"scrap_quantity":{"label":"Phế phẩm","type":"number","min":0,"default":0},"labor_hours":{"label":"Giờ nhân công","type":"number","min":0,"default":0,"requiresFeature":"mes"},"machine_hours":{"label":"Giờ máy","type":"number","min":0,"default":0,"requiresFeature":"mes"},"labor_cost":{"label":"Chi phí nhân công","type":"number","min":0,"default":0,"computed":true,"requiresFeature":"mes"},"machine_cost":{"label":"Chi phí máy","type":"number","min":0,"default":0,"computed":true,"requiresFeature":"mes"},"report_date":{"label":"Ngày báo cáo","type":"date","required":true}}}'::jsonb where kind='production_reports';
