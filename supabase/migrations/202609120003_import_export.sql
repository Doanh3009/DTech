-- Prompt 11: import/export contracts, shipments, documents, customs and warehouse receiving.
create type public.import_contract_status as enum ('draft','active','partially_shipped','completed','cancelled');
create type public.shipment_status as enum ('planned','booked','in_transit','arrived_port','customs_processing','customs_cleared','delivering_to_warehouse','partially_received','received','completed','cancelled');
create type public.customs_status as enum ('not_started','preparing_documents','declared','inspection','pending_duty','cleared','issue');

create table public.business_partners (
  id uuid primary key default gen_random_uuid(), partner_code text not null unique,
  name text not null, trading_name text, partner_types text[] not null default array['supplier']::text[],
  country text, address text, email text, phone text, contact_person text,
  tax_registration text, status text not null default 'active' check (status in ('active','inactive')),
  note text, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), row_version integer not null default 1
);

create table public.import_contract_number_sequences (
  sequence_year integer primary key, last_value bigint not null default 0
);
create table public.shipment_number_sequences (
  sequence_year integer primary key, last_value bigint not null default 0
);

create table public.import_contracts (
  id uuid primary key default gen_random_uuid(), client_request_id uuid unique,
  contract_number text not null unique, supplier_id uuid not null references public.business_partners(id),
  order_date date not null, currency text not null default 'USD', incoterm text, payment_term text,
  expected_delivery_date date, status public.import_contract_status not null default 'draft', note text,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), row_version integer not null default 1
);

create table public.import_contract_lines (
  id uuid primary key default gen_random_uuid(), contract_id uuid not null references public.import_contracts(id) on delete cascade,
  line_number integer not null, item_id uuid not null references public.inventory_items(id),
  description_snapshot text not null, ordered_quantity numeric(20,4) not null check (ordered_quantity>0),
  uom_id uuid not null references public.units_of_measure(id), unit_price numeric(20,4) check (unit_price>=0),
  currency text, expected_delivery_date date, note text, row_version integer not null default 1,
  unique(contract_id,line_number)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(), client_request_id uuid unique, shipment_number text not null unique,
  contract_id uuid references public.import_contracts(id), supplier_id uuid not null references public.business_partners(id),
  carrier_id uuid references public.business_partners(id), forwarder_id uuid references public.business_partners(id),
  assigned_account_id uuid references public.app_accounts(id), transport_mode text not null default 'sea',
  shipment_type text not null default 'import', origin text, destination text, port_of_loading text, port_of_discharge text,
  booking_number text, bill_of_lading_number text, forwarder_reference text, carrier_reference text,
  planned_etd date, current_etd date, original_eta date, current_eta date,
  actual_departure date, actual_arrival date, status public.shipment_status not null default 'planned',
  incoterm_snapshot text, currency text, note text, cancelled_reason text, closed_reason text,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), row_version integer not null default 1
);

create table public.shipment_lines (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  contract_line_id uuid references public.import_contract_lines(id), line_number integer not null,
  item_id uuid not null references public.inventory_items(id), item_code_snapshot text not null,
  item_name_snapshot text not null, specification_snapshot text,
  expected_quantity numeric(20,4) not null check (expected_quantity>0), uom_id uuid not null references public.units_of_measure(id),
  package_count integer check (package_count>=0), gross_weight numeric(20,4) check (gross_weight>=0),
  net_weight numeric(20,4) check (net_weight>=0), volume numeric(20,4) check (volume>=0),
  marks_numbers text, note text, row_version integer not null default 1, unique(shipment_id,line_number)
);

create table public.shipment_containers (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  container_number text not null, seal_number text, container_type text, size text,
  gross_weight numeric(20,4) check (gross_weight>=0), tare_weight numeric(20,4) check (tare_weight>=0),
  status text not null default 'planned' check (status in ('planned','loaded','in_transit','arrived','customs_cleared','delivered','empty_returned')),
  note text, created_at timestamptz not null default now(), row_version integer not null default 1,
  unique(shipment_id,container_number)
);

create table public.shipment_line_container_allocations (
  shipment_line_id uuid not null references public.shipment_lines(id) on delete cascade,
  container_id uuid not null references public.shipment_containers(id) on delete cascade,
  quantity numeric(20,4) not null check (quantity>0), primary key(shipment_line_id,container_id)
);

