-- Preserve the legacy, globally scoped business_partners table.
create function public.business_entity_table(p_kind text) returns text language sql immutable strict set search_path='' as $$ select case when p_kind='partners' then 'business_tenant_partners' else 'business_'||p_kind end $$;
revoke all on function public.business_entity_table(text) from public,anon,authenticated,service_role;
-- Generated from businessIndustries.json and businessEntities.json; regenerate before this migration is applied.

insert into public.business_industry_packs(key,label,features) values('metalworking','Cơ khí & gia công','["inventory","production","mes","quality"]'::jsonb);

insert into public.business_industry_packs(key,label,features) values('plastics_packaging','Nhựa & bao bì','["inventory","production","mes","quality"]'::jsonb);

insert into public.business_industry_packs(key,label,features) values('electronics','Điện tử & linh kiện','["inventory","production","mes","traceability","quality"]'::jsonb);

insert into public.business_industry_packs(key,label,features) values('food_beverage','Thực phẩm & đồ uống','["inventory","production","traceability","quality"]'::jsonb);

insert into public.business_industry_packs(key,label,features) values('trading','Thương mại & phân phối','["inventory","sales","crm"]'::jsonb);

insert into public.business_industry_packs(key,label,features) values('construction','Xây dựng & thi công','["inventory","projects","crm"]'::jsonb);

insert into public.business_entity_definitions(kind,definition) values('items','{"label":"Vật tư & thành phẩm","feature":"inventory","mode":"master","fields":{"unit":{"label":"Đơn vị tính","type":"text","required":true,"max":30},"tracking":{"label":"Theo dõi","type":"enum","values":{"none":"Thông thường","lot":"Theo lô","serial":"Theo số sê-ri"},"default":"none"},"standard_cost":{"label":"Giá tham chiếu","type":"number","min":0,"default":0}}}'::jsonb);

create table public.business_items(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 unit text not null check(char_length(unit)<=30),
 tracking text not null default 'none' check(tracking in ('none','lot','serial')),
 standard_cost numeric(20,4) not null default 0 check(standard_cost>=0 and standard_cost<=1000000000000000)
);

create unique index business_items_code_idx on public.business_items(tenant_id,lower(code));
create index business_items_tenant_date_idx on public.business_items(tenant_id,updated_at desc);
alter table public.business_items enable row level security;
revoke all on public.business_items from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('warehouses','{"label":"Kho","feature":"inventory","mode":"master","fields":{"address":{"label":"Địa chỉ","type":"text","max":240}}}'::jsonb);

create table public.business_warehouses(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 address text check(char_length(address)<=240)
);

create unique index business_warehouses_code_idx on public.business_warehouses(tenant_id,lower(code));
create index business_warehouses_tenant_date_idx on public.business_warehouses(tenant_id,updated_at desc);
alter table public.business_warehouses enable row level security;
revoke all on public.business_warehouses from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('partners','{"label":"Khách hàng & nhà cung cấp","feature":"crm","mode":"master","fields":{"partner_type":{"label":"Loại đối tác","type":"enum","values":{"customer":"Khách hàng","supplier":"Nhà cung cấp","both":"Cả hai"},"default":"customer"},"phone":{"label":"Điện thoại","type":"text","max":30},"email":{"label":"Email","type":"email","max":254},"tax_code":{"label":"Mã số thuế","type":"text","max":30}}}'::jsonb);

create table public.business_tenant_partners(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 partner_type text not null default 'customer' check(partner_type in ('customer','supplier','both')),
 phone text check(char_length(phone)<=30),
 email text check(char_length(email)<=254),
 tax_code text check(char_length(tax_code)<=30)
);

