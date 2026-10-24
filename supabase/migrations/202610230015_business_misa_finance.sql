-- MISA references inform domain invariants, not an imported implementation. Tenant-scoped finance, purchasing and people.

alter table public.business_tenants add column is_demo boolean not null default false;
alter table public.business_payments add column cash_account_id uuid;
alter table public.business_receivables add column gl_account_id uuid;

update public.business_entity_definitions set definition='{"label":"Thu tiền","feature":"sales","mode":"document","fields":{"receivable_id":{"label":"Khoản phải thu","type":"ref","ref":"receivables","required":true},"amount":{"label":"Số tiền thu","type":"number","min":0.0001,"required":true},"paid_on":{"label":"Ngày thu","type":"date","required":true},"cash_account_id":{"label":"Tài khoản nhận tiền","type":"ref","ref":"gl_accounts","requiresFeature":"accounting"}}}'::jsonb where kind='payments';

insert into public.business_entity_definitions(kind,definition) values('gl_accounts','{"label":"Hệ thống tài khoản","feature":"accounting","mode":"master","fields":{"nature":{"label":"Tính chất","type":"enum","values":{"debit":"Dư Nợ","credit":"Dư Có","both":"Lưỡng tính"},"default":"debit"},"account_type":{"label":"Loại tài khoản","type":"enum","values":{"posting":"Chi tiết","group":"Tổng hợp"},"default":"posting"}}}'::jsonb);

create table public.business_gl_accounts(
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
 nature text not null default 'debit' check(nature in ('debit','credit','both')),
 account_type text not null default 'posting' check(account_type in ('posting','group'))
);
create unique index business_gl_accounts_code_idx on public.business_gl_accounts(tenant_id,lower(code));
create index business_gl_accounts_tenant_date_idx on public.business_gl_accounts(tenant_id,updated_at desc);
alter table public.business_gl_accounts enable row level security;
revoke all on public.business_gl_accounts from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('accounting_periods','{"label":"Kỳ kế toán","feature":"accounting","mode":"order","fields":{"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true}}}'::jsonb);

create table public.business_accounting_periods(
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
 starts_on date not null,
 ends_on date not null,
 check(ends_on>=starts_on)
);
create unique index business_accounting_periods_code_idx on public.business_accounting_periods(tenant_id,lower(code));
create index business_accounting_periods_tenant_date_idx on public.business_accounting_periods(tenant_id,updated_at desc);
alter table public.business_accounting_periods enable row level security;
revoke all on public.business_accounting_periods from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('journal_entries','{"label":"Chứng từ kế toán","feature":"accounting","mode":"document","fields":{"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"period_id":{"label":"Kỳ kế toán","type":"ref","ref":"accounting_periods","required":true},"document_type":{"label":"Phần hành","type":"enum","values":{"general":"Tổng hợp","cash":"Tiền mặt","bank":"Ngân hàng","purchase":"Mua hàng","sales":"Bán hàng","inventory":"Kho","payroll":"Tiền lương","costing":"Giá thành","opening":"Số dư đầu kỳ"},"default":"general"}}}'::jsonb);

create table public.business_journal_entries(
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
 document_date date not null,
 posting_date date not null,
 period_id uuid not null,
 document_type text not null default 'general' check(document_type in ('general','cash','bank','purchase','sales','inventory','payroll','costing','opening')),
 reviewed_by uuid,
 foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_kind text,
 source_id uuid,
 reversed_by uuid
);
create unique index business_journal_entries_code_idx on public.business_journal_entries(tenant_id,lower(code));
create index business_journal_entries_tenant_date_idx on public.business_journal_entries(tenant_id,updated_at desc);
alter table public.business_journal_entries enable row level security;
revoke all on public.business_journal_entries from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('journal_lines','{"label":"Chi tiết định khoản","feature":"accounting","mode":"master","fields":{"journal_id":{"label":"Chứng từ","type":"ref","ref":"journal_entries","required":true},"account_id":{"label":"Tài khoản","type":"ref","ref":"gl_accounts","required":true},"debit":{"label":"Phát sinh Nợ","type":"number","default":0,"min":0},"credit":{"label":"Phát sinh Có","type":"number","default":0,"min":0},"partner_id":{"label":"Đối tượng","type":"ref","ref":"partners"},"project_id":{"label":"Công trình","type":"ref","ref":"projects"}}}'::jsonb);

