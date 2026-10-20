create extension if not exists pgcrypto;

do $$ begin create type public.inventory_document_type as enum ('receipt','issue','transfer','adjustment','reversal'); exception when duplicate_object then null; end $$;
do $$ begin create type public.inventory_document_status as enum ('draft','submitted','posted','cancelled','reversed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.warehouse_status as enum ('active','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.warehouse_type as enum ('main','worksite','temporary','bonded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_count_status as enum ('draft','counting','reviewed','posted','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.units_of_measure (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null, symbol text not null,
  active boolean not null default true, conversion_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (code), check (trim(code) <> '' and trim(name) <> '' and trim(symbol) <> '')
);

create table if not exists public.item_categories (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null,
  parent_id uuid references public.item_categories(id) on delete restrict, active boolean not null default true,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (code), check (parent_id is null or parent_id <> id)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(), item_code text not null, name text not null, short_name text,
  category_id uuid references public.item_categories(id) on delete restrict, base_uom_id uuid not null references public.units_of_measure(id) on delete restrict,
  specification text, brand text, manufacturer text, country_of_origin text, item_barcode text,
  tracked_inventory boolean not null default true, status text not null default 'active' check (status in ('active','inactive')),
  note text, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), row_version integer not null default 1,
  check (trim(item_code) <> '' and trim(name) <> '')
);
create unique index if not exists inventory_items_code_idx on public.inventory_items (lower(item_code));
create index if not exists inventory_items_search_idx on public.inventory_items using gin (to_tsvector('simple', item_code || ' ' || name));
create index if not exists inventory_items_category_status_idx on public.inventory_items (category_id, status);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null, type public.warehouse_type not null default 'main',
  address text, manager_employee_id uuid references public.employees(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict, worksite_id uuid references public.worksites(id) on delete restrict,
  status public.warehouse_status not null default 'active', note text, created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), row_version integer not null default 1,
  check (trim(code) <> '' and trim(name) <> ''), check (type <> 'worksite' or project_id is not null)
);
create unique index if not exists warehouses_code_idx on public.warehouses (lower(code));
create index if not exists warehouses_scope_idx on public.warehouses (status, project_id, worksite_id);

create table if not exists public.warehouse_user_scopes (
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  can_view boolean not null default true, can_operate boolean not null default false,
  granted_by uuid references public.app_accounts(id), granted_at timestamptz not null default now(),
  primary key (account_id, warehouse_id)
);

create table if not exists public.item_warehouse_settings (
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  minimum_stock numeric(20,4) check (minimum_stock is null or minimum_stock >= 0), reorder_level numeric(20,4) check (reorder_level is null or reorder_level >= 0),
  updated_by uuid references public.app_accounts(id), updated_at timestamptz not null default now(), primary key (item_id, warehouse_id)
);

create table if not exists public.inventory_transaction_types (
  code text primary key, document_type public.inventory_document_type not null, label text not null, active boolean not null default true,
  project_required boolean not null default false, approval_required boolean not null default false, sort_order integer not null default 0
);
insert into public.inventory_transaction_types (code,document_type,label,project_required,sort_order) values
 ('PURCHASE','receipt','Nhập mua hàng',false,10),('IMPORT','receipt','Nhập từ XNK',false,20),('RETURN_RECEIPT','receipt','Nhập trả lại',false,30),('OTHER_RECEIPT','receipt','Nhập khác',false,40),
 ('PROJECT','issue','Xuất công trình',true,10),('INTERNAL','issue','Xuất sử dụng nội bộ',false,20),('SUPPLIER_RETURN','issue','Xuất trả nhà cung cấp',false,30),('OTHER_ISSUE','issue','Xuất khác',false,40),
 ('WAREHOUSE_TRANSFER','transfer','Chuyển kho',false,10),('COUNT_VARIANCE','adjustment','Chênh lệch kiểm kê',false,10),('MANUAL_ADJUSTMENT','adjustment','Điều chỉnh kho',false,20)
on conflict (code) do update set label=excluded.label, project_required=excluded.project_required, sort_order=excluded.sort_order;

create table if not exists public.inventory_number_sequences (
  document_type public.inventory_document_type not null, year integer not null, current_value bigint not null default 0,
  primary key (document_type, year)
);
create table if not exists public.stock_count_number_sequences (year integer primary key,current_value bigint not null default 0);