create unique index business_tenant_partners_code_idx on public.business_tenant_partners(tenant_id,lower(code));
create index business_tenant_partners_tenant_date_idx on public.business_tenant_partners(tenant_id,updated_at desc);
alter table public.business_tenant_partners enable row level security;
revoke all on public.business_tenant_partners from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('molds','{"label":"Khuôn & thông số","feature":"production","industries":["plastics_packaging"],"mode":"master","fields":{"item_id":{"label":"Thành phẩm","type":"ref","ref":"items","required":true},"cavities":{"label":"Số lòng khuôn","type":"number","min":1,"integer":true,"default":1},"cycle_seconds":{"label":"Chu kỳ (giây)","type":"number","min":0,"default":0}}}'::jsonb);

create table public.business_molds(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 item_id uuid not null,
 cavities integer not null default 1 check(cavities>=1 and cavities<=1000000000000000),
 cycle_seconds numeric(20,4) not null default 0 check(cycle_seconds>=0 and cycle_seconds<=1000000000000000)
);

create unique index business_molds_code_idx on public.business_molds(tenant_id,lower(code));
create index business_molds_tenant_date_idx on public.business_molds(tenant_id,updated_at desc);
alter table public.business_molds enable row level security;
revoke all on public.business_molds from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('boms','{"label":"Định mức sản xuất","feature":"production","mode":"master","fields":{"item_id":{"label":"Thành phẩm","type":"ref","ref":"items","required":true},"output_quantity":{"label":"Sản lượng định mức","type":"number","min":0.0001,"default":1},"revision":{"label":"Phiên bản","type":"text","max":30}}}'::jsonb);

create table public.business_boms(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 item_id uuid not null,
 output_quantity numeric(20,4) not null default 1 check(output_quantity>=0.0001 and output_quantity<=1000000000000000),
 revision text check(char_length(revision)<=30)
);

create unique index business_boms_code_idx on public.business_boms(tenant_id,lower(code));
create index business_boms_tenant_date_idx on public.business_boms(tenant_id,updated_at desc);
alter table public.business_boms enable row level security;
revoke all on public.business_boms from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('bom_lines','{"label":"Nguyên liệu định mức","feature":"production","mode":"master","fields":{"bom_id":{"label":"Bộ định mức","type":"ref","ref":"boms","required":true},"item_id":{"label":"Nguyên liệu","type":"ref","ref":"items","required":true},"quantity":{"label":"Lượng nguyên liệu","type":"number","min":0.0001,"required":true},"waste_percent":{"label":"Hao hụt cho phép (%)","type":"number","min":0,"max":100,"default":0}}}'::jsonb);

create table public.business_bom_lines(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 bom_id uuid not null,
 item_id uuid not null,
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 waste_percent numeric(20,4) not null default 0 check(waste_percent>=0 and waste_percent<=100)
);

create unique index business_bom_lines_code_idx on public.business_bom_lines(tenant_id,lower(code));
create index business_bom_lines_tenant_date_idx on public.business_bom_lines(tenant_id,updated_at desc);
alter table public.business_bom_lines enable row level security;
revoke all on public.business_bom_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('work_centers','{"label":"Trạm & nguồn lực","feature":"mes","mode":"master","fields":{"labor_rate":{"label":"Chi phí nhân công / giờ","type":"number","min":0,"default":0},"machine_rate":{"label":"Chi phí máy / giờ","type":"number","min":0,"default":0}}}'::jsonb);

create table public.business_work_centers(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 labor_rate numeric(20,4) not null default 0 check(labor_rate>=0 and labor_rate<=1000000000000000),
 machine_rate numeric(20,4) not null default 0 check(machine_rate>=0 and machine_rate<=1000000000000000)
);

create unique index business_work_centers_code_idx on public.business_work_centers(tenant_id,lower(code));
create index business_work_centers_tenant_date_idx on public.business_work_centers(tenant_id,updated_at desc);
alter table public.business_work_centers enable row level security;
revoke all on public.business_work_centers from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('work_orders','{"label":"Lệnh sản xuất","feature":"production","mode":"order","fields":{"item_id":{"label":"Thành phẩm","type":"ref","ref":"items","required":true},"bom_id":{"label":"Định mức","type":"ref","ref":"boms"},"mold_id":{"label":"Khuôn","type":"ref","ref":"molds"},"quantity":{"label":"Số lượng kế hoạch","type":"number","min":0.0001,"required":true},"due_date":{"label":"Hạn hoàn thành","type":"date","required":true}}}'::jsonb);