create table public.business_journal_lines(
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
 journal_id uuid not null,
 account_id uuid not null,
 debit numeric(20,4) not null default 0 check(debit>=0 and debit<=1000000000000000),
 credit numeric(20,4) not null default 0 check(credit>=0 and credit<=1000000000000000),
 partner_id uuid,
 project_id uuid,
 check((debit>0 and credit=0) or (credit>0 and debit=0))
);
create unique index business_journal_lines_code_idx on public.business_journal_lines(tenant_id,lower(code));
create index business_journal_lines_tenant_date_idx on public.business_journal_lines(tenant_id,updated_at desc);
alter table public.business_journal_lines enable row level security;
revoke all on public.business_journal_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('cash_vouchers','{"label":"Phiếu thu / chi","feature":"accounting","mode":"document","fields":{"direction":{"label":"Loại phiếu","type":"enum","values":{"in":"Thu tiền","out":"Chi tiền"},"default":"in"},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"cash_account_id":{"label":"Tài khoản tiền","type":"ref","ref":"gl_accounts","required":true},"counter_account_id":{"label":"Tài khoản đối ứng","type":"ref","ref":"gl_accounts","required":true},"amount":{"label":"Số tiền","type":"number","default":0,"min":0.0001},"partner_id":{"label":"Người nộp / nhận","type":"ref","ref":"partners"},"project_id":{"label":"Công trình","type":"ref","ref":"projects"}}}'::jsonb);

create table public.business_cash_vouchers(
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
 direction text not null default 'in' check(direction in ('in','out')),
 document_date date not null,
 posting_date date not null,
 cash_account_id uuid not null,
 counter_account_id uuid not null,
 amount numeric(20,4) not null default 0 check(amount>=0.0001 and amount<=1000000000000000),
 partner_id uuid,
 project_id uuid,
 reviewed_by uuid,
 foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_kind text,
 source_id uuid,
 reversed_by uuid
);
create unique index business_cash_vouchers_code_idx on public.business_cash_vouchers(tenant_id,lower(code));
create index business_cash_vouchers_tenant_date_idx on public.business_cash_vouchers(tenant_id,updated_at desc);
alter table public.business_cash_vouchers enable row level security;
revoke all on public.business_cash_vouchers from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('purchase_orders','{"label":"Đơn mua hàng","feature":"purchasing","mode":"order","fields":{"partner_id":{"label":"Nhà cung cấp","type":"ref","ref":"partners","required":true},"order_date":{"label":"Ngày đặt mua","type":"date","required":true},"expected_on":{"label":"Ngày dự kiến nhận","type":"date","required":true}}}'::jsonb);

create table public.business_purchase_orders(
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
 expected_on date not null
);
create unique index business_purchase_orders_code_idx on public.business_purchase_orders(tenant_id,lower(code));
create index business_purchase_orders_tenant_date_idx on public.business_purchase_orders(tenant_id,updated_at desc);
alter table public.business_purchase_orders enable row level security;
revoke all on public.business_purchase_orders from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('purchase_lines','{"label":"Chi tiết đơn mua","feature":"purchasing","mode":"master","fields":{"purchase_order_id":{"label":"Đơn mua","type":"ref","ref":"purchase_orders","required":true},"item_id":{"label":"Vật tư / hàng hóa","type":"ref","ref":"items","required":true},"quantity":{"label":"Số lượng","type":"number","default":0,"min":0.0001},"unit_price":{"label":"Đơn giá","type":"number","default":0,"min":0}}}'::jsonb);