create table if not exists public.inventory_documents (
  id uuid primary key default gen_random_uuid(), client_request_id uuid unique, document_number text not null unique,
  type public.inventory_document_type not null, status public.inventory_document_status not null default 'draft',
  document_date date not null, posting_date date, source_warehouse_id uuid references public.warehouses(id) on delete restrict,
  target_warehouse_id uuid references public.warehouses(id) on delete restrict, transaction_type_code text not null references public.inventory_transaction_types(code) on delete restrict,
  supplier_reference text, shipment_id uuid, shipment_receipt_reference text, project_id uuid references public.projects(id) on delete restrict,
  worksite_id uuid references public.worksites(id) on delete restrict, delivered_by text, received_by text, recipient text, receiving_department text, note text,
  created_by uuid references public.app_accounts(id), submitted_by uuid references public.app_accounts(id), submitted_at timestamptz,
  posted_by uuid references public.app_accounts(id), posted_at timestamptz, post_idempotency_key uuid unique,
  reversed_by uuid references public.app_accounts(id), reversed_at timestamptz, reversal_reason text,
  reversal_document_id uuid references public.inventory_documents(id) on delete restrict, reverses_document_id uuid references public.inventory_documents(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), row_version integer not null default 1,
  check ((type='receipt' and target_warehouse_id is not null) or (type in ('issue','adjustment') and source_warehouse_id is not null) or (type='transfer' and source_warehouse_id is not null and target_warehouse_id is not null and source_warehouse_id<>target_warehouse_id) or type='reversal'),
  check (status not in ('posted','reversed') or posted_at is not null)
);
create index if not exists inventory_documents_list_idx on public.inventory_documents (type,status,document_date desc,created_at desc);
create index if not exists inventory_documents_warehouse_idx on public.inventory_documents (source_warehouse_id,target_warehouse_id,document_date desc);
create index if not exists inventory_documents_project_idx on public.inventory_documents (project_id,worksite_id,posting_date desc);
create index if not exists inventory_documents_shipment_idx on public.inventory_documents (shipment_id,shipment_receipt_reference) where shipment_id is not null;

create table if not exists public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.inventory_documents(id) on delete cascade,
  line_number integer not null, item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(20,4) not null check (quantity > 0), adjustment_quantity numeric(20,4), uom_id uuid not null references public.units_of_measure(id) on delete restrict,
  unit_price numeric(20,4) check (unit_price is null or unit_price >= 0), expected_quantity numeric(20,4) check (expected_quantity is null or expected_quantity >= 0),
  reference text, purpose text, note text, purchase_order_line_id uuid, extension_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), row_version integer not null default 1,
  unique (document_id,line_number), unique (document_id,item_id), check (adjustment_quantity is null or adjustment_quantity <> 0)
);
create index if not exists inventory_document_lines_item_idx on public.inventory_document_lines (item_id,document_id);

create table if not exists public.inventory_balances (
  warehouse_id uuid not null references public.warehouses(id) on delete restrict, item_id uuid not null references public.inventory_items(id) on delete restrict,
  on_hand numeric(20,4) not null default 0, updated_at timestamptz not null default now(), last_ledger_sequence bigint,
  primary key (warehouse_id,item_id)
);

create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(), sequence bigint generated always as identity unique,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict, item_id uuid not null references public.inventory_items(id) on delete restrict,
  transaction_type public.inventory_document_type not null, transaction_id uuid not null references public.inventory_documents(id) on delete restrict,
  transaction_line_id uuid not null references public.inventory_document_lines(id) on delete restrict, entry_side text not null check (entry_side in ('source','target','reversal')),
  posting_date date not null, quantity_in numeric(20,4) not null default 0 check (quantity_in >= 0), quantity_out numeric(20,4) not null default 0 check (quantity_out >= 0),
  signed_quantity numeric(20,4) not null, running_balance numeric(20,4) not null, uom_id uuid not null references public.units_of_measure(id) on delete restrict,
  project_id uuid references public.projects(id) on delete restrict, worksite_id uuid references public.worksites(id) on delete restrict,
  reference text, posted_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  unique (transaction_id,transaction_line_id,warehouse_id,entry_side), check (signed_quantity = quantity_in - quantity_out), check ((quantity_in=0) <> (quantity_out=0))
);
create index if not exists stock_ledger_balance_idx on public.stock_ledger (warehouse_id,item_id,posting_date,sequence);
create index if not exists stock_ledger_document_idx on public.stock_ledger (transaction_id,sequence);
create index if not exists stock_ledger_project_idx on public.stock_ledger (project_id,worksite_id,posting_date desc);

create table if not exists public.stock_counts (
  id uuid primary key default gen_random_uuid(), count_number text not null unique, warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  count_date date not null, snapshot_at timestamptz not null default now(), scope text not null default 'all' check (scope in ('all','selected')),
  transaction_policy text not null default 'freeze' check (transaction_policy in ('freeze','reconcile')), status public.stock_count_status not null default 'counting',
  note text, created_by uuid references public.app_accounts(id), reviewed_by uuid references public.app_accounts(id), reviewed_at timestamptz,
  posted_by uuid references public.app_accounts(id), posted_at timestamptz, post_idempotency_key uuid unique,
  adjustment_document_id uuid references public.inventory_documents(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), row_version integer not null default 1
);
create unique index if not exists stock_counts_one_freeze_idx on public.stock_counts (warehouse_id) where status in ('counting','reviewed') and transaction_policy='freeze';