create table public.business_work_orders(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','released','completed','cancelled')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 item_id uuid not null,
 bom_id uuid,
 mold_id uuid,
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 due_date date not null,
 bom_snapshot jsonb not null default '[]'::jsonb
);

create unique index business_work_orders_code_idx on public.business_work_orders(tenant_id,lower(code));
create index business_work_orders_tenant_date_idx on public.business_work_orders(tenant_id,updated_at desc);
alter table public.business_work_orders enable row level security;
revoke all on public.business_work_orders from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('operations','{"label":"Công đoạn sản xuất","feature":"mes","mode":"master","fields":{"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","required":true},"work_center_id":{"label":"Trạm sản xuất","type":"ref","ref":"work_centers","required":true},"sequence":{"label":"Thứ tự","type":"number","min":1,"integer":true,"default":1},"planned_hours":{"label":"Giờ kế hoạch","type":"number","min":0,"default":0}}}'::jsonb);

create table public.business_operations(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 work_order_id uuid not null,
 work_center_id uuid not null,
 sequence integer not null default 1 check(sequence>=1 and sequence<=1000000000000000),
 planned_hours numeric(20,4) not null default 0 check(planned_hours>=0 and planned_hours<=1000000000000000)
);

create unique index business_operations_code_idx on public.business_operations(tenant_id,lower(code));
create index business_operations_tenant_date_idx on public.business_operations(tenant_id,updated_at desc);
alter table public.business_operations enable row level security;
revoke all on public.business_operations from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('lots','{"label":"Lô & hạn sử dụng","feature":"inventory","mode":"master","fields":{"item_id":{"label":"Vật tư / thành phẩm","type":"ref","ref":"items","required":true},"manufactured_on":{"label":"Ngày sản xuất","type":"date","required":true},"expires_on":{"label":"Hạn sử dụng","type":"date"},"quality_state":{"label":"Chất lượng","type":"enum","values":{"quarantine":"Chờ kiểm tra","released":"Được sử dụng","rejected":"Không đạt"},"default":"quarantine","computed":true}}}'::jsonb);

create table public.business_lots(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 item_id uuid not null,
 manufactured_on date not null,
 expires_on date,
 quality_state text not null default 'quarantine' check(quality_state in ('quarantine','released','rejected')),
 check(expires_on is null or expires_on>=manufactured_on)
);

create unique index business_lots_code_idx on public.business_lots(tenant_id,lower(code));
create index business_lots_tenant_date_idx on public.business_lots(tenant_id,updated_at desc);
alter table public.business_lots enable row level security;
revoke all on public.business_lots from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('lot_links','{"label":"Truy xuất lô linh kiện","feature":"traceability","mode":"document","fields":{"assembly_lot_id":{"label":"Lô thành phẩm","type":"ref","ref":"lots","required":true},"component_lot_id":{"label":"Lô nguyên liệu / linh kiện","type":"ref","ref":"lots","required":true},"quantity":{"label":"Số lượng sử dụng","type":"number","min":0.0001,"required":true}}}'::jsonb);

create table public.business_lot_links(
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
 assembly_lot_id uuid not null,
 component_lot_id uuid not null,
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000)
);