create table public.business_purchase_lines(
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
 purchase_order_id uuid not null,
 item_id uuid not null,
 quantity numeric(20,4) not null default 0 check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_price numeric(20,4) not null default 0 check(unit_price>=0 and unit_price<=1000000000000000)
);
create unique index business_purchase_lines_code_idx on public.business_purchase_lines(tenant_id,lower(code));
create index business_purchase_lines_tenant_date_idx on public.business_purchase_lines(tenant_id,updated_at desc);
alter table public.business_purchase_lines enable row level security;
revoke all on public.business_purchase_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('purchase_receipts','{"label":"Nhận hàng theo đơn mua","feature":"purchasing","mode":"document","fields":{"purchase_order_id":{"label":"Đơn mua","type":"ref","ref":"purchase_orders","required":true},"item_id":{"label":"Vật tư / hàng hóa","type":"ref","ref":"items","required":true},"warehouse_id":{"label":"Kho nhận","type":"ref","ref":"warehouses","required":true},"lot_id":{"label":"Lô hàng","type":"ref","ref":"lots"},"quantity":{"label":"Số lượng nhận","type":"number","default":0,"min":0.0001},"unit_cost":{"label":"Đơn giá nhập","type":"number","default":0,"min":0},"document_date":{"label":"Ngày nhận","type":"date","required":true}}}'::jsonb);

create table public.business_purchase_receipts(
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
 purchase_order_id uuid not null,
 item_id uuid not null,
 warehouse_id uuid not null,
 lot_id uuid,
 quantity numeric(20,4) not null default 0 check(quantity>=0.0001 and quantity<=1000000000000000),
 unit_cost numeric(20,4) not null default 0 check(unit_cost>=0 and unit_cost<=1000000000000000),
 document_date date not null
);
create unique index business_purchase_receipts_code_idx on public.business_purchase_receipts(tenant_id,lower(code));
create index business_purchase_receipts_tenant_date_idx on public.business_purchase_receipts(tenant_id,updated_at desc);
alter table public.business_purchase_receipts enable row level security;
revoke all on public.business_purchase_receipts from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('vendor_invoices','{"label":"Hóa đơn mua hàng","feature":"accounting","mode":"document","fields":{"partner_id":{"label":"Đối tượng","type":"ref","ref":"partners","required":true},"invoice_number":{"label":"Số hóa đơn","type":"text","required":true,"max":80},"document_date":{"label":"Ngày hóa đơn","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"due_date":{"label":"Hạn thanh toán","type":"date","required":true},"base_amount":{"label":"Tiền trước thuế","type":"number","default":0,"min":0.0001},"tax_amount":{"label":"Tiền thuế","type":"number","default":0,"min":0},"tax_account_id":{"label":"Tài khoản thuế","type":"ref","ref":"gl_accounts"},"purchase_order_id":{"label":"Đơn mua","type":"ref","ref":"purchase_orders"},"expense_account_id":{"label":"Tài khoản hàng / chi phí","type":"ref","ref":"gl_accounts","required":true},"payable_account_id":{"label":"Tài khoản phải trả","type":"ref","ref":"gl_accounts","required":true}}}'::jsonb);