create table if not exists public.stock_count_lines (
  id uuid primary key default gen_random_uuid(), stock_count_id uuid not null references public.stock_counts(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict, uom_id uuid not null references public.units_of_measure(id) on delete restrict,
  expected_quantity numeric(20,4) not null, counted_quantity numeric(20,4) check (counted_quantity is null or counted_quantity >= 0),
  variance numeric(20,4) generated always as (case when counted_quantity is null then null else counted_quantity-expected_quantity end) stored,
  note text, unique (stock_count_id,item_id)
);

create table if not exists public.inventory_document_attachments (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.inventory_documents(id) on delete restrict,
  file_id uuid not null references public.file_assets(id) on delete restrict, attachment_type text not null check (attachment_type in ('image','pdf','spreadsheet','document')),
  caption text, uploaded_by uuid references public.app_accounts(id), uploaded_at timestamptz not null default now(), sort_order integer not null default 0,
  unique (document_id,file_id)
);

create table if not exists public.warehouse_domain_events (
  id uuid primary key default gen_random_uuid(), event_type text not null, warehouse_id uuid references public.warehouses(id) on delete restrict,
  aggregate_id uuid not null, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), processed_at timestamptz
);
create index if not exists warehouse_events_pending_idx on public.warehouse_domain_events (occurred_at) where processed_at is null;

create or replace function public.next_inventory_document_number(p_type public.inventory_document_type, p_date date)
returns text language plpgsql security definer set search_path=public as $$
declare v_year integer:=extract(year from p_date); v_value bigint; v_prefix text;
begin
  insert into inventory_number_sequences(document_type,year,current_value) values(p_type,v_year,1)
  on conflict(document_type,year) do update set current_value=inventory_number_sequences.current_value+1 returning current_value into v_value;
  v_prefix:=case p_type when 'receipt' then 'PNK' when 'issue' then 'PXK' when 'transfer' then 'CK' when 'adjustment' then 'DC' else 'RV' end;
  return v_prefix||'-'||v_year||'-'||lpad(v_value::text,6,'0');
end $$;

create or replace function public.apply_inventory_delta(p_document_id uuid,p_line_id uuid,p_warehouse_id uuid,p_item_id uuid,p_type public.inventory_document_type,p_posting_date date,p_delta numeric,p_uom_id uuid,p_project_id uuid,p_worksite_id uuid,p_reference text,p_actor_id uuid,p_side text,p_allow_negative boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_balance numeric; v_sequence bigint;
begin
  insert into inventory_balances(warehouse_id,item_id,on_hand) values(p_warehouse_id,p_item_id,0) on conflict do nothing;
  select on_hand into v_balance from inventory_balances where warehouse_id=p_warehouse_id and item_id=p_item_id for update;
  if not p_allow_negative and v_balance+p_delta<0 then raise exception using errcode='P0001',message='INSUFFICIENT_STOCK|'||v_balance||'|'||abs(p_delta); end if;
  v_balance:=v_balance+p_delta;
  insert into stock_ledger(warehouse_id,item_id,transaction_type,transaction_id,transaction_line_id,entry_side,posting_date,quantity_in,quantity_out,signed_quantity,running_balance,uom_id,project_id,worksite_id,reference,posted_by)
  values(p_warehouse_id,p_item_id,p_type,p_document_id,p_line_id,p_side,p_posting_date,greatest(p_delta,0),greatest(-p_delta,0),p_delta,v_balance,p_uom_id,p_project_id,p_worksite_id,p_reference,p_actor_id)
  returning sequence into v_sequence;
  update inventory_balances set on_hand=v_balance,updated_at=now(),last_ledger_sequence=v_sequence where warehouse_id=p_warehouse_id and item_id=p_item_id;
  if exists(select 1 from item_warehouse_settings s where s.warehouse_id=p_warehouse_id and s.item_id=p_item_id and s.minimum_stock is not null and v_balance<=s.minimum_stock) then
    insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload) values('warehouse.low_stock',p_warehouse_id,p_document_id,jsonb_build_object('itemId',p_item_id,'onHand',v_balance));
  end if;
end $$;