create unique index business_lot_links_code_idx on public.business_lot_links(tenant_id,lower(code));
create index business_lot_links_tenant_date_idx on public.business_lot_links(tenant_id,updated_at desc);
alter table public.business_lot_links enable row level security;
revoke all on public.business_lot_links from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('stock_moves','{"label":"Nhập / xuất kho","feature":"inventory","mode":"document","fields":{"item_id":{"label":"Vật tư / thành phẩm","type":"ref","ref":"items","required":true},"warehouse_id":{"label":"Kho","type":"ref","ref":"warehouses","required":true},"lot_id":{"label":"Lô hàng","type":"ref","ref":"lots"},"direction":{"label":"Loại chứng từ","type":"enum","values":{"in":"Nhập kho","out":"Xuất kho"},"default":"in"},"quantity":{"label":"Số lượng","type":"number","min":0.0001,"required":true},"unit_cost":{"label":"Đơn giá","type":"number","min":0,"default":0},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"sales_order_id":{"label":"Đơn bán hàng","type":"ref","ref":"sales_orders"}}}'::jsonb);

create table public.business_stock_moves(
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
 item_id uuid not null,
 warehouse_id uuid not null,
 lot_id uuid,
 direction text not null default 'in' check(direction in ('in','out')),
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_cost numeric(20,4) not null default 0 check(unit_cost>=0 and unit_cost<=1000000000000000),
 document_date date not null,
 sales_order_id uuid,
 source_kind text,
 source_id uuid,
 reversed_by uuid
);

create unique index business_stock_moves_code_idx on public.business_stock_moves(tenant_id,lower(code));
create index business_stock_moves_tenant_date_idx on public.business_stock_moves(tenant_id,updated_at desc);
alter table public.business_stock_moves enable row level security;
revoke all on public.business_stock_moves from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('material_issues','{"label":"Cấp nguyên liệu","feature":"production","mode":"document","fields":{"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","required":true},"item_id":{"label":"Nguyên liệu","type":"ref","ref":"items","required":true},"warehouse_id":{"label":"Kho","type":"ref","ref":"warehouses","required":true},"lot_id":{"label":"Lô nguyên liệu","type":"ref","ref":"lots"},"quantity":{"label":"Số lượng thực tế","type":"number","min":0.0001,"required":true},"unit_cost":{"label":"Đơn giá thực tế","type":"number","min":0,"default":0},"document_date":{"label":"Ngày cấp","type":"date","required":true}}}'::jsonb);

create table public.business_material_issues(
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
 item_id uuid not null,
 warehouse_id uuid not null,
 lot_id uuid,
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_cost numeric(20,4) not null default 0 check(unit_cost>=0 and unit_cost<=1000000000000000),
 document_date date not null
);

create unique index business_material_issues_code_idx on public.business_material_issues(tenant_id,lower(code));
create index business_material_issues_tenant_date_idx on public.business_material_issues(tenant_id,updated_at desc);
alter table public.business_material_issues enable row level security;
revoke all on public.business_material_issues from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('production_reports','{"label":"Sản lượng & hao hụt","feature":"production","mode":"document","fields":{"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","required":true},"operation_id":{"label":"Công đoạn","type":"ref","ref":"operations"},"good_quantity":{"label":"Sản lượng đạt","type":"number","min":0,"default":0},"scrap_quantity":{"label":"Phế phẩm","type":"number","min":0,"default":0},"labor_hours":{"label":"Giờ nhân công","type":"number","min":0,"default":0},"machine_hours":{"label":"Giờ máy","type":"number","min":0,"default":0},"labor_cost":{"label":"Chi phí nhân công","type":"number","min":0,"default":0,"computed":true},"machine_cost":{"label":"Chi phí máy","type":"number","min":0,"default":0,"computed":true},"report_date":{"label":"Ngày báo cáo","type":"date","required":true}}}'::jsonb);

create table public.business_production_reports(
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
 operation_id uuid,
 good_quantity numeric(20,4) not null default 0 check(good_quantity>=0 and good_quantity<=1000000000000000),
 scrap_quantity numeric(20,4) not null default 0 check(scrap_quantity>=0 and scrap_quantity<=1000000000000000),
 labor_hours numeric(20,4) not null default 0 check(labor_hours>=0 and labor_hours<=1000000000000000),
 machine_hours numeric(20,4) not null default 0 check(machine_hours>=0 and machine_hours<=1000000000000000),
 labor_cost numeric(20,4) not null default 0 check(labor_cost>=0 and labor_cost<=1000000000000000),
 machine_cost numeric(20,4) not null default 0 check(machine_cost>=0 and machine_cost<=1000000000000000),
 report_date date not null
);