create table public.business_vendor_invoices(
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
 invoice_number text not null check(char_length(invoice_number)<=80),
 document_date date not null,
 posting_date date not null,
 due_date date not null,
 base_amount numeric(20,4) not null default 0 check(base_amount>=0.0001 and base_amount<=1000000000000000),
 tax_amount numeric(20,4) not null default 0 check(tax_amount>=0 and tax_amount<=1000000000000000),
 tax_account_id uuid,
 purchase_order_id uuid,
 expense_account_id uuid not null,
 payable_account_id uuid not null,
 reviewed_by uuid,
 foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_kind text,
 source_id uuid,
 reversed_by uuid
);
create unique index business_vendor_invoices_code_idx on public.business_vendor_invoices(tenant_id,lower(code));
create index business_vendor_invoices_tenant_date_idx on public.business_vendor_invoices(tenant_id,updated_at desc);
alter table public.business_vendor_invoices enable row level security;
revoke all on public.business_vendor_invoices from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('sales_invoices','{"label":"Hóa đơn bán hàng","feature":"accounting","mode":"document","fields":{"partner_id":{"label":"Đối tượng","type":"ref","ref":"partners","required":true},"invoice_number":{"label":"Số hóa đơn","type":"text","required":true,"max":80},"document_date":{"label":"Ngày hóa đơn","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"due_date":{"label":"Hạn thanh toán","type":"date","required":true},"base_amount":{"label":"Tiền trước thuế","type":"number","default":0,"min":0.0001},"tax_amount":{"label":"Tiền thuế","type":"number","default":0,"min":0},"tax_account_id":{"label":"Tài khoản thuế","type":"ref","ref":"gl_accounts"},"sales_order_id":{"label":"Đơn bán","type":"ref","ref":"sales_orders","required":true},"revenue_account_id":{"label":"Tài khoản doanh thu","type":"ref","ref":"gl_accounts","required":true},"receivable_account_id":{"label":"Tài khoản phải thu","type":"ref","ref":"gl_accounts","required":true}}}'::jsonb);

create table public.business_sales_invoices(
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
 invoice_number text not null check(char_length(invoice_number)<=80),
 document_date date not null,
 posting_date date not null,
 due_date date not null,
 base_amount numeric(20,4) not null default 0 check(base_amount>=0.0001 and base_amount<=1000000000000000),
 tax_amount numeric(20,4) not null default 0 check(tax_amount>=0 and tax_amount<=1000000000000000),
 tax_account_id uuid,
 sales_order_id uuid not null,
 revenue_account_id uuid not null,
 receivable_account_id uuid not null,
 reviewed_by uuid,
 foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_kind text,
 source_id uuid,
 reversed_by uuid
);
create unique index business_sales_invoices_code_idx on public.business_sales_invoices(tenant_id,lower(code));
create index business_sales_invoices_tenant_date_idx on public.business_sales_invoices(tenant_id,updated_at desc);
alter table public.business_sales_invoices enable row level security;
revoke all on public.business_sales_invoices from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('payables','{"label":"Công nợ nhà cung cấp","feature":"accounting","mode":"document","fields":{"partner_id":{"label":"Nhà cung cấp","type":"ref","ref":"partners","required":true},"vendor_invoice_id":{"label":"Hóa đơn mua","type":"ref","ref":"vendor_invoices","required":true},"amount":{"label":"Phải trả","type":"number","default":0,"min":0.0001},"paid_amount":{"label":"Đã thanh toán","type":"number","default":0,"min":0,"computed":true},"due_date":{"label":"Hạn thanh toán","type":"date","required":true}}}'::jsonb);

create table public.business_payables(
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
 vendor_invoice_id uuid not null,
 amount numeric(20,4) not null default 0 check(amount>=0.0001 and amount<=1000000000000000),
 paid_amount numeric(20,4) not null default 0 check(paid_amount>=0 and paid_amount<=1000000000000000),
 due_date date not null,
 check(paid_amount<=amount)
);
create unique index business_payables_code_idx on public.business_payables(tenant_id,lower(code));
create index business_payables_tenant_date_idx on public.business_payables(tenant_id,updated_at desc);
alter table public.business_payables enable row level security;
revoke all on public.business_payables from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('supplier_payments','{"label":"Thanh toán nhà cung cấp","feature":"accounting","mode":"document","fields":{"payable_id":{"label":"Khoản phải trả","type":"ref","ref":"payables","required":true},"cash_account_id":{"label":"Tài khoản tiền","type":"ref","ref":"gl_accounts","required":true},"amount":{"label":"Số tiền thanh toán","type":"number","default":0,"min":0.0001},"paid_on":{"label":"Ngày thanh toán","type":"date","required":true}}}'::jsonb);