create or replace function public.save_inventory_document(p_document_id uuid,p_row_version integer,p_header jsonb,p_lines jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_doc inventory_documents%rowtype; v_line jsonb; v_line_number integer:=0;
begin
  select * into v_doc from inventory_documents where id=p_document_id for update;
  if not found then raise exception using errcode='P0002',message='DOCUMENT_NOT_FOUND'; end if;
  if v_doc.status<>'draft' then raise exception using errcode='P0001',message='DOCUMENT_IMMUTABLE'; end if;
  if v_doc.row_version<>p_row_version then raise exception using errcode='P0001',message='DOCUMENT_VERSION_CONFLICT'; end if;
  if jsonb_array_length(p_lines)=0 then raise exception using errcode='P0001',message='DOCUMENT_HAS_NO_LINES'; end if;
  update inventory_documents set document_date=(p_header->>'document_date')::date,
    source_warehouse_id=nullif(p_header->>'source_warehouse_id','')::uuid,target_warehouse_id=nullif(p_header->>'target_warehouse_id','')::uuid,
    transaction_type_code=p_header->>'transaction_type_code',supplier_reference=nullif(p_header->>'supplier_reference',''),
    project_id=nullif(p_header->>'project_id','')::uuid,worksite_id=nullif(p_header->>'worksite_id','')::uuid,
    delivered_by=nullif(p_header->>'delivered_by',''),received_by=nullif(p_header->>'received_by',''),recipient=nullif(p_header->>'recipient',''),
    receiving_department=nullif(p_header->>'receiving_department',''),note=nullif(p_header->>'note','') where id=p_document_id;
  delete from inventory_document_lines where document_id=p_document_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_number:=v_line_number+1;
    insert into inventory_document_lines(document_id,line_number,item_id,quantity,adjustment_quantity,uom_id,unit_price,expected_quantity,reference,purpose,note)
    values(p_document_id,v_line_number,(v_line->>'item_id')::uuid,(v_line->>'quantity')::numeric,nullif(v_line->>'adjustment_quantity','')::numeric,(v_line->>'uom_id')::uuid,nullif(v_line->>'unit_price','')::numeric,nullif(v_line->>'expected_quantity','')::numeric,nullif(v_line->>'reference',''),nullif(v_line->>'purpose',''),nullif(v_line->>'note',''));
  end loop;
  return p_document_id;
end $$;

create or replace function public.post_inventory_document(p_document_id uuid,p_actor_id uuid,p_posting_date date,p_idempotency_key uuid,p_allow_negative boolean default false,p_override_reason text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_doc inventory_documents%rowtype; v_line inventory_document_lines%rowtype; v_count integer;
begin
  select * into v_doc from inventory_documents where id=p_document_id for update;
  if not found then raise exception using errcode='P0002',message='DOCUMENT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(w.id::text,0)) from warehouses w where w.id in (v_doc.source_warehouse_id,v_doc.target_warehouse_id) order by w.id;
  if v_doc.status='posted' then return v_doc.id; end if;
  if v_doc.status not in ('draft','submitted') then raise exception using errcode='P0001',message='INVALID_DOCUMENT_STATUS'; end if;
  if p_allow_negative and length(trim(coalesce(p_override_reason,'')))<3 then raise exception using errcode='P0001',message='OVERRIDE_REASON_REQUIRED'; end if;
  if v_doc.type='adjustment' and length(trim(coalesce(v_doc.note,'')))<3 then raise exception using errcode='P0001',message='ADJUSTMENT_REASON_REQUIRED'; end if;
  if not exists(select 1 from inventory_transaction_types t where t.code=v_doc.transaction_type_code and t.document_type=v_doc.type and t.active) then raise exception using errcode='P0001',message='INVALID_TRANSACTION_TYPE'; end if;
  if exists(select 1 from inventory_transaction_types t where t.code=v_doc.transaction_type_code and t.project_required and v_doc.project_id is null) then raise exception using errcode='P0001',message='PROJECT_REQUIRED'; end if;
  if v_doc.worksite_id is not null and not exists(select 1 from worksites s where s.id=v_doc.worksite_id and s.project_id=v_doc.project_id) then raise exception using errcode='P0001',message='INVALID_PROJECT_WORKSITE'; end if;
  if exists(select 1 from warehouses w where w.id in (v_doc.source_warehouse_id,v_doc.target_warehouse_id) and w.status<>'active') then raise exception using errcode='P0001',message='WAREHOUSE_INACTIVE'; end if;
  select count(*) into v_count from inventory_document_lines where document_id=v_doc.id; if v_count=0 then raise exception using errcode='P0001',message='DOCUMENT_HAS_NO_LINES'; end if;
  if exists(select 1 from inventory_document_lines l join inventory_items i on i.id=l.item_id where l.document_id=v_doc.id and (i.status<>'active' or not i.tracked_inventory or l.uom_id<>i.base_uom_id or (v_doc.type='adjustment' and l.adjustment_quantity is null))) then raise exception using errcode='P0001',message='INVALID_DOCUMENT_LINE'; end if;
  if v_doc.transaction_type_code<>'COUNT_VARIANCE' and exists(select 1 from stock_counts c where c.status in ('counting','reviewed') and c.transaction_policy='freeze' and c.warehouse_id in (v_doc.source_warehouse_id,v_doc.target_warehouse_id)) then raise exception using errcode='P0001',message='WAREHOUSE_FROZEN'; end if;
  for v_line in select * from inventory_document_lines where document_id=v_doc.id order by line_number loop
    if v_doc.type='receipt' then perform apply_inventory_delta(v_doc.id,v_line.id,v_doc.target_warehouse_id,v_line.item_id,v_doc.type,p_posting_date,v_line.quantity,v_line.uom_id,v_doc.project_id,v_doc.worksite_id,coalesce(v_line.reference,v_doc.supplier_reference),p_actor_id,'target',p_allow_negative);
    elsif v_doc.type='issue' then perform apply_inventory_delta(v_doc.id,v_line.id,v_doc.source_warehouse_id,v_line.item_id,v_doc.type,p_posting_date,-v_line.quantity,v_line.uom_id,v_doc.project_id,v_doc.worksite_id,v_line.reference,p_actor_id,'source',p_allow_negative);
    elsif v_doc.type='transfer' then
      perform apply_inventory_delta(v_doc.id,v_line.id,v_doc.source_warehouse_id,v_line.item_id,v_doc.type,p_posting_date,-v_line.quantity,v_line.uom_id,v_doc.project_id,v_doc.worksite_id,v_line.reference,p_actor_id,'source',p_allow_negative);
      perform apply_inventory_delta(v_doc.id,v_line.id,v_doc.target_warehouse_id,v_line.item_id,v_doc.type,p_posting_date,v_line.quantity,v_line.uom_id,v_doc.project_id,v_doc.worksite_id,v_line.reference,p_actor_id,'target',p_allow_negative);
    elsif v_doc.type='adjustment' then perform apply_inventory_delta(v_doc.id,v_line.id,v_doc.source_warehouse_id,v_line.item_id,v_doc.type,p_posting_date,v_line.adjustment_quantity,v_line.uom_id,v_doc.project_id,v_doc.worksite_id,v_line.reference,p_actor_id,case when v_line.adjustment_quantity<0 then 'source' else 'target' end,p_allow_negative);
    else raise exception using errcode='P0001',message='INVALID_DOCUMENT_TYPE'; end if;
  end loop;
  update inventory_documents set status='posted',posting_date=p_posting_date,posted_by=p_actor_id,posted_at=now(),post_idempotency_key=p_idempotency_key,note=case when p_allow_negative then concat_ws(E'\n',note,'Override âm kho: '||p_override_reason) else note end where id=v_doc.id;
  insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload) values('warehouse.'||v_doc.type||'.posted',coalesce(v_doc.target_warehouse_id,v_doc.source_warehouse_id),v_doc.id,jsonb_build_object('documentNumber',v_doc.document_number));
  return v_doc.id;
end $$;

create or replace function public.next_stock_count_number(p_date date)
returns text language plpgsql security definer set search_path=public as $$
declare v_year integer:=extract(year from p_date); v_value bigint;
begin
  insert into stock_count_number_sequences(year,current_value) values(v_year,1)
  on conflict(year) do update set current_value=stock_count_number_sequences.current_value+1 returning current_value into v_value;
  return 'KK-'||v_year||'-'||lpad(v_value::text,6,'0');
end $$;

create or replace function public.create_stock_count(p_number text,p_warehouse_id uuid,p_count_date date,p_scope text,p_transaction_policy text,p_item_ids uuid[],p_note text,p_actor_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_count_id uuid; v_inserted integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_warehouse_id::text,0));
  if not exists(select 1 from warehouses where id=p_warehouse_id and status='active') then raise exception using errcode='P0001',message='WAREHOUSE_INACTIVE'; end if;
  if p_scope='selected' and coalesce(cardinality(p_item_ids),0)=0 then raise exception using errcode='P0001',message='COUNT_ITEMS_REQUIRED'; end if;
  insert into stock_counts(count_number,warehouse_id,count_date,snapshot_at,scope,transaction_policy,note,created_by)
  values(p_number,p_warehouse_id,p_count_date,clock_timestamp(),p_scope,p_transaction_policy,p_note,p_actor_id) returning id into v_count_id;
  insert into stock_count_lines(stock_count_id,item_id,uom_id,expected_quantity)
  select v_count_id,i.id,i.base_uom_id,coalesce(b.on_hand,0) from inventory_items i
  left join inventory_balances b on b.warehouse_id=p_warehouse_id and b.item_id=i.id
  where i.tracked_inventory and i.status='active' and (p_scope='all' or i.id=any(p_item_ids));
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then raise exception using errcode='P0001',message='COUNT_ITEMS_REQUIRED'; end if;
  return v_count_id;