create unique index business_production_reports_code_idx on public.business_production_reports(tenant_id,lower(code));
create index business_production_reports_tenant_date_idx on public.business_production_reports(tenant_id,updated_at desc);
alter table public.business_production_reports enable row level security;
revoke all on public.business_production_reports from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('quality_checks','{"label":"Kiểm tra chất lượng","feature":"quality","mode":"document","fields":{"lot_id":{"label":"Lô hàng","type":"ref","ref":"lots","required":true},"checked_quantity":{"label":"Số lượng kiểm tra","type":"number","min":0.0001,"required":true},"rejected_quantity":{"label":"Số lượng không đạt","type":"number","min":0,"default":0},"result":{"label":"Kết luận","type":"enum","values":{"passed":"Đạt","failed":"Không đạt"},"default":"passed"},"checked_on":{"label":"Ngày kiểm tra","type":"date","required":true}}}'::jsonb);

create table public.business_quality_checks(
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
 lot_id uuid not null,
 checked_quantity numeric(20,4) not null check(checked_quantity>=0.0001 and checked_quantity<=1000000000000000),
 rejected_quantity numeric(20,4) not null default 0 check(rejected_quantity>=0 and rejected_quantity<=1000000000000000),
 result text not null default 'passed' check(result in ('passed','failed')),
 checked_on date not null,
 check(rejected_quantity<=checked_quantity),
 check(result<>'passed' or rejected_quantity=0)
);

create unique index business_quality_checks_code_idx on public.business_quality_checks(tenant_id,lower(code));
create index business_quality_checks_tenant_date_idx on public.business_quality_checks(tenant_id,updated_at desc);
alter table public.business_quality_checks enable row level security;
revoke all on public.business_quality_checks from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('sales_orders','{"label":"Đơn bán hàng","feature":"sales","mode":"order","fields":{"partner_id":{"label":"Khách hàng","type":"ref","ref":"partners","required":true},"order_date":{"label":"Ngày đặt hàng","type":"date","required":true},"due_date":{"label":"Hạn thanh toán","type":"date","required":true}}}'::jsonb);

create table public.business_sales_orders(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','released','completed','cancelled')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 partner_id uuid not null,
 order_date date not null,
 due_date date not null
);

create unique index business_sales_orders_code_idx on public.business_sales_orders(tenant_id,lower(code));
create index business_sales_orders_tenant_date_idx on public.business_sales_orders(tenant_id,updated_at desc);
alter table public.business_sales_orders enable row level security;
revoke all on public.business_sales_orders from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('sales_lines','{"label":"Chi tiết đơn bán","feature":"sales","mode":"master","fields":{"sales_order_id":{"label":"Đơn bán hàng","type":"ref","ref":"sales_orders","required":true},"item_id":{"label":"Hàng hóa","type":"ref","ref":"items","required":true},"quantity":{"label":"Số lượng","type":"number","min":0.0001,"required":true},"unit_price":{"label":"Đơn giá","type":"number","min":0,"default":0}}}'::jsonb);

create table public.business_sales_lines(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 sales_order_id uuid not null,
 item_id uuid not null,
 quantity numeric(20,4) not null check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_price numeric(20,4) not null default 0 check(unit_price>=0 and unit_price<=1000000000000000)
);

create unique index business_sales_lines_code_idx on public.business_sales_lines(tenant_id,lower(code));
create index business_sales_lines_tenant_date_idx on public.business_sales_lines(tenant_id,updated_at desc);
alter table public.business_sales_lines enable row level security;
revoke all on public.business_sales_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('receivables','{"label":"Công nợ khách hàng","feature":"sales","mode":"document","fields":{"partner_id":{"label":"Khách hàng","type":"ref","ref":"partners","required":true},"sales_order_id":{"label":"Đơn bán hàng","type":"ref","ref":"sales_orders"},"amount":{"label":"Số tiền phải thu","type":"number","min":0.0001,"required":true},"paid_amount":{"label":"Đã thu","type":"number","min":0,"default":0,"computed":true},"due_date":{"label":"Hạn thanh toán","type":"date","required":true}}}'::jsonb);