create table public.business_supplier_payments(
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
 payable_id uuid not null,
 cash_account_id uuid not null,
 amount numeric(20,4) not null default 0 check(amount>=0.0001 and amount<=1000000000000000),
 paid_on date not null,
 reviewed_by uuid,
 foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_kind text,
 source_id uuid,
 reversed_by uuid
);
create unique index business_supplier_payments_code_idx on public.business_supplier_payments(tenant_id,lower(code));
create index business_supplier_payments_tenant_date_idx on public.business_supplier_payments(tenant_id,updated_at desc);
alter table public.business_supplier_payments enable row level security;
revoke all on public.business_supplier_payments from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('staff','{"label":"Nhân sự","feature":"people","mode":"master","fields":{"department":{"label":"Bộ phận","type":"text","required":true,"max":180},"position":{"label":"Chức danh","type":"text","required":true,"max":180},"joined_on":{"label":"Ngày vào làm","type":"date","required":true},"base_salary":{"label":"Lương thỏa thuận","type":"number","default":0,"min":0},"phone":{"label":"Điện thoại","type":"text","required":false,"max":30}}}'::jsonb);

create table public.business_staff(
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
 department text not null check(char_length(department)<=180),
 position text not null check(char_length(position)<=180),
 joined_on date not null,
 base_salary numeric(20,4) not null default 0 check(base_salary>=0 and base_salary<=1000000000000000),
 phone text check(char_length(phone)<=30)
);
create unique index business_staff_code_idx on public.business_staff(tenant_id,lower(code));
create index business_staff_tenant_date_idx on public.business_staff(tenant_id,updated_at desc);
alter table public.business_staff enable row level security;
revoke all on public.business_staff from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('timecards','{"label":"Bảng công","feature":"people","mode":"document","fields":{"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"work_date":{"label":"Ngày làm việc","type":"date","required":true},"worked_hours":{"label":"Giờ làm","type":"number","default":0,"min":0,"max":24},"overtime_hours":{"label":"Giờ tăng ca","type":"number","default":0,"min":0,"max":16},"project_id":{"label":"Công trình","type":"ref","ref":"projects"}}}'::jsonb);

create table public.business_timecards(
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
 staff_id uuid not null,
 work_date date not null,
 worked_hours numeric(20,4) not null default 0 check(worked_hours>=0 and worked_hours<=24),
 overtime_hours numeric(20,4) not null default 0 check(overtime_hours>=0 and overtime_hours<=16),
 project_id uuid
);
create unique index business_timecards_code_idx on public.business_timecards(tenant_id,lower(code));
create index business_timecards_tenant_date_idx on public.business_timecards(tenant_id,updated_at desc);
alter table public.business_timecards enable row level security;
revoke all on public.business_timecards from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('salary_runs','{"label":"Bảng lương","feature":"accounting","mode":"document","fields":{"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"posting_date":{"label":"Ngày hạch toán","type":"date","required":true},"standard_days":{"label":"Ngày công chuẩn","type":"number","default":26,"min":0.0001},"expense_account_id":{"label":"Tài khoản chi phí lương","type":"ref","ref":"gl_accounts","required":true},"payable_account_id":{"label":"Tài khoản phải trả người lao động","type":"ref","ref":"gl_accounts","required":true},"deduction_account_id":{"label":"Tài khoản các khoản khấu trừ","type":"ref","ref":"gl_accounts","required":true}}}'::jsonb);