create table public.shipment_document_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  required_for_import boolean not null default false, required_before_customs boolean not null default false,
  expiry_date_applicable boolean not null default false, transport_modes text[] not null default '{}',
  active boolean not null default true, sort_order integer not null default 0
);

create table public.shipment_documents (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  document_type_id uuid not null references public.shipment_document_types(id), document_number text,
  issue_date date, expiry_date date, issuer text, file_id uuid not null references public.file_assets(id) on delete restrict,
  status text not null default 'received' check (status in ('received','valid','expired','replaced','archived')),
  version integer not null default 1, supersedes_document_id uuid references public.shipment_documents(id), note text,
  uploaded_by uuid references public.app_accounts(id), uploaded_at timestamptz not null default now()
);

create table public.shipment_schedule_history (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  schedule_type text not null check (schedule_type in ('etd','eta')), old_value date, new_value date not null,
  reason text, source text not null check (source in ('manual','forwarder','carrier','supplier','carrier_api','system')),
  client_request_id uuid not null unique, changed_by uuid references public.app_accounts(id), changed_at timestamptz not null default now()
);

create table public.shipment_customs (
  shipment_id uuid primary key references public.shipments(id) on delete cascade,
  status public.customs_status not null default 'not_started', declaration_number text, declaration_date date,
  customs_broker_id uuid references public.business_partners(id), clearance_date date, channel text,
  issue_note text, severity text check (severity is null or severity in ('low','medium','high')),
  import_duty numeric(20,2), vat numeric(20,2), other_charges numeric(20,2), currency text, note text,
  updated_by uuid references public.app_accounts(id), updated_at timestamptz not null default now(), row_version integer not null default 1,
  check (status<>'issue' or length(trim(issue_note))>=3)
);