create table public.business_receivables(
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
 partner_id uuid not null,
 sales_order_id uuid,
 amount numeric(20,4) not null check(amount>=0.0001 and amount<=1000000000000000),
 paid_amount numeric(20,4) not null default 0 check(paid_amount>=0 and paid_amount<=1000000000000000),
 due_date date not null,
 check(paid_amount<=amount)
);

create unique index business_receivables_code_idx on public.business_receivables(tenant_id,lower(code));
create index business_receivables_tenant_date_idx on public.business_receivables(tenant_id,updated_at desc);
alter table public.business_receivables enable row level security;
revoke all on public.business_receivables from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('payments','{"label":"Thu tiền","feature":"sales","mode":"document","fields":{"receivable_id":{"label":"Khoản phải thu","type":"ref","ref":"receivables","required":true},"amount":{"label":"Số tiền thu","type":"number","min":0.0001,"required":true},"paid_on":{"label":"Ngày thu","type":"date","required":true}}}'::jsonb);

create table public.business_payments(
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
 receivable_id uuid not null,
 amount numeric(20,4) not null check(amount>=0.0001 and amount<=1000000000000000),
 paid_on date not null
);

create unique index business_payments_code_idx on public.business_payments(tenant_id,lower(code));
create index business_payments_tenant_date_idx on public.business_payments(tenant_id,updated_at desc);
alter table public.business_payments enable row level security;
revoke all on public.business_payments from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('projects','{"label":"Công trình & ngân sách","feature":"projects","mode":"master","fields":{"budget":{"label":"Ngân sách","type":"number","min":0,"default":0},"starts_on":{"label":"Ngày bắt đầu","type":"date","required":true},"ends_on":{"label":"Ngày kết thúc dự kiến","type":"date"}}}'::jsonb);

create table public.business_projects(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 budget numeric(20,4) not null default 0 check(budget>=0 and budget<=1000000000000000),
 starts_on date not null,
 ends_on date,
 check(ends_on is null or ends_on>=starts_on)
);

create unique index business_projects_code_idx on public.business_projects(tenant_id,lower(code));
create index business_projects_tenant_date_idx on public.business_projects(tenant_id,updated_at desc);
alter table public.business_projects enable row level security;
revoke all on public.business_projects from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('project_costs','{"label":"Chi phí công trình","feature":"projects","mode":"document","fields":{"project_id":{"label":"Công trình","type":"ref","ref":"projects","required":true},"category":{"label":"Khoản mục","type":"enum","values":{"material":"Vật tư","labor":"Nhân công","subcontract":"Thầu phụ","overhead":"Chi phí chung"},"default":"material"},"amount":{"label":"Chi phí","type":"number","min":0.0001,"required":true},"occurred_on":{"label":"Ngày phát sinh","type":"date","required":true}}}'::jsonb);

create table public.business_project_costs(
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
 category text not null default 'material' check(category in ('material','labor','subcontract','overhead')),
 amount numeric(20,4) not null check(amount>=0.0001 and amount<=1000000000000000),
 occurred_on date not null
);

create unique index business_project_costs_code_idx on public.business_project_costs(tenant_id,lower(code));
create index business_project_costs_tenant_date_idx on public.business_project_costs(tenant_id,updated_at desc);
alter table public.business_project_costs enable row level security;
revoke all on public.business_project_costs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('project_updates','{"label":"Tiến độ công trình","feature":"projects","mode":"document","fields":{"project_id":{"label":"Công trình","type":"ref","ref":"projects","required":true},"completion_percent":{"label":"Hoàn thành (%)","type":"number","min":0,"max":100,"required":true},"reported_on":{"label":"Ngày báo cáo","type":"date","required":true}}}'::jsonb);