create table public.business_salary_runs(
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
 starts_on date not null,
 ends_on date not null,
 posting_date date not null,
 standard_days numeric(20,4) not null default 26 check(standard_days>=0.0001 and standard_days<=1000000000000000),
 expense_account_id uuid not null,
 payable_account_id uuid not null,
 deduction_account_id uuid not null,
 reviewed_by uuid,
 foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_kind text,
 source_id uuid,
 reversed_by uuid,
 check(ends_on>=starts_on)
);
create unique index business_salary_runs_code_idx on public.business_salary_runs(tenant_id,lower(code));
create index business_salary_runs_tenant_date_idx on public.business_salary_runs(tenant_id,updated_at desc);
alter table public.business_salary_runs enable row level security;
revoke all on public.business_salary_runs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('salary_lines','{"label":"Chi tiết bảng lương","feature":"accounting","mode":"master","fields":{"salary_run_id":{"label":"Bảng lương","type":"ref","ref":"salary_runs","required":true},"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"base_salary":{"label":"Lương thỏa thuận","type":"number","default":0,"min":0},"worked_days":{"label":"Ngày công","type":"number","default":0,"min":0},"allowances":{"label":"Phụ cấp","type":"number","default":0,"min":0},"deductions":{"label":"Khấu trừ","type":"number","default":0,"min":0},"gross_amount":{"label":"Tổng thu nhập","type":"number","default":0,"min":0,"computed":true},"net_amount":{"label":"Thực lĩnh","type":"number","default":0,"min":0,"computed":true}}}'::jsonb);

create table public.business_salary_lines(
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
 salary_run_id uuid not null,
 staff_id uuid not null,
 base_salary numeric(20,4) not null default 0 check(base_salary>=0 and base_salary<=1000000000000000),
 worked_days numeric(20,4) not null default 0 check(worked_days>=0 and worked_days<=1000000000000000),
 allowances numeric(20,4) not null default 0 check(allowances>=0 and allowances<=1000000000000000),
 deductions numeric(20,4) not null default 0 check(deductions>=0 and deductions<=1000000000000000),
 gross_amount numeric(20,4) not null default 0 check(gross_amount>=0 and gross_amount<=1000000000000000),
 net_amount numeric(20,4) not null default 0 check(net_amount>=0 and net_amount<=1000000000000000)
);
create unique index business_salary_lines_code_idx on public.business_salary_lines(tenant_id,lower(code));
create index business_salary_lines_tenant_date_idx on public.business_salary_lines(tenant_id,updated_at desc);
alter table public.business_salary_lines enable row level security;
revoke all on public.business_salary_lines from public,anon,authenticated,service_role;

alter table public.business_journal_entries add foreign key(tenant_id,period_id) references public.business_accounting_periods(tenant_id,id);