create table public.shipment_delivery_info (
  shipment_id uuid primary key references public.shipments(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','planned','in_transit','delivered')),
  planned_delivery_date date, actual_delivery_date date, warehouse_id uuid references public.warehouses(id),
  truck_reference text, note text, updated_at timestamptz not null default now(), row_version integer not null default 1
);

create table public.shipment_receiving_resolutions (
  id uuid primary key default gen_random_uuid(), shipment_line_id uuid not null references public.shipment_lines(id) on delete cascade,
  resolution_type text not null check (resolution_type in ('close_short','accept_over')),
  quantity numeric(20,4) not null, reason text not null check (length(trim(reason))>=3),
  resolved_by uuid references public.app_accounts(id), resolved_at timestamptz not null default now()
);

create table public.shipment_status_history (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  old_status public.shipment_status, new_status public.shipment_status not null, reason text,
  changed_by uuid references public.app_accounts(id), changed_at timestamptz not null default now()
);

create table public.import_export_settings (
  singleton boolean primary key default true check(singleton), shipment_prefix text not null default 'SHP',
  contract_prefix text not null default 'PO', over_receipt_tolerance_percent numeric(7,4) not null default 2 check(over_receipt_tolerance_percent>=0),
  eta_delay_days integer not null default 1 check(eta_delay_days>=0), customs_attention_days integer not null default 5 check(customs_attention_days>=1),
  arrival_not_received_days integer not null default 2 check(arrival_not_received_days>=0), stale_shipment_days integer not null default 14 check(stale_shipment_days>=1),
  updated_by uuid references public.app_accounts(id), updated_at timestamptz not null default now()
);
insert into public.import_export_settings(singleton) values(true);

alter table public.inventory_document_lines add column shipment_line_id uuid references public.shipment_lines(id) on delete restrict;

create index business_partners_name_idx on public.business_partners(name);
create index import_contracts_supplier_status_idx on public.import_contracts(supplier_id,status);
create index import_contract_lines_item_idx on public.import_contract_lines(item_id);
create index shipments_contract_idx on public.shipments(contract_id);
create index shipments_supplier_status_idx on public.shipments(supplier_id,status);
create index shipments_eta_idx on public.shipments(current_eta) where status not in ('completed','cancelled');
create index shipments_assignee_idx on public.shipments(assigned_account_id);
create index shipment_lines_shipment_item_idx on public.shipment_lines(shipment_id,item_id);
create index shipment_containers_number_idx on public.shipment_containers(container_number);
create index shipment_documents_checklist_idx on public.shipment_documents(shipment_id,document_type_id,status);
create index shipment_schedule_history_order_idx on public.shipment_schedule_history(shipment_id,changed_at desc);
create index shipment_customs_status_idx on public.shipment_customs(status);
create index inventory_document_lines_shipment_line_idx on public.inventory_document_lines(shipment_line_id) where shipment_line_id is not null;

create or replace function public.next_import_contract_number(p_date date) returns text
language plpgsql security definer set search_path=public as $$
declare v_year integer:=extract(year from p_date); v_value bigint; v_prefix text;
begin
  insert into import_contract_number_sequences(sequence_year,last_value) values(v_year,1)
  on conflict(sequence_year) do update set last_value=import_contract_number_sequences.last_value+1 returning last_value into v_value;
  select contract_prefix into v_prefix from import_export_settings where singleton;
  return coalesce(v_prefix,'PO')||'-'||v_year||'-'||lpad(v_value::text,6,'0');
end $$;

create or replace function public.next_shipment_number(p_date date) returns text
language plpgsql security definer set search_path=public as $$
declare v_year integer:=extract(year from p_date); v_value bigint; v_prefix text;
begin
  insert into shipment_number_sequences(sequence_year,last_value) values(v_year,1)
  on conflict(sequence_year) do update set last_value=shipment_number_sequences.last_value+1 returning last_value into v_value;
  select shipment_prefix into v_prefix from import_export_settings where singleton;
  return coalesce(v_prefix,'SHP')||'-'||v_year||'-'||lpad(v_value::text,6,'0');
end $$;

create or replace function public.update_shipment_schedule(
  p_shipment_id uuid,p_schedule_type text,p_new_value date,p_reason text,p_source text,
  p_actor_id uuid,p_row_version integer,p_client_request_id uuid
) returns integer language plpgsql security definer set search_path=public as $$
declare v_shipment shipments%rowtype; v_old date; v_existing_shipment uuid; v_version integer;
begin
  select shipment_id into v_existing_shipment from shipment_schedule_history where client_request_id=p_client_request_id;
  if found then
    if v_existing_shipment<>p_shipment_id then raise exception using errcode='P0001',message='IDEMPOTENCY_KEY_CONFLICT'; end if;
    select row_version into v_version from shipments where id=p_shipment_id; return v_version;
  end if;
  select * into v_shipment from shipments where id=p_shipment_id for update;
  if not found then raise exception using errcode='P0002',message='SHIPMENT_NOT_FOUND'; end if;
  if v_shipment.row_version<>p_row_version then raise exception using errcode='P0001',message='SHIPMENT_VERSION_CONFLICT'; end if;
  if v_shipment.status in ('completed','cancelled') then raise exception using errcode='P0001',message='SHIPMENT_CLOSED'; end if;
  if p_schedule_type='eta' then v_old:=v_shipment.current_eta;
  elsif p_schedule_type='etd' then v_old:=v_shipment.current_etd;
  else raise exception using errcode='P0001',message='SCHEDULE_TYPE_INVALID'; end if;
  insert into shipment_schedule_history(shipment_id,schedule_type,old_value,new_value,reason,source,client_request_id,changed_by)
  values(p_shipment_id,p_schedule_type,v_old,p_new_value,nullif(trim(p_reason),''),p_source,p_client_request_id,p_actor_id);
  if p_schedule_type='eta' then
    update shipments set current_eta=p_new_value,original_eta=coalesce(original_eta,p_new_value) where id=p_shipment_id returning row_version into v_version;
  else update shipments set current_etd=p_new_value,planned_etd=coalesce(planned_etd,p_new_value) where id=p_shipment_id returning row_version into v_version;
  end if;
  return v_version;
end $$;

create or replace function public.touch_import_export_version() returns trigger language plpgsql as $$
begin new.updated_at=now(); new.row_version=old.row_version+1; return new; end $$;
create trigger business_partners_touch before update on public.business_partners for each row execute function public.touch_import_export_version();
create trigger import_contracts_touch before update on public.import_contracts for each row execute function public.touch_import_export_version();
create trigger shipments_touch before update on public.shipments for each row execute function public.touch_import_export_version();
create trigger shipment_customs_touch before update on public.shipment_customs for each row execute function public.touch_import_export_version();
create trigger shipment_delivery_touch before update on public.shipment_delivery_info for each row execute function public.touch_import_export_version();

revoke all on function public.next_import_contract_number(date) from public,anon,authenticated;
revoke all on function public.next_shipment_number(date) from public,anon,authenticated;
revoke all on function public.update_shipment_schedule(uuid,text,date,text,text,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.next_import_contract_number(date),public.next_shipment_number(date),public.update_shipment_schedule(uuid,text,date,text,text,uuid,integer,uuid) to service_role;

alter table public.business_partners enable row level security;
alter table public.import_contracts enable row level security; alter table public.import_contract_lines enable row level security;
alter table public.shipments enable row level security; alter table public.shipment_lines enable row level security;
alter table public.shipment_containers enable row level security; alter table public.shipment_line_container_allocations enable row level security;
alter table public.shipment_document_types enable row level security; alter table public.shipment_documents enable row level security;
alter table public.shipment_schedule_history enable row level security; alter table public.shipment_customs enable row level security;
alter table public.shipment_delivery_info enable row level security; alter table public.shipment_receiving_resolutions enable row level security;
alter table public.shipment_status_history enable row level security; alter table public.import_export_settings enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('shipment-documents','shipment-documents',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.permissions(key,module,description) values
 ('import_export.view','import_export','Xem module xuất nhập khẩu'),('import_export.view_all','import_export','Xem mọi lô hàng'),('import_contract.view','import_export','Xem hợp đồng nhập khẩu'),
 ('import_contract.create','import_export','Tạo hợp đồng nhập khẩu'),('import_contract.edit','import_export','Sửa hợp đồng nhập khẩu'),('import_contract.close','import_export','Đóng hợp đồng nhập khẩu'),
 ('shipment.view','import_export','Xem lô hàng'),('shipment.create','import_export','Tạo lô hàng'),('shipment.edit','import_export','Sửa lô hàng'),
 ('shipment.update_schedule','import_export','Cập nhật ETD ETA'),('shipment.close','import_export','Đóng lô hàng'),('shipment.cancel','import_export','Hủy lô hàng'),
 ('shipment_document.view','import_export','Xem chứng từ lô hàng'),('shipment_document.upload','import_export','Tải chứng từ lô hàng'),('shipment_document.replace','import_export','Thay chứng từ lô hàng'),
 ('customs.view','import_export','Xem thông quan'),('customs.manage','import_export','Quản lý thông quan'),
 ('shipment_receiving.view','import_export','Xem nhận hàng'),('shipment_receiving.create_receipt','import_export','Tạo phiếu nhập từ lô hàng'),
 ('partner.view','import_export','Xem đối tác'),('partner.manage','import_export','Quản lý đối tác'),('import_export.report.export','import_export','Xuất báo cáo XNK')
on conflict(key) do update set module=excluded.module,description=excluded.description;
insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r cross join public.permissions p where r.code='admin' and p.module='import_export' on conflict do nothing;

insert into public.shipment_document_types(code,name,required_for_import,required_before_customs,expiry_date_applicable,sort_order) values
 ('COMMERCIAL_INVOICE','Commercial Invoice',true,true,false,10),('PACKING_LIST','Packing List',true,true,false,20),
 ('BILL_OF_LADING','Bill of Lading',true,true,false,30),('CERTIFICATE_OF_ORIGIN','Certificate of Origin',true,true,false,40),
 ('INSURANCE','Insurance',false,false,true,50),('CUSTOMS_DECLARATION','Customs Declaration',true,false,false,60),
 ('INSPECTION_CERTIFICATE','Inspection Certificate',false,false,true,70),('DELIVERY_ORDER','Delivery Order',false,false,false,80),
 ('ARRIVAL_NOTICE','Arrival Notice',false,false,false,90),('OTHER','Other',false,false,false,100)
on conflict(code) do nothing;

update public.system_settings set value=jsonb_set(value,'{import_export}','true'::jsonb,true) where group_key='modules';
update public.system_settings
set value=jsonb_set(value,'{itemOrder}',coalesce(value->'itemOrder','[]'::jsonb)||'["/import-export","/import-export/contracts","/import-export/partners"]'::jsonb)
where group_key='navigation' and not (coalesce(value->'itemOrder','[]'::jsonb) ? '/import-export');