create table public.business_project_updates(
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
 completion_percent numeric(20,4) not null check(completion_percent>=0 and completion_percent<=100),
 reported_on date not null
);

create unique index business_project_updates_code_idx on public.business_project_updates(tenant_id,lower(code));
create index business_project_updates_tenant_date_idx on public.business_project_updates(tenant_id,updated_at desc);
alter table public.business_project_updates enable row level security;
revoke all on public.business_project_updates from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('interactions','{"label":"Chăm sóc khách hàng","feature":"crm","mode":"master","fields":{"partner_id":{"label":"Khách hàng","type":"ref","ref":"partners","required":true},"channel":{"label":"Hình thức","type":"enum","values":{"call":"Cuộc gọi","email":"Email","meeting":"Cuộc hẹn","note":"Ghi chú"},"default":"note"},"next_contact_on":{"label":"Hẹn tiếp theo","type":"date"}}}'::jsonb);

create table public.business_interactions(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 partner_id uuid not null,
 channel text not null default 'note' check(channel in ('call','email','meeting','note')),
 next_contact_on date
);

create unique index business_interactions_code_idx on public.business_interactions(tenant_id,lower(code));
create index business_interactions_tenant_date_idx on public.business_interactions(tenant_id,updated_at desc);
alter table public.business_interactions enable row level security;
revoke all on public.business_interactions from public,anon,authenticated,service_role;

alter table public.business_molds add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_boms add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_bom_lines add foreign key(tenant_id,bom_id) references public.business_boms(tenant_id,id);

alter table public.business_bom_lines add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_work_orders add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_work_orders add foreign key(tenant_id,bom_id) references public.business_boms(tenant_id,id);

alter table public.business_work_orders add foreign key(tenant_id,mold_id) references public.business_molds(tenant_id,id);

alter table public.business_operations add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_operations add foreign key(tenant_id,work_center_id) references public.business_work_centers(tenant_id,id);

alter table public.business_lots add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_lot_links add foreign key(tenant_id,assembly_lot_id) references public.business_lots(tenant_id,id);

alter table public.business_lot_links add foreign key(tenant_id,component_lot_id) references public.business_lots(tenant_id,id);

alter table public.business_stock_moves add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_stock_moves add foreign key(tenant_id,warehouse_id) references public.business_warehouses(tenant_id,id);

alter table public.business_stock_moves add foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id);

alter table public.business_stock_moves add foreign key(tenant_id,sales_order_id) references public.business_sales_orders(tenant_id,id);

alter table public.business_material_issues add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_material_issues add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_material_issues add foreign key(tenant_id,warehouse_id) references public.business_warehouses(tenant_id,id);

alter table public.business_material_issues add foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id);

alter table public.business_production_reports add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_production_reports add foreign key(tenant_id,operation_id) references public.business_operations(tenant_id,id);

alter table public.business_quality_checks add foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id);

alter table public.business_sales_orders add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_sales_lines add foreign key(tenant_id,sales_order_id) references public.business_sales_orders(tenant_id,id);

alter table public.business_sales_lines add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_receivables add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_receivables add foreign key(tenant_id,sales_order_id) references public.business_sales_orders(tenant_id,id);

alter table public.business_payments add foreign key(tenant_id,receivable_id) references public.business_receivables(tenant_id,id);

alter table public.business_project_costs add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_project_updates add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_interactions add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

create unique index business_stock_source_idx on public.business_stock_moves(tenant_id,source_kind,source_id) where source_id is not null;
create unique index business_operation_sequence_idx on public.business_operations(tenant_id,work_order_id,sequence);
create unique index business_receivable_order_idx on public.business_receivables(tenant_id,sales_order_id) where sales_order_id is not null;
alter table public.business_stock_moves add foreign key(tenant_id,reversed_by) references public.business_stock_moves(tenant_id,id);