end $$;

create or replace function public.save_stock_count(p_count_id uuid,p_row_version integer,p_actor_id uuid,p_lines jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_count stock_counts%rowtype; v_requested integer; v_updated integer;
begin
  select * into v_count from stock_counts where id=p_count_id for update;
  if not found then raise exception using errcode='P0002',message='COUNT_NOT_FOUND'; end if;
  if v_count.row_version<>p_row_version then raise exception using errcode='P0001',message='COUNT_VERSION_CONFLICT'; end if;
  if v_count.status not in ('counting','reviewed') then raise exception using errcode='P0001',message='INVALID_COUNT_STATUS'; end if;
  select count(*) into v_requested from jsonb_to_recordset(p_lines) as x(id uuid,counted_quantity numeric,note text);
  if v_requested=0 then raise exception using errcode='P0001',message='COUNT_LINES_REQUIRED'; end if;
  with input as (select * from jsonb_to_recordset(p_lines) as x(id uuid,counted_quantity numeric,note text))
  update stock_count_lines l set counted_quantity=input.counted_quantity,note=input.note from input
  where l.id=input.id and l.stock_count_id=p_count_id and input.counted_quantity>=0;
  get diagnostics v_updated=row_count;
  if v_updated<>v_requested then raise exception using errcode='P0001',message='COUNT_LINE_INVALID'; end if;
  update stock_counts set status='reviewed',reviewed_by=p_actor_id,reviewed_at=now() where id=p_count_id;
  return p_count_id;
end $$;

create or replace function public.audit_inventory_balance(p_warehouse_ids uuid[] default null)
returns table(warehouse_id uuid,item_id uuid,ledger_quantity numeric,balance_quantity numeric,difference numeric)
language sql stable security definer set search_path=public as $$
  with ledger_sum as (
    select l.warehouse_id,l.item_id,sum(l.signed_quantity) quantity from stock_ledger l
    where p_warehouse_ids is null or l.warehouse_id=any(p_warehouse_ids) group by l.warehouse_id,l.item_id
  ), compared as (
    select coalesce(l.warehouse_id,b.warehouse_id) warehouse_id,coalesce(l.item_id,b.item_id) item_id,
      coalesce(l.quantity,0) ledger_quantity,coalesce(b.on_hand,0) balance_quantity
    from ledger_sum l full outer join inventory_balances b on b.warehouse_id=l.warehouse_id and b.item_id=l.item_id
    where p_warehouse_ids is null or coalesce(l.warehouse_id,b.warehouse_id)=any(p_warehouse_ids)
  )
  select c.warehouse_id,c.item_id,c.ledger_quantity,c.balance_quantity,c.balance_quantity-c.ledger_quantity from compared c
  where c.ledger_quantity<>c.balance_quantity order by c.warehouse_id,c.item_id
$$;

create or replace function public.post_stock_count(p_count_id uuid,p_actor_id uuid,p_posting_date date,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_count stock_counts%rowtype; v_document_id uuid; v_document_number text; v_line stock_count_lines%rowtype; v_line_number integer:=0; v_variances integer;
begin
  select * into v_count from stock_counts where id=p_count_id for update; if not found then raise exception using errcode='P0002',message='COUNT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_count.warehouse_id::text,0));
  if v_count.status='posted' then return v_count.adjustment_document_id; end if;
  if v_count.status not in ('counting','reviewed') then raise exception using errcode='P0001',message='INVALID_COUNT_STATUS'; end if;
  if exists(select 1 from stock_count_lines where stock_count_id=p_count_id and counted_quantity is null) then raise exception using errcode='P0001',message='COUNT_INCOMPLETE'; end if;
  if v_count.transaction_policy='reconcile' then
    update stock_count_lines l set expected_quantity=l.expected_quantity+coalesce((select sum(s.signed_quantity) from stock_ledger s where s.warehouse_id=v_count.warehouse_id and s.item_id=l.item_id and s.created_at>v_count.snapshot_at),0)
    where l.stock_count_id=p_count_id;
  end if;
  select count(*) into v_variances from stock_count_lines where stock_count_id=p_count_id and variance<>0;
  if v_variances>0 then
    v_document_number:=next_inventory_document_number('adjustment',p_posting_date);
    insert into inventory_documents(document_number,type,status,document_date,source_warehouse_id,transaction_type_code,note,created_by)
    values(v_document_number,'adjustment','draft',v_count.count_date,v_count.warehouse_id,'COUNT_VARIANCE','Điều chỉnh từ '||v_count.count_number,p_actor_id) returning id into v_document_id;
    for v_line in select * from stock_count_lines where stock_count_id=p_count_id and variance<>0 order by item_id loop
      v_line_number:=v_line_number+1;
      insert into inventory_document_lines(document_id,line_number,item_id,quantity,adjustment_quantity,uom_id,reference)
      values(v_document_id,v_line_number,v_line.item_id,abs(v_line.variance),v_line.variance,v_line.uom_id,v_count.count_number);
    end loop;
    perform post_inventory_document(v_document_id,p_actor_id,p_posting_date,p_idempotency_key,false,null);
  end if;
  update stock_counts set status='posted',posted_by=p_actor_id,posted_at=now(),post_idempotency_key=p_idempotency_key,adjustment_document_id=v_document_id where id=p_count_id;
  insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload) values('warehouse.stock_count.posted',v_count.warehouse_id,p_count_id,jsonb_build_object('adjustmentDocumentId',v_document_id));
  return v_document_id;
end $$;

create or replace function public.reverse_inventory_document(p_document_id uuid,p_actor_id uuid,p_posting_date date,p_idempotency_key uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_doc inventory_documents%rowtype; v_reversal_id uuid; v_ledger stock_ledger%rowtype; v_number text;
begin
  select * into v_doc from inventory_documents where id=p_document_id for update; if not found then raise exception using errcode='P0002',message='DOCUMENT_NOT_FOUND'; end if;
  if v_doc.status='reversed' then return v_doc.reversal_document_id; end if;
  if v_doc.status<>'posted' then raise exception using errcode='P0001',message='ONLY_POSTED_CAN_REVERSE'; end if;
  if length(trim(p_reason))<3 then raise exception using errcode='P0001',message='REVERSAL_REASON_REQUIRED'; end if;
  v_number:=next_inventory_document_number('reversal',p_posting_date);
  insert into inventory_documents(client_request_id,document_number,type,status,document_date,posting_date,source_warehouse_id,target_warehouse_id,transaction_type_code,project_id,worksite_id,note,created_by,posted_by,posted_at,post_idempotency_key,reverses_document_id)
  values(p_idempotency_key,v_number,'reversal','posted',p_posting_date,p_posting_date,v_doc.source_warehouse_id,v_doc.target_warehouse_id,v_doc.transaction_type_code,v_doc.project_id,v_doc.worksite_id,'Đảo '||v_doc.document_number||': '||p_reason,p_actor_id,p_actor_id,now(),p_idempotency_key,v_doc.id) returning id into v_reversal_id;
  insert into inventory_document_lines(document_id,line_number,item_id,quantity,adjustment_quantity,uom_id,reference,note)
  select v_reversal_id,line_number,item_id,quantity,case when adjustment_quantity is null then null else -adjustment_quantity end,uom_id,reference,'Đảo dòng '||line_number from inventory_document_lines where document_id=v_doc.id;
  for v_ledger in select * from stock_ledger where transaction_id=v_doc.id order by sequence loop
    perform apply_inventory_delta(v_reversal_id,(select id from inventory_document_lines where document_id=v_reversal_id and line_number=(select line_number from inventory_document_lines where id=v_ledger.transaction_line_id)),v_ledger.warehouse_id,v_ledger.item_id,'reversal',p_posting_date,-v_ledger.signed_quantity,v_ledger.uom_id,v_ledger.project_id,v_ledger.worksite_id,'Đảo '||v_doc.document_number,p_actor_id,'reversal',false);
  end loop;
  update inventory_documents set status='reversed',reversed_by=p_actor_id,reversed_at=now(),reversal_reason=p_reason,reversal_document_id=v_reversal_id where id=v_doc.id;
  insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload) values('warehouse.document.reversed',coalesce(v_doc.target_warehouse_id,v_doc.source_warehouse_id),v_doc.id,jsonb_build_object('reversalDocumentId',v_reversal_id));
  return v_reversal_id;
end $$;

create or replace function public.prevent_stock_ledger_mutation() returns trigger language plpgsql as $$ begin raise exception 'STOCK_LEDGER_IMMUTABLE'; end $$;
drop trigger if exists stock_ledger_immutable on public.stock_ledger; create trigger stock_ledger_immutable before update or delete on public.stock_ledger for each row execute function public.prevent_stock_ledger_mutation();
create or replace function public.prevent_posted_document_line_mutation() returns trigger language plpgsql as $$ begin if exists(select 1 from inventory_documents where id=coalesce(old.document_id,new.document_id) and status in ('posted','reversed')) then raise exception 'POSTED_DOCUMENT_IMMUTABLE'; end if; return coalesce(new,old); end $$;
drop trigger if exists inventory_lines_posted_immutable on public.inventory_document_lines; create trigger inventory_lines_posted_immutable before update or delete on public.inventory_document_lines for each row execute function public.prevent_posted_document_line_mutation();
create or replace function public.touch_inventory_version() returns trigger language plpgsql as $$ begin new.updated_at=now(); new.row_version=old.row_version+1; return new; end $$;
drop trigger if exists inventory_items_touch on public.inventory_items; create trigger inventory_items_touch before update on public.inventory_items for each row execute function public.touch_inventory_version();
drop trigger if exists warehouses_touch on public.warehouses; create trigger warehouses_touch before update on public.warehouses for each row execute function public.touch_inventory_version();
drop trigger if exists inventory_documents_touch on public.inventory_documents; create trigger inventory_documents_touch before update on public.inventory_documents for each row execute function public.touch_inventory_version();
drop trigger if exists stock_counts_touch on public.stock_counts; create trigger stock_counts_touch before update on public.stock_counts for each row execute function public.touch_inventory_version();

revoke all on function public.next_inventory_document_number(public.inventory_document_type,date) from public,anon,authenticated;
revoke all on function public.apply_inventory_delta(uuid,uuid,uuid,uuid,public.inventory_document_type,date,numeric,uuid,uuid,uuid,text,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.save_inventory_document(uuid,integer,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.post_inventory_document(uuid,uuid,date,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.next_stock_count_number(date) from public,anon,authenticated;
revoke all on function public.create_stock_count(text,uuid,date,text,text,uuid[],text,uuid) from public,anon,authenticated;
revoke all on function public.save_stock_count(uuid,integer,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.audit_inventory_balance(uuid[]) from public,anon,authenticated;
revoke all on function public.post_stock_count(uuid,uuid,date,uuid) from public,anon,authenticated;
revoke all on function public.reverse_inventory_document(uuid,uuid,date,uuid,text) from public,anon,authenticated;
grant execute on function public.next_inventory_document_number(public.inventory_document_type,date),public.apply_inventory_delta(uuid,uuid,uuid,uuid,public.inventory_document_type,date,numeric,uuid,uuid,uuid,text,uuid,text,boolean),public.save_inventory_document(uuid,integer,jsonb,jsonb),public.post_inventory_document(uuid,uuid,date,uuid,boolean,text),public.next_stock_count_number(date),public.create_stock_count(text,uuid,date,text,text,uuid[],text,uuid),public.save_stock_count(uuid,integer,uuid,jsonb),public.audit_inventory_balance(uuid[]),public.post_stock_count(uuid,uuid,date,uuid),public.reverse_inventory_document(uuid,uuid,date,uuid,text) to service_role;

alter table public.units_of_measure enable row level security; alter table public.item_categories enable row level security; alter table public.inventory_items enable row level security;
alter table public.warehouses enable row level security; alter table public.warehouse_user_scopes enable row level security; alter table public.item_warehouse_settings enable row level security;
alter table public.inventory_transaction_types enable row level security; alter table public.inventory_documents enable row level security; alter table public.inventory_document_lines enable row level security;
alter table public.inventory_balances enable row level security; alter table public.stock_ledger enable row level security; alter table public.stock_counts enable row level security; alter table public.stock_count_lines enable row level security;
alter table public.inventory_document_attachments enable row level security; alter table public.warehouse_domain_events enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('warehouse-documents','warehouse-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.permissions(key,module,description) values
 ('warehouse.view_all','warehouse','Xem mọi kho'),('warehouse.item.view','warehouse','Xem hàng hóa'),('warehouse.item.manage','warehouse','Quản lý hàng hóa'),('warehouse.master.manage','warehouse','Quản lý danh mục kho'),
 ('warehouse.receipt.view','warehouse','Xem phiếu nhập'),('warehouse.receipt.create','warehouse','Tạo phiếu nhập'),('warehouse.receipt.post','warehouse','Ghi sổ phiếu nhập'),('warehouse.receipt.reverse','warehouse','Đảo phiếu nhập'),
 ('warehouse.issue.view','warehouse','Xem phiếu xuất'),('warehouse.issue.create','warehouse','Tạo phiếu xuất'),('warehouse.issue.post','warehouse','Ghi sổ phiếu xuất'),('warehouse.issue.reverse','warehouse','Đảo phiếu xuất'),
 ('warehouse.transfer.view','warehouse','Xem phiếu chuyển'),('warehouse.transfer.create','warehouse','Tạo phiếu chuyển'),('warehouse.transfer.post','warehouse','Ghi sổ phiếu chuyển'),
 ('warehouse.adjustment.view','warehouse','Xem điều chỉnh kho'),('warehouse.adjustment.create','warehouse','Tạo điều chỉnh kho'),('warehouse.adjustment.post','warehouse','Ghi sổ điều chỉnh kho'),
 ('warehouse.stock_count.view','warehouse','Xem kiểm kê'),('warehouse.stock_count.create','warehouse','Tạo kiểm kê'),('warehouse.stock_count.post','warehouse','Ghi nhận kiểm kê'),
 ('warehouse.ledger.view','warehouse','Xem sổ kho'),('warehouse.report.export','warehouse','Xuất báo cáo kho')
on conflict(key) do update set module=excluded.module,description=excluded.description;
insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r cross join public.permissions p where r.code='admin' and p.module='warehouse' on conflict do nothing;

insert into public.units_of_measure(id,code,name,symbol) values
 ('e0000000-0000-4000-8000-000000000001','CAI','Cái','cái'),('e0000000-0000-4000-8000-000000000002','KG','Kilôgam','kg'),('e0000000-0000-4000-8000-000000000003','M','Mét','m'),('e0000000-0000-4000-8000-000000000004','THANH','Thanh','thanh'),('e0000000-0000-4000-8000-000000000005','BO','Bộ','bộ') on conflict(id) do nothing;
insert into public.item_categories(id,code,name,sort_order) values('e1000000-0000-4000-8000-000000000001','RAIL','Thép ray',10),('e1000000-0000-4000-8000-000000000002','ACCESSORY','Phụ kiện ray',20),('e1000000-0000-4000-8000-000000000003','PPE','Bảo hộ lao động',30) on conflict(id) do nothing;
insert into public.inventory_items(id,item_code,name,category_id,base_uom_id,specification) values
 ('e2000000-0000-4000-8000-000000000001','RAY-P24','Ray P24','e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000004','12 m/thanh'),
 ('e2000000-0000-4000-8000-000000000002','PK-KR-01','Kẹp ray tiêu chuẩn','e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001',null),
 ('e2000000-0000-4000-8000-000000000003','PPE-HELMET','Mũ bảo hộ','e1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000001',null) on conflict(id) do nothing;
insert into public.warehouses(id,code,name,type,address,project_id,worksite_id) values
 ('e3000000-0000-4000-8000-000000000001','KHO-CHINH','Kho chính','main','Trụ sở Châu Tuấn',null,null),
 ('e3000000-0000-4000-8000-000000000002','KHO-QC03','Kho công trường QC03','worksite','Cảng ABC','b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001')
on conflict(id) do nothing;
insert into public.item_warehouse_settings(item_id,warehouse_id,minimum_stock) values('e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',10),('e2000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000001',50),('e2000000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000001',10) on conflict do nothing;
update public.system_settings set value=jsonb_set(value,'{warehouse}','true'::jsonb,true) where group_key='modules';