alter table public.business_journal_lines add foreign key(tenant_id,journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_journal_lines add foreign key(tenant_id,account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_journal_lines add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_journal_lines add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_cash_vouchers add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_cash_vouchers add foreign key(tenant_id,counter_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_cash_vouchers add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_cash_vouchers add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_purchase_orders add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_purchase_lines add foreign key(tenant_id,purchase_order_id) references public.business_purchase_orders(tenant_id,id);

alter table public.business_purchase_lines add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_purchase_receipts add foreign key(tenant_id,purchase_order_id) references public.business_purchase_orders(tenant_id,id);

alter table public.business_purchase_receipts add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_purchase_receipts add foreign key(tenant_id,warehouse_id) references public.business_warehouses(tenant_id,id);

alter table public.business_purchase_receipts add foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id);

alter table public.business_vendor_invoices add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_vendor_invoices add foreign key(tenant_id,tax_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_vendor_invoices add foreign key(tenant_id,purchase_order_id) references public.business_purchase_orders(tenant_id,id);

alter table public.business_vendor_invoices add foreign key(tenant_id,expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_vendor_invoices add foreign key(tenant_id,payable_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_sales_invoices add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_sales_invoices add foreign key(tenant_id,tax_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_sales_invoices add foreign key(tenant_id,sales_order_id) references public.business_sales_orders(tenant_id,id);

alter table public.business_sales_invoices add foreign key(tenant_id,revenue_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_sales_invoices add foreign key(tenant_id,receivable_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_payables add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_payables add foreign key(tenant_id,vendor_invoice_id) references public.business_vendor_invoices(tenant_id,id);

alter table public.business_supplier_payments add foreign key(tenant_id,payable_id) references public.business_payables(tenant_id,id);

alter table public.business_supplier_payments add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_timecards add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_timecards add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_salary_runs add foreign key(tenant_id,expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_salary_runs add foreign key(tenant_id,payable_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_salary_runs add foreign key(tenant_id,deduction_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_salary_lines add foreign key(tenant_id,salary_run_id) references public.business_salary_runs(tenant_id,id);

alter table public.business_salary_lines add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_payments add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);
alter table public.business_receivables add foreign key(tenant_id,gl_account_id) references public.business_gl_accounts(tenant_id,id);

create unique index business_journal_source_idx on public.business_journal_entries(tenant_id,source_kind,source_id) where source_id is not null;
create unique index business_vendor_invoice_number_idx on public.business_vendor_invoices(tenant_id,partner_id,lower(invoice_number));
create unique index business_sales_invoice_order_idx on public.business_sales_invoices(tenant_id,sales_order_id) where status<>'cancelled';
create unique index business_payable_invoice_idx on public.business_payables(tenant_id,vendor_invoice_id);
create index business_journal_lines_header_idx on public.business_journal_lines(tenant_id,journal_id);
create index business_journal_lines_account_idx on public.business_journal_lines(tenant_id,account_id);
create index business_purchase_receipts_order_idx on public.business_purchase_receipts(tenant_id,purchase_order_id,item_id) where status='posted';
create unique index business_salary_line_employee_idx on public.business_salary_lines(tenant_id,salary_run_id,staff_id);
create unique index business_timecards_day_idx on public.business_timecards(tenant_id,staff_id,work_date) where status<>'cancelled';

update public.business_industry_packs set features='["inventory","production","mes","quality","crm","purchasing","accounting","people","sales"]'::jsonb where key='metalworking';

update public.business_industry_packs set features='["inventory","production","mes","quality","crm","purchasing","accounting","people","sales"]'::jsonb where key='plastics_packaging';

update public.business_industry_packs set features='["inventory","production","mes","traceability","quality","crm","purchasing","accounting","people","sales"]'::jsonb where key='electronics';

update public.business_industry_packs set features='["inventory","production","traceability","quality","crm","purchasing","accounting","people","sales"]'::jsonb where key='food_beverage';

update public.business_industry_packs set features='["inventory","sales","crm","purchasing","accounting","people"]'::jsonb where key='trading';

update public.business_industry_packs set features='["inventory","projects","crm","purchasing","accounting","people","sales"]'::jsonb where key='construction';

alter table public.business_payments add column reviewed_by uuid;
alter table public.business_payments add foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id);

alter table public.business_salary_runs add column standard_hours numeric(20,4) not null default 8 check(standard_hours>0 and standard_hours<=24);
update public.business_entity_definitions set definition='{"label":"Bảng lương","feature":"accounting","mode":"document","fields":{"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"posting_date":{"label":"Ngày hạch toán","type":"date","required":true},"standard_days":{"label":"Ngày công chuẩn","type":"number","default":26,"min":0.0001},"expense_account_id":{"label":"Tài khoản chi phí lương","type":"ref","ref":"gl_accounts","required":true},"payable_account_id":{"label":"Tài khoản phải trả người lao động","type":"ref","ref":"gl_accounts","required":true},"deduction_account_id":{"label":"Tài khoản các khoản khấu trừ","type":"ref","ref":"gl_accounts","required":true},"standard_hours":{"label":"Giờ công chuẩn / ngày","type":"number","default":8,"min":0.0001,"max":24}}}'::jsonb where kind='salary_runs';
