-- Typed tenant entities for MISA finance requirements. Generated once before deployment.

insert into public.business_entity_definitions(kind,definition) values('assets','{"label":"TSCĐ, CCDC & chi phí trả trước","feature":"assets","mode":"master","fields":{"asset_type":{"label":"Loại","type":"enum","values":{"fixed":"Tài sản cố định","tool":"Công cụ dụng cụ","prepaid":"Chi phí trả trước"},"default":"fixed"},"serial":{"label":"Số sê-ri","type":"text","max":100},"original_cost":{"label":"Nguyên giá","type":"number","min":1,"default":0},"residual_value":{"label":"Giá trị thu hồi","type":"number","min":0,"default":0},"opening_depreciation":{"label":"Hao mòn đầu kỳ","type":"number","min":0,"default":0},"acquired_on":{"label":"Ngày ghi tăng","type":"date","required":true},"starts_on":{"label":"Bắt đầu phân bổ","type":"date","required":true},"useful_months":{"label":"Số tháng sử dụng","type":"number","min":1,"default":12,"integer":true,"max":1200},"asset_account_id":{"label":"Tài khoản nguyên giá","type":"ref","ref":"gl_accounts","required":true},"accumulated_account_id":{"label":"Tài khoản hao mòn / trả trước","type":"ref","ref":"gl_accounts","required":true},"expense_account_id":{"label":"Tài khoản chi phí","type":"ref","ref":"gl_accounts","required":true},"recognition_journal_id":{"label":"Chứng từ hình thành","type":"ref","ref":"journal_entries","required":true},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"custodian_id":{"label":"Người giữ","type":"ref","ref":"staff","requiresFeature":"people"},"department":{"label":"Bộ phận","type":"text","max":100},"service_state":{"label":"Tình trạng","type":"enum","values":{"ready":"Sẵn sàng","in_use":"Đang sử dụng","maintenance":"Bảo dưỡng","disposed":"Đã ghi giảm"},"default":"ready","computed":true}},"misaDomain":true}'::jsonb);
create table public.business_assets(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 asset_type text not null default 'fixed' check(asset_type in ('fixed','tool','prepaid')),
 serial text check(char_length(serial)<=100),
 original_cost numeric(24,4) not null default '0' check(original_cost between 1 and 1000000000000000),
 residual_value numeric(24,4) not null default '0' check(residual_value between 0 and 1000000000000000),
 opening_depreciation numeric(24,4) not null default '0' check(opening_depreciation between 0 and 1000000000000000),
 acquired_on date not null,
 starts_on date not null,
 useful_months integer not null default '12' check(useful_months between 1 and 1200 and useful_months=trunc(useful_months)),
 asset_account_id uuid not null,
 accumulated_account_id uuid not null,
 expense_account_id uuid not null,
 recognition_journal_id uuid not null,
 project_id uuid,
 custodian_id uuid,
 department text check(char_length(department)<=100),
 service_state text not null default 'ready' check(service_state in ('ready','in_use','maintenance','disposed'))
);
create unique index business_assets_code_idx on public.business_assets(tenant_id,lower(code));
create index business_assets_tenant_date_idx on public.business_assets(tenant_id,updated_at desc,id);
alter table public.business_assets enable row level security;revoke all on public.business_assets from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('asset_events','{"label":"Ghi tăng, điều chuyển & bảo dưỡng","feature":"assets","mode":"document","fields":{"asset_id":{"label":"Tài sản / CCDC","type":"ref","ref":"assets","required":true},"event_type":{"label":"Nghiệp vụ","type":"enum","values":{"register":"Ghi tăng","assign":"Bàn giao","return":"Thu hồi","maintenance_start":"Bắt đầu bảo dưỡng","maintenance_end":"Hoàn tất bảo dưỡng","dispose":"Ghi giảm"},"default":"register"},"document_date":{"label":"Ngày hiệu lực","type":"date","required":true},"posting_date":{"label":"Ngày hạch toán","type":"date","required":true},"staff_id":{"label":"Người nhận","type":"ref","ref":"staff","requiresFeature":"people"},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"location":{"label":"Vị trí","type":"text","max":200},"expense_account_id":{"label":"Tài khoản giá trị còn lại","type":"ref","ref":"gl_accounts"},"cash_account_id":{"label":"Tài khoản thu thanh lý","type":"ref","ref":"gl_accounts"},"income_account_id":{"label":"Tài khoản thu nhập","type":"ref","ref":"gl_accounts"},"proceeds":{"label":"Tiền thanh lý","type":"number","min":0,"default":0},"maintenance_cost":{"label":"Chi phí bảo dưỡng","type":"number","min":0,"default":0},"counter_account_id":{"label":"Tài khoản thanh toán bảo dưỡng","type":"ref","ref":"gl_accounts"}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_asset_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 asset_id uuid not null,
 event_type text not null default 'register' check(event_type in ('register','assign','return','maintenance_start','maintenance_end','dispose')),
 document_date date not null,
 posting_date date not null,
 staff_id uuid,
 project_id uuid,
 location text check(char_length(location)<=200),
 expense_account_id uuid,
 cash_account_id uuid,
 income_account_id uuid,
 proceeds numeric(24,4) not null default '0' check(proceeds between 0 and 1000000000000000),
 maintenance_cost numeric(24,4) not null default '0' check(maintenance_cost between 0 and 1000000000000000),
 counter_account_id uuid
);
create unique index business_asset_events_code_idx on public.business_asset_events(tenant_id,lower(code));
create index business_asset_events_tenant_date_idx on public.business_asset_events(tenant_id,updated_at desc,id);
alter table public.business_asset_events enable row level security;revoke all on public.business_asset_events from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('asset_charge_runs','{"label":"Tính khấu hao & phân bổ","feature":"assets","mode":"document","fields":{"posting_date":{"label":"Tính đến ngày","type":"date","required":true},"asset_type":{"label":"Phạm vi","type":"enum","values":{"all":"Tất cả","fixed":"Tài sản cố định","tool":"Công cụ dụng cụ","prepaid":"Chi phí trả trước"},"default":"all"},"total_amount":{"label":"Tổng phân bổ","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_asset_charge_runs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 posting_date date not null,
 asset_type text not null default 'all' check(asset_type in ('all','fixed','tool','prepaid')),
 total_amount numeric(24,4) not null default '0' check(total_amount between 0 and 1000000000000000)
);
create unique index business_asset_charge_runs_code_idx on public.business_asset_charge_runs(tenant_id,lower(code));
create index business_asset_charge_runs_tenant_date_idx on public.business_asset_charge_runs(tenant_id,updated_at desc,id);
alter table public.business_asset_charge_runs enable row level security;revoke all on public.business_asset_charge_runs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('asset_charge_lines','{"label":"Chi tiết khấu hao & phân bổ","feature":"assets","mode":"master","fields":{"run_id":{"label":"Bảng tính","type":"ref","ref":"asset_charge_runs","required":true},"asset_id":{"label":"Tài sản / CCDC","type":"ref","ref":"assets","required":true},"amount":{"label":"Chi phí phân bổ","type":"number","min":0,"default":0,"computed":true},"accumulated":{"label":"Lũy kế sau phân bổ","type":"number","min":0,"default":0,"computed":true},"remaining":{"label":"Giá trị còn lại","type":"number","min":0,"default":0,"computed":true},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"}},"generatedOnly":true,"misaDomain":true}'::jsonb);
create table public.business_asset_charge_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 run_id uuid not null,
 asset_id uuid not null,
 amount numeric(24,4) not null default '0' check(amount between 0 and 1000000000000000),
 accumulated numeric(24,4) not null default '0' check(accumulated between 0 and 1000000000000000),
 remaining numeric(24,4) not null default '0' check(remaining between 0 and 1000000000000000),
 project_id uuid
);
create unique index business_asset_charge_lines_code_idx on public.business_asset_charge_lines(tenant_id,lower(code));
create index business_asset_charge_lines_tenant_date_idx on public.business_asset_charge_lines(tenant_id,updated_at desc,id);
alter table public.business_asset_charge_lines enable row level security;revoke all on public.business_asset_charge_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('bank_statement_lines','{"label":"Sao kê ngân hàng","feature":"accounting","mode":"master","fields":{"bank_account_id":{"label":"Tài khoản ngân hàng","type":"ref","ref":"gl_accounts","required":true},"transaction_ref":{"label":"Mã giao dịch ngân hàng","type":"text","max":120,"required":true},"value_date":{"label":"Ngày giá trị","type":"date","required":true},"direction":{"label":"Biến động","type":"enum","values":{"in":"Tiền vào","out":"Tiền ra"},"default":"in"},"amount":{"label":"Số tiền","type":"number","min":0.0001,"default":0},"counterparty":{"label":"Đối tác giao dịch","type":"text","max":200},"file_hash":{"label":"SHA-256 nguồn nhập","type":"text","max":64}},"misaDomain":true}'::jsonb);
create table public.business_bank_statement_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 bank_account_id uuid not null,
 transaction_ref text not null check(char_length(transaction_ref)<=120 and char_length(btrim(transaction_ref))>0),
 value_date date not null,
 direction text not null default 'in' check(direction in ('in','out')),
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000),
 counterparty text check(char_length(counterparty)<=200),
 file_hash text check(char_length(file_hash)<=64)
);
create unique index business_bank_statement_lines_code_idx on public.business_bank_statement_lines(tenant_id,lower(code));
create index business_bank_statement_lines_tenant_date_idx on public.business_bank_statement_lines(tenant_id,updated_at desc,id);
alter table public.business_bank_statement_lines enable row level security;revoke all on public.business_bank_statement_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('bank_matches','{"label":"Đối chiếu sao kê","feature":"accounting","mode":"document","fields":{"statement_line_id":{"label":"Giao dịch sao kê","type":"ref","ref":"bank_statement_lines","required":true},"journal_line_id":{"label":"Dòng sổ tiền gửi","type":"ref","ref":"journal_lines","required":true},"amount":{"label":"Số tiền khớp","type":"number","min":0.0001,"default":0},"document_date":{"label":"Ngày đối chiếu","type":"date","required":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_bank_matches(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 statement_line_id uuid not null,
 journal_line_id uuid not null,
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000),
 document_date date not null
);
create unique index business_bank_matches_code_idx on public.business_bank_matches(tenant_id,lower(code));
create index business_bank_matches_tenant_date_idx on public.business_bank_matches(tenant_id,updated_at desc,id);
alter table public.business_bank_matches enable row level security;revoke all on public.business_bank_matches from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('advances','{"label":"Đề nghị tạm ứng","feature":"accounting","mode":"document","fields":{"staff_id":{"label":"Người tạm ứng","type":"ref","ref":"staff","required":true,"requiresFeature":"people"},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"amount":{"label":"Tiền tạm ứng","type":"number","min":0.0001,"default":0},"due_date":{"label":"Hạn hoàn ứng","type":"date","required":true},"document_date":{"label":"Ngày đề nghị","type":"date","required":true},"posting_date":{"label":"Ngày chi","type":"date","required":true},"cash_account_id":{"label":"Tài khoản tiền","type":"ref","ref":"gl_accounts","required":true},"advance_account_id":{"label":"Tài khoản tạm ứng","type":"ref","ref":"gl_accounts","required":true}},"misaDomain":true,"requiresApproval":true,"requiresFeatures":["people"]}'::jsonb);
create table public.business_advances(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 staff_id uuid not null,
 project_id uuid,
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000),
 due_date date not null,
 document_date date not null,
 posting_date date not null,
 cash_account_id uuid not null,
 advance_account_id uuid not null
);
create unique index business_advances_code_idx on public.business_advances(tenant_id,lower(code));
create index business_advances_tenant_date_idx on public.business_advances(tenant_id,updated_at desc,id);
alter table public.business_advances enable row level security;revoke all on public.business_advances from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('advance_settlements','{"label":"Quyết toán & hoàn ứng","feature":"accounting","mode":"document","fields":{"advance_id":{"label":"Khoản tạm ứng","type":"ref","ref":"advances","required":true},"document_date":{"label":"Ngày quyết toán","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"expense_amount":{"label":"Chi phí được duyệt","type":"number","min":0,"default":0},"returned_amount":{"label":"Tiền hoàn quỹ","type":"number","min":0,"default":0},"expense_account_id":{"label":"Tài khoản chi phí","type":"ref","ref":"gl_accounts","required":true},"cash_account_id":{"label":"Tài khoản nhận hoàn ứng","type":"ref","ref":"gl_accounts","required":true},"evidence":{"label":"Hồ sơ quyết toán","type":"text","max":500,"required":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_advance_settlements(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 advance_id uuid not null,
 document_date date not null,
 posting_date date not null,
 expense_amount numeric(24,4) not null default '0' check(expense_amount between 0 and 1000000000000000),
 returned_amount numeric(24,4) not null default '0' check(returned_amount between 0 and 1000000000000000),
 expense_account_id uuid not null,
 cash_account_id uuid not null,
 evidence text not null check(char_length(evidence)<=500 and char_length(btrim(evidence))>0)
);
create unique index business_advance_settlements_code_idx on public.business_advance_settlements(tenant_id,lower(code));
create index business_advance_settlements_tenant_date_idx on public.business_advance_settlements(tenant_id,updated_at desc,id);
alter table public.business_advance_settlements enable row level security;revoke all on public.business_advance_settlements from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('loans','{"label":"Khế ước vay","feature":"accounting","mode":"document","fields":{"partner_id":{"label":"Bên cho vay","type":"ref","ref":"partners","required":true},"principal_limit":{"label":"Hạn mức giải ngân","type":"number","min":0.0001,"default":0},"starts_on":{"label":"Ngày hiệu lực","type":"date","required":true},"ends_on":{"label":"Ngày đáo hạn","type":"date","required":true},"annual_rate":{"label":"Lãi suất năm (%)","type":"number","min":0,"default":0,"max":100},"day_basis":{"label":"Cơ sở ngày","type":"enum","values":{"actual365":"Thực tế / 365","actual360":"Thực tế / 360"},"default":"actual365"},"loan_account_id":{"label":"Tài khoản vay","type":"ref","ref":"gl_accounts","required":true},"interest_account_id":{"label":"Tài khoản lãi vay","type":"ref","ref":"gl_accounts","required":true},"cash_account_id":{"label":"Tài khoản tiền","type":"ref","ref":"gl_accounts","required":true},"document_date":{"label":"Ngày khế ước","type":"date","required":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_loans(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 partner_id uuid not null,
 principal_limit numeric(24,4) not null default '0' check(principal_limit between 0.0001 and 1000000000000000),
 starts_on date not null,
 ends_on date not null,
 annual_rate numeric(24,4) not null default '0' check(annual_rate between 0 and 100),
 day_basis text not null default 'actual365' check(day_basis in ('actual365','actual360')),
 loan_account_id uuid not null,
 interest_account_id uuid not null,
 cash_account_id uuid not null,
 document_date date not null
);
create unique index business_loans_code_idx on public.business_loans(tenant_id,lower(code));
create index business_loans_tenant_date_idx on public.business_loans(tenant_id,updated_at desc,id);
alter table public.business_loans enable row level security;revoke all on public.business_loans from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('loan_movements','{"label":"Giải ngân & trả nợ","feature":"accounting","mode":"document","fields":{"loan_id":{"label":"Khế ước","type":"ref","ref":"loans","required":true},"movement_type":{"label":"Nghiệp vụ","type":"enum","values":{"draw":"Giải ngân","repay":"Trả gốc / lãi"},"default":"draw"},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"posting_date":{"label":"Ngày hạch toán","type":"date","required":true},"principal":{"label":"Tiền gốc","type":"number","min":0,"default":0},"interest_from":{"label":"Tính lãi từ","type":"date"},"interest_to":{"label":"Tính lãi đến","type":"date"},"interest":{"label":"Tiền lãi","type":"number","min":0,"default":0,"computed":true},"fee":{"label":"Phí khoản vay","type":"number","min":0,"default":0},"fee_account_id":{"label":"Tài khoản phí","type":"ref","ref":"gl_accounts"}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_loan_movements(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 loan_id uuid not null,
 movement_type text not null default 'draw' check(movement_type in ('draw','repay')),
 document_date date not null,
 posting_date date not null,
 principal numeric(24,4) not null default '0' check(principal between 0 and 1000000000000000),
 interest_from date,
 interest_to date,
 interest numeric(24,4) not null default '0' check(interest between 0 and 1000000000000000),
 fee numeric(24,4) not null default '0' check(fee between 0 and 1000000000000000),
 fee_account_id uuid
);
create unique index business_loan_movements_code_idx on public.business_loan_movements(tenant_id,lower(code));
create index business_loan_movements_tenant_date_idx on public.business_loan_movements(tenant_id,updated_at desc,id);
alter table public.business_loan_movements enable row level security;revoke all on public.business_loan_movements from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('loan_installments','{"label":"Lịch đáo hạn","feature":"accounting","mode":"master","fields":{"loan_id":{"label":"Khế ước","type":"ref","ref":"loans","required":true},"due_date":{"label":"Ngày đến hạn","type":"date","required":true},"principal":{"label":"Gốc dự kiến","type":"number","min":0,"default":0},"interest":{"label":"Lãi dự kiến","type":"number","min":0,"default":0}},"misaDomain":true}'::jsonb);
create table public.business_loan_installments(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 loan_id uuid not null,
 due_date date not null,
 principal numeric(24,4) not null default '0' check(principal between 0 and 1000000000000000),
 interest numeric(24,4) not null default '0' check(interest between 0 and 1000000000000000)
);
create unique index business_loan_installments_code_idx on public.business_loan_installments(tenant_id,lower(code));
create index business_loan_installments_tenant_date_idx on public.business_loan_installments(tenant_id,updated_at desc,id);
alter table public.business_loan_installments enable row level security;revoke all on public.business_loan_installments from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('costing_runs','{"label":"Tập hợp & kết chuyển giá thành","feature":"costing","mode":"document","fields":{"target_type":{"label":"Đối tượng","type":"enum","values":{"production":"Lệnh sản xuất","project":"Công trình"},"default":"production"},"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","requiresFeature":"production"},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"posting_date":{"label":"Ngày kết chuyển","type":"date","required":true},"inventory_account_id":{"label":"Tài khoản thành phẩm","type":"ref","ref":"gl_accounts","required":true},"wip_account_id":{"label":"Tài khoản dở dang","type":"ref","ref":"gl_accounts","required":true},"labor_account_id":{"label":"Tài khoản nhân công đối ứng","type":"ref","ref":"gl_accounts","required":true},"overhead_account_id":{"label":"Tài khoản chi phí chung đối ứng","type":"ref","ref":"gl_accounts","required":true},"cogs_account_id":{"label":"Tài khoản giá vốn","type":"ref","ref":"gl_accounts","required":true},"completion_percent":{"label":"Tỷ lệ chi phí hoàn thành (%)","type":"number","min":0,"default":0,"max":100},"total_amount":{"label":"Chi phí tập hợp","type":"number","min":0,"default":0,"computed":true},"completed_amount":{"label":"Giá trị kết chuyển","type":"number","min":0,"default":0,"computed":true},"material_account_id":{"label":"Tài khoản nguyên vật liệu","type":"ref","ref":"gl_accounts","required":true},"wip_equivalent_quantity":{"label":"Sản lượng tương đương dở dang được duyệt","type":"number","min":0,"default":0},"finished_quantity":{"label":"Sản lượng được tính giá lần này","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_costing_runs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 target_type text not null default 'production' check(target_type in ('production','project')),
 work_order_id uuid,
 project_id uuid,
 starts_on date not null,
 ends_on date not null,
 posting_date date not null,
 inventory_account_id uuid not null,
 wip_account_id uuid not null,
 labor_account_id uuid not null,
 overhead_account_id uuid not null,
 cogs_account_id uuid not null,
 completion_percent numeric(24,4) not null default '0' check(completion_percent between 0 and 100),
 total_amount numeric(24,4) not null default '0' check(total_amount between 0 and 1000000000000000),
 completed_amount numeric(24,4) not null default '0' check(completed_amount between 0 and 1000000000000000),
 material_account_id uuid not null,
 wip_equivalent_quantity numeric(24,4) not null default '0' check(wip_equivalent_quantity between 0 and 1000000000000000),
 finished_quantity numeric(24,4) not null default '0' check(finished_quantity between 0 and 1000000000000000)
);
create unique index business_costing_runs_code_idx on public.business_costing_runs(tenant_id,lower(code));
create index business_costing_runs_tenant_date_idx on public.business_costing_runs(tenant_id,updated_at desc,id);
alter table public.business_costing_runs enable row level security;revoke all on public.business_costing_runs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('costing_lines','{"label":"Nguồn chi phí giá thành","feature":"costing","mode":"master","fields":{"run_id":{"label":"Kỳ tính giá thành","type":"ref","ref":"costing_runs","required":true},"source_kind":{"label":"Loại nguồn","type":"text","max":50,"required":true},"source_id":{"label":"Nguồn chứng từ","type":"text","max":50,"required":true},"category":{"label":"Khoản mục","type":"enum","values":{"material":"Nguyên vật liệu","labor":"Nhân công","machine":"Máy","overhead":"Chi phí chung","depreciation":"Khấu hao / phân bổ"},"default":"material"},"amount":{"label":"Chi phí nguồn","type":"number","min":0,"default":0,"computed":true}},"generatedOnly":true,"misaDomain":true}'::jsonb);
create table public.business_costing_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 run_id uuid not null,
 source_kind text not null check(char_length(source_kind)<=50 and char_length(btrim(source_kind))>0),
 source_id text not null check(char_length(source_id)<=50 and char_length(btrim(source_id))>0),
 category text not null default 'material' check(category in ('material','labor','machine','overhead','depreciation')),
 amount numeric(24,4) not null default '0' check(amount between 0 and 1000000000000000)
);
create unique index business_costing_lines_code_idx on public.business_costing_lines(tenant_id,lower(code));
create index business_costing_lines_tenant_date_idx on public.business_costing_lines(tenant_id,updated_at desc,id);
alter table public.business_costing_lines enable row level security;revoke all on public.business_costing_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('overhead_pools','{"label":"Chi phí chung cần phân bổ","feature":"costing","mode":"document","fields":{"source_journal_id":{"label":"Chứng từ chi phí gốc","type":"ref","ref":"journal_entries","required":true},"source_account_id":{"label":"Tài khoản nguồn chi phí","type":"ref","ref":"gl_accounts","required":true},"amount":{"label":"Chi phí chung","type":"number","min":0.0001,"default":0},"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"document_date":{"label":"Ngày tập hợp","type":"date","required":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_overhead_pools(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 source_journal_id uuid not null,
 source_account_id uuid not null,
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000),
 starts_on date not null,
 ends_on date not null,
 document_date date not null
);
create unique index business_overhead_pools_code_idx on public.business_overhead_pools(tenant_id,lower(code));
create index business_overhead_pools_tenant_date_idx on public.business_overhead_pools(tenant_id,updated_at desc,id);
alter table public.business_overhead_pools enable row level security;revoke all on public.business_overhead_pools from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('overhead_allocations','{"label":"Phân bổ chi phí chung","feature":"costing","mode":"master","fields":{"pool_id":{"label":"Chi phí chung","type":"ref","ref":"overhead_pools","required":true},"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","requiresFeature":"production"},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"basis":{"label":"Tiêu thức phân bổ","type":"number","min":0.0001,"default":0},"amount":{"label":"Chi phí được phân bổ","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true}'::jsonb);
create table public.business_overhead_allocations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 pool_id uuid not null,
 work_order_id uuid,
 project_id uuid,
 basis numeric(24,4) not null default '0' check(basis between 0.0001 and 1000000000000000),
 amount numeric(24,4) not null default '0' check(amount between 0 and 1000000000000000)
);
create unique index business_overhead_allocations_code_idx on public.business_overhead_allocations(tenant_id,lower(code));
create index business_overhead_allocations_tenant_date_idx on public.business_overhead_allocations(tenant_id,updated_at desc,id);
alter table public.business_overhead_allocations enable row level security;revoke all on public.business_overhead_allocations from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('invoice_adjustments','{"label":"Điều chỉnh giảm hóa đơn","feature":"accounting","mode":"document","fields":{"side":{"label":"Loại hóa đơn","type":"enum","values":{"sale":"Hóa đơn bán","purchase":"Hóa đơn mua"},"default":"sale"},"sales_invoice_id":{"label":"Hóa đơn bán gốc","type":"ref","ref":"sales_invoices"},"vendor_invoice_id":{"label":"Hóa đơn mua gốc","type":"ref","ref":"vendor_invoices"},"document_date":{"label":"Ngày điều chỉnh","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"base_amount":{"label":"Giảm trước thuế","type":"number","min":0.0001,"default":0},"tax_amount":{"label":"Giảm thuế","type":"number","min":0,"default":0},"unpaid_offset":{"label":"Giảm công nợ chưa thanh toán","type":"number","min":0,"default":0,"computed":true},"refund_credit":{"label":"Tiền cần hoàn trả","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_invoice_adjustments(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 side text not null default 'sale' check(side in ('sale','purchase')),
 sales_invoice_id uuid,
 vendor_invoice_id uuid,
 document_date date not null,
 posting_date date not null,
 base_amount numeric(24,4) not null default '0' check(base_amount between 0.0001 and 1000000000000000),
 tax_amount numeric(24,4) not null default '0' check(tax_amount between 0 and 1000000000000000),
 unpaid_offset numeric(24,4) not null default '0' check(unpaid_offset between 0 and 1000000000000000),
 refund_credit numeric(24,4) not null default '0' check(refund_credit between 0 and 1000000000000000)
);
create unique index business_invoice_adjustments_code_idx on public.business_invoice_adjustments(tenant_id,lower(code));
create index business_invoice_adjustments_tenant_date_idx on public.business_invoice_adjustments(tenant_id,updated_at desc,id);
alter table public.business_invoice_adjustments enable row level security;revoke all on public.business_invoice_adjustments from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('invoice_refunds','{"label":"Hoàn tiền điều chỉnh hóa đơn","feature":"accounting","mode":"document","fields":{"adjustment_id":{"label":"Chứng từ điều chỉnh","type":"ref","ref":"invoice_adjustments","required":true},"document_date":{"label":"Ngày hoàn tiền","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"cash_account_id":{"label":"Tài khoản tiền","type":"ref","ref":"gl_accounts","required":true},"amount":{"label":"Tiền hoàn trả","type":"number","min":0.0001,"default":0}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_invoice_refunds(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 adjustment_id uuid not null,
 document_date date not null,
 posting_date date not null,
 cash_account_id uuid not null,
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000)
);
create unique index business_invoice_refunds_code_idx on public.business_invoice_refunds(tenant_id,lower(code));
create index business_invoice_refunds_tenant_date_idx on public.business_invoice_refunds(tenant_id,updated_at desc,id);
alter table public.business_invoice_refunds enable row level security;revoke all on public.business_invoice_refunds from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('closing_runs','{"label":"Kết chuyển cuối kỳ","feature":"accounting","mode":"document","fields":{"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"posting_date":{"label":"Ngày kết chuyển","type":"date","required":true},"result_account_id":{"label":"Tài khoản xác định kết quả","type":"ref","ref":"gl_accounts","required":true},"retained_account_id":{"label":"Tài khoản lợi nhuận chưa phân phối","type":"ref","ref":"gl_accounts","required":true},"total_amount":{"label":"Tổng kết chuyển","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_closing_runs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 starts_on date not null,
 ends_on date not null,
 posting_date date not null,
 result_account_id uuid not null,
 retained_account_id uuid not null,
 total_amount numeric(24,4) not null default '0' check(total_amount between 0 and 1000000000000000)
);
create unique index business_closing_runs_code_idx on public.business_closing_runs(tenant_id,lower(code));
create index business_closing_runs_tenant_date_idx on public.business_closing_runs(tenant_id,updated_at desc,id);
alter table public.business_closing_runs enable row level security;revoke all on public.business_closing_runs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('financial_report_lines','{"label":"Chỉ tiêu báo cáo tài chính","feature":"accounting","mode":"master","fields":{"report":{"label":"Báo cáo","type":"enum","values":{"balance":"Bảng cân đối kế toán","income":"Kết quả kinh doanh","cash":"Lưu chuyển tiền tệ trực tiếp"},"default":"balance"},"line_number":{"label":"Thứ tự","type":"number","min":1,"default":1,"integer":true,"max":1000000},"account_prefix":{"label":"Đầu tài khoản","type":"text","max":20,"required":true},"calculation":{"label":"Cách lấy số","type":"enum","values":{"debit_balance":"Số dư Nợ","credit_balance":"Số dư Có","debit_turnover":"Phát sinh Nợ","credit_turnover":"Phát sinh Có","net_debit":"Nợ trừ Có","net_credit":"Có trừ Nợ"},"default":"debit_balance"},"sign":{"label":"Dấu","type":"enum","values":{"plus":"Cộng","minus":"Trừ"},"default":"plus"},"effective_from":{"label":"Hiệu lực từ","type":"date","required":true},"effective_to":{"label":"Hiệu lực đến","type":"date"}},"misaDomain":true}'::jsonb);
create table public.business_financial_report_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 report text not null default 'balance' check(report in ('balance','income','cash')),
 line_number integer not null default '1' check(line_number between 1 and 1000000 and line_number=trunc(line_number)),
 account_prefix text not null check(char_length(account_prefix)<=20 and char_length(btrim(account_prefix))>0),
 calculation text not null default 'debit_balance' check(calculation in ('debit_balance','credit_balance','debit_turnover','credit_turnover','net_debit','net_credit')),
 sign text not null default 'plus' check(sign in ('plus','minus')),
 effective_from date not null,
 effective_to date
);
create unique index business_financial_report_lines_code_idx on public.business_financial_report_lines(tenant_id,lower(code));
create index business_financial_report_lines_tenant_date_idx on public.business_financial_report_lines(tenant_id,updated_at desc,id);
alter table public.business_financial_report_lines enable row level security;revoke all on public.business_financial_report_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('tax_policies','{"label":"Chính sách thuế theo hiệu lực","feature":"accounting","mode":"master","fields":{"tax_type":{"label":"Loại thuế","type":"enum","values":{"vat":"GTGT","cit":"TNDN","pit":"TNCN","insurance":"Bảo hiểm"},"default":"vat"},"starts_on":{"label":"Hiệu lực từ","type":"date","required":true},"ends_on":{"label":"Hiệu lực đến","type":"date"},"rate":{"label":"Tỷ lệ (%)","type":"number","min":0,"default":0,"max":100},"employee_rate":{"label":"Tỷ lệ người lao động (%)","type":"number","min":0,"default":0,"max":100},"employer_rate":{"label":"Tỷ lệ doanh nghiệp (%)","type":"number","min":0,"default":0,"max":100},"deductible_amount":{"label":"Giảm trừ được cấu hình","type":"number","min":0,"default":0},"legal_reference":{"label":"Căn cứ chính sách","type":"text","max":500,"required":true}},"misaDomain":true}'::jsonb);
create table public.business_tax_policies(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 tax_type text not null default 'vat' check(tax_type in ('vat','cit','pit','insurance')),
 starts_on date not null,
 ends_on date,
 rate numeric(24,4) not null default '0' check(rate between 0 and 100),
 employee_rate numeric(24,4) not null default '0' check(employee_rate between 0 and 100),
 employer_rate numeric(24,4) not null default '0' check(employer_rate between 0 and 100),
 deductible_amount numeric(24,4) not null default '0' check(deductible_amount between 0 and 1000000000000000),
 legal_reference text not null check(char_length(legal_reference)<=500 and char_length(btrim(legal_reference))>0)
);
create unique index business_tax_policies_code_idx on public.business_tax_policies(tenant_id,lower(code));
create index business_tax_policies_tenant_date_idx on public.business_tax_policies(tenant_id,updated_at desc,id);
alter table public.business_tax_policies enable row level security;revoke all on public.business_tax_policies from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('tax_filings','{"label":"Hồ sơ thuế & nghĩa vụ","feature":"accounting","mode":"document","fields":{"tax_type":{"label":"Loại hồ sơ","type":"enum","values":{"vat":"GTGT","cit":"TNDN","pit":"TNCN","insurance":"Bảo hiểm"},"default":"vat"},"policy_id":{"label":"Chính sách hiệu lực","type":"ref","ref":"tax_policies","required":true},"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"filing_version":{"label":"Lần lập / bổ sung","type":"number","min":1,"default":1,"integer":true,"max":1000000},"posting_date":{"label":"Ngày lập","type":"date","required":true},"tax_account_id":{"label":"Tài khoản thuế","type":"ref","ref":"gl_accounts","required":true},"expense_account_id":{"label":"Tài khoản chi phí / khấu trừ","type":"ref","ref":"gl_accounts","required":true},"base_amount":{"label":"Cơ sở tính","type":"number","min":-1000000000000000,"default":0,"computed":true},"tax_amount":{"label":"Nghĩa vụ dự kiến","type":"number","min":0,"default":0,"computed":true},"adjustment":{"label":"Điều chỉnh","type":"number","min":-1000000000000000,"default":0},"submission_state":{"label":"Trạng thái nộp","type":"enum","values":{"internal":"Hồ sơ nội bộ","queued":"Chờ gửi","accepted":"Đã tiếp nhận","rejected":"Bị từ chối"},"default":"internal","computed":true},"tax_credit":{"label":"Thuế còn được khấu trừ","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_tax_filings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 tax_type text not null default 'vat' check(tax_type in ('vat','cit','pit','insurance')),
 policy_id uuid not null,
 starts_on date not null,
 ends_on date not null,
 filing_version integer not null default '1' check(filing_version between 1 and 1000000 and filing_version=trunc(filing_version)),
 posting_date date not null,
 tax_account_id uuid not null,
 expense_account_id uuid not null,
 base_amount numeric(24,4) not null default '0' check(base_amount between -1000000000000000 and 1000000000000000),
 tax_amount numeric(24,4) not null default '0' check(tax_amount between 0 and 1000000000000000),
 adjustment numeric(24,4) not null default '0' check(adjustment between -1000000000000000 and 1000000000000000),
 submission_state text not null default 'internal' check(submission_state in ('internal','queued','accepted','rejected')),
 tax_credit numeric(24,4) not null default '0' check(tax_credit between 0 and 1000000000000000)
);
create unique index business_tax_filings_code_idx on public.business_tax_filings(tenant_id,lower(code));
create index business_tax_filings_tenant_date_idx on public.business_tax_filings(tenant_id,updated_at desc,id);
alter table public.business_tax_filings enable row level security;revoke all on public.business_tax_filings from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('tax_filing_lines','{"label":"Chỉ tiêu hồ sơ thuế","feature":"accounting","mode":"master","fields":{"filing_id":{"label":"Hồ sơ thuế","type":"ref","ref":"tax_filings","required":true},"indicator":{"label":"Mã chỉ tiêu","type":"text","max":40,"required":true},"source_kind":{"label":"Nguồn","type":"text","max":50,"required":true},"source_id":{"label":"Chứng từ nguồn","type":"text","max":50},"base_amount":{"label":"Giá trị nguồn","type":"number","min":-1000000000000000,"default":0,"computed":true},"tax_amount":{"label":"Thuế nguồn","type":"number","min":-1000000000000000,"default":0,"computed":true}},"generatedOnly":true,"misaDomain":true}'::jsonb);
create table public.business_tax_filing_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 filing_id uuid not null,
 indicator text not null check(char_length(indicator)<=40 and char_length(btrim(indicator))>0),
 source_kind text not null check(char_length(source_kind)<=50 and char_length(btrim(source_kind))>0),
 source_id text check(char_length(source_id)<=50),
 base_amount numeric(24,4) not null default '0' check(base_amount between -1000000000000000 and 1000000000000000),
 tax_amount numeric(24,4) not null default '0' check(tax_amount between -1000000000000000 and 1000000000000000)
);
create unique index business_tax_filing_lines_code_idx on public.business_tax_filing_lines(tenant_id,lower(code));
create index business_tax_filing_lines_tenant_date_idx on public.business_tax_filing_lines(tenant_id,updated_at desc,id);
alter table public.business_tax_filing_lines enable row level security;revoke all on public.business_tax_filing_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('stock_valuation_runs','{"label":"Tính giá xuất kho & giá vốn","feature":"costing","mode":"document","fields":{"starts_on":{"label":"Từ ngày","type":"date","required":true},"ends_on":{"label":"Đến ngày","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"inventory_account_id":{"label":"Tài khoản hàng tồn kho","type":"ref","ref":"gl_accounts","required":true},"cogs_account_id":{"label":"Tài khoản giá vốn","type":"ref","ref":"gl_accounts","required":true},"total_amount":{"label":"Giá vốn hàng giao","type":"number","min":-1000000000000000,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_stock_valuation_runs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 starts_on date not null,
 ends_on date not null,
 posting_date date not null,
 inventory_account_id uuid not null,
 cogs_account_id uuid not null,
 total_amount numeric(24,4) not null default '0' check(total_amount between -1000000000000000 and 1000000000000000)
);
create unique index business_stock_valuation_runs_code_idx on public.business_stock_valuation_runs(tenant_id,lower(code));
create index business_stock_valuation_runs_tenant_date_idx on public.business_stock_valuation_runs(tenant_id,updated_at desc,id);
alter table public.business_stock_valuation_runs enable row level security;revoke all on public.business_stock_valuation_runs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('stock_valuation_lines','{"label":"Chi tiết tính giá xuất kho","feature":"costing","mode":"master","fields":{"run_id":{"label":"Kỳ tính giá xuất kho","type":"ref","ref":"stock_valuation_runs","required":true},"stock_move_id":{"label":"Phiếu kho","type":"ref","ref":"stock_moves","required":true},"item_id":{"label":"Vật tư / thành phẩm","type":"ref","ref":"items","required":true},"quantity":{"label":"Số lượng","type":"number","min":-1000000000000000,"default":0,"computed":true},"unit_cost":{"label":"Đơn giá bình quân","type":"number","min":0,"default":0,"computed":true},"amount":{"label":"Giá trị","type":"number","min":-1000000000000000,"default":0,"computed":true}},"generatedOnly":true,"misaDomain":true}'::jsonb);
create table public.business_stock_valuation_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 run_id uuid not null,
 stock_move_id uuid not null,
 item_id uuid not null,
 quantity numeric(24,4) not null default '0' check(quantity between -1000000000000000 and 1000000000000000),
 unit_cost numeric(24,4) not null default '0' check(unit_cost between 0 and 1000000000000000),
 amount numeric(24,4) not null default '0' check(amount between -1000000000000000 and 1000000000000000)
);
create unique index business_stock_valuation_lines_code_idx on public.business_stock_valuation_lines(tenant_id,lower(code));
create index business_stock_valuation_lines_tenant_date_idx on public.business_stock_valuation_lines(tenant_id,updated_at desc,id);
alter table public.business_stock_valuation_lines enable row level security;revoke all on public.business_stock_valuation_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('cost_source_links','{"label":"Đối chiếu nguồn chi phí","feature":"costing","mode":"document","fields":{"journal_line_id":{"label":"Dòng chi phí đã ghi sổ","type":"ref","ref":"journal_lines","required":true},"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","requiresFeature":"production"},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"category":{"label":"Khoản mục","type":"enum","values":{"material":"Nguyên vật liệu","labor":"Nhân công","machine":"Máy","overhead":"Chi phí chung","depreciation":"Khấu hao / phân bổ"},"default":"material"},"amount":{"label":"Chi phí phân bổ","type":"number","min":0.0001,"default":0},"source_kind":{"label":"Nguồn vận hành","type":"enum","values":{"journal":"Sổ cái","material_issues":"Cấp vật tư sản xuất","project_materials":"Xuất vật tư công trình","production_reports":"Báo cáo sản xuất","project_costs":"Chi phí công trình"},"default":"journal"},"source_record_id":{"label":"ID chứng từ vận hành","type":"text","max":50},"document_date":{"label":"Ngày đối chiếu","type":"date","required":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_cost_source_links(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 journal_line_id uuid not null,
 work_order_id uuid,
 project_id uuid,
 category text not null default 'material' check(category in ('material','labor','machine','overhead','depreciation')),
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000),
 source_kind text not null default 'journal' check(source_kind in ('journal','material_issues','project_materials','production_reports','project_costs')),
 source_record_id text check(char_length(source_record_id)<=50),
 document_date date not null
);
create unique index business_cost_source_links_code_idx on public.business_cost_source_links(tenant_id,lower(code));
create index business_cost_source_links_tenant_date_idx on public.business_cost_source_links(tenant_id,updated_at desc,id);
alter table public.business_cost_source_links enable row level security;revoke all on public.business_cost_source_links from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('tax_brackets','{"label":"Bậc thuế theo chính sách","feature":"accounting","mode":"master","fields":{"policy_id":{"label":"Chính sách thuế","type":"ref","ref":"tax_policies","required":true},"lower_bound":{"label":"Thu nhập từ","type":"number","min":0,"default":0},"upper_bound":{"label":"Thu nhập đến","type":"number","min":0},"rate":{"label":"Thuế suất (%)","type":"number","min":0,"default":0,"max":100}},"misaDomain":true}'::jsonb);
create table public.business_tax_brackets(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 policy_id uuid not null,
 lower_bound numeric(24,4) not null default '0' check(lower_bound between 0 and 1000000000000000),
 upper_bound numeric(24,4) check(upper_bound between 0 and 1000000000000000),
 rate numeric(24,4) not null default '0' check(rate between 0 and 100)
);
create unique index business_tax_brackets_code_idx on public.business_tax_brackets(tenant_id,lower(code));
create index business_tax_brackets_tenant_date_idx on public.business_tax_brackets(tenant_id,updated_at desc,id);
alter table public.business_tax_brackets enable row level security;revoke all on public.business_tax_brackets from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('staff_tax_profiles','{"label":"Hồ sơ thuế & bảo hiểm nhân sự","feature":"people","mode":"master","fields":{"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"starts_on":{"label":"Hiệu lực từ","type":"date","required":true},"ends_on":{"label":"Hiệu lực đến","type":"date"},"pit_policy_id":{"label":"Chính sách TNCN","type":"ref","ref":"tax_policies","required":true},"insurance_policy_id":{"label":"Chính sách bảo hiểm","type":"ref","ref":"tax_policies","required":true},"dependent_count":{"label":"Số người phụ thuộc","type":"number","min":0,"default":0,"integer":true,"max":50},"dependent_deduction":{"label":"Giảm trừ / người phụ thuộc","type":"number","min":0,"default":0},"insurance_base":{"label":"Mức đóng bảo hiểm","type":"number","min":0,"default":0},"tax_number":{"label":"Mã số thuế","type":"text","max":40},"insurance_number":{"label":"Mã số bảo hiểm","type":"text","max":40}},"requiresFeatures":["accounting"],"misaDomain":true}'::jsonb);
create table public.business_staff_tax_profiles(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 staff_id uuid not null,
 starts_on date not null,
 ends_on date,
 pit_policy_id uuid not null,
 insurance_policy_id uuid not null,
 dependent_count integer not null default '0' check(dependent_count between 0 and 50 and dependent_count=trunc(dependent_count)),
 dependent_deduction numeric(24,4) not null default '0' check(dependent_deduction between 0 and 1000000000000000),
 insurance_base numeric(24,4) not null default '0' check(insurance_base between 0 and 1000000000000000),
 tax_number text check(char_length(tax_number)<=40),
 insurance_number text check(char_length(insurance_number)<=40)
);
create unique index business_staff_tax_profiles_code_idx on public.business_staff_tax_profiles(tenant_id,lower(code));
create index business_staff_tax_profiles_tenant_date_idx on public.business_staff_tax_profiles(tenant_id,updated_at desc,id);
alter table public.business_staff_tax_profiles enable row level security;revoke all on public.business_staff_tax_profiles from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('payroll_tax_runs','{"label":"Tính bảo hiểm & thuế trên lương","feature":"accounting","mode":"document","fields":{"salary_run_id":{"label":"Bảng lương","type":"ref","ref":"salary_runs","required":true},"posting_date":{"label":"Ngày tính","type":"date","required":true},"pit_account_id":{"label":"Tài khoản thuế TNCN","type":"ref","ref":"gl_accounts","required":true},"insurance_account_id":{"label":"Tài khoản bảo hiểm","type":"ref","ref":"gl_accounts","required":true},"employer_expense_account_id":{"label":"Tài khoản chi phí bảo hiểm","type":"ref","ref":"gl_accounts","required":true},"total_amount":{"label":"Tổng thuế & bảo hiểm","type":"number","min":0,"default":0,"computed":true}},"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_payroll_tax_runs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 salary_run_id uuid not null,
 posting_date date not null,
 pit_account_id uuid not null,
 insurance_account_id uuid not null,
 employer_expense_account_id uuid not null,
 total_amount numeric(24,4) not null default '0' check(total_amount between 0 and 1000000000000000)
);
create unique index business_payroll_tax_runs_code_idx on public.business_payroll_tax_runs(tenant_id,lower(code));
create index business_payroll_tax_runs_tenant_date_idx on public.business_payroll_tax_runs(tenant_id,updated_at desc,id);
alter table public.business_payroll_tax_runs enable row level security;revoke all on public.business_payroll_tax_runs from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('payroll_statutory_lines','{"label":"Chi tiết thuế & bảo hiểm lương","feature":"accounting","mode":"master","fields":{"run_id":{"label":"Bảng tính thuế / bảo hiểm","type":"ref","ref":"payroll_tax_runs","required":true},"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"gross_amount":{"label":"Thu nhập","type":"number","min":0,"default":0,"computed":true},"taxable_amount":{"label":"Thu nhập tính thuế","type":"number","min":0,"default":0,"computed":true},"employee_insurance":{"label":"Bảo hiểm người lao động","type":"number","min":0,"default":0,"computed":true},"employer_insurance":{"label":"Bảo hiểm doanh nghiệp","type":"number","min":0,"default":0,"computed":true},"pit":{"label":"Thuế TNCN","type":"number","min":0,"default":0,"computed":true},"manual_deductions":{"label":"Khấu trừ khác","type":"number","min":0,"default":0,"computed":true}},"generatedOnly":true,"misaDomain":true}'::jsonb);
create table public.business_payroll_statutory_lines(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 run_id uuid not null,
 staff_id uuid not null,
 gross_amount numeric(24,4) not null default '0' check(gross_amount between 0 and 1000000000000000),
 taxable_amount numeric(24,4) not null default '0' check(taxable_amount between 0 and 1000000000000000),
 employee_insurance numeric(24,4) not null default '0' check(employee_insurance between 0 and 1000000000000000),
 employer_insurance numeric(24,4) not null default '0' check(employer_insurance between 0 and 1000000000000000),
 pit numeric(24,4) not null default '0' check(pit between 0 and 1000000000000000),
 manual_deductions numeric(24,4) not null default '0' check(manual_deductions between 0 and 1000000000000000)
);
create unique index business_payroll_statutory_lines_code_idx on public.business_payroll_statutory_lines(tenant_id,lower(code));
create index business_payroll_statutory_lines_tenant_date_idx on public.business_payroll_statutory_lines(tenant_id,updated_at desc,id);
alter table public.business_payroll_statutory_lines enable row level security;revoke all on public.business_payroll_statutory_lines from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('cost_receipt_values','{"label":"Giá thành theo lần nhập thành phẩm","feature":"costing","mode":"master","fields":{"run_id":{"label":"Kỳ tính giá thành","type":"ref","ref":"costing_runs","required":true},"receipt_id":{"label":"Phiếu nhập thành phẩm","type":"ref","ref":"production_receipts","required":true},"quantity":{"label":"Sản lượng tính giá","type":"number","min":0,"default":0,"computed":true},"amount":{"label":"Giá thành hoàn thành","type":"number","min":0,"default":0,"computed":true},"unit_cost":{"label":"Giá thành đơn vị","type":"number","min":0,"default":0,"computed":true}},"generatedOnly":true,"misaDomain":true}'::jsonb);
create table public.business_cost_receipt_values(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 run_id uuid not null,
 receipt_id uuid not null,
 quantity numeric(24,4) not null default '0' check(quantity between 0 and 1000000000000000),
 amount numeric(24,4) not null default '0' check(amount between 0 and 1000000000000000),
 unit_cost numeric(24,4) not null default '0' check(unit_cost between 0 and 1000000000000000)
);
create unique index business_cost_receipt_values_code_idx on public.business_cost_receipt_values(tenant_id,lower(code));
create index business_cost_receipt_values_tenant_date_idx on public.business_cost_receipt_values(tenant_id,updated_at desc,id);
alter table public.business_cost_receipt_values enable row level security;revoke all on public.business_cost_receipt_values from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('payroll_cost_allocations','{"label":"Phân bổ lương theo đối tượng giá thành","feature":"costing","mode":"document","fields":{"salary_line_id":{"label":"Chi tiết lương đã ghi sổ","type":"ref","ref":"salary_lines","required":true},"work_order_id":{"label":"Lệnh sản xuất","type":"ref","ref":"work_orders","requiresFeature":"production"},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"allocation_percent":{"label":"Tỷ lệ phân bổ (%)","type":"number","min":0.0001,"default":0,"max":100},"document_date":{"label":"Ngày phân bổ","type":"date","required":true},"amount":{"label":"Chi phí nhân công phân bổ","type":"number","min":0,"default":0,"computed":true}},"requiresFeatures":["people"],"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_payroll_cost_allocations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 salary_line_id uuid not null,
 work_order_id uuid,
 project_id uuid,
 allocation_percent numeric(24,4) not null default '0' check(allocation_percent between 0.0001 and 100),
 document_date date not null,
 amount numeric(24,4) not null default '0' check(amount between 0 and 1000000000000000)
);
create unique index business_payroll_cost_allocations_code_idx on public.business_payroll_cost_allocations(tenant_id,lower(code));
create index business_payroll_cost_allocations_tenant_date_idx on public.business_payroll_cost_allocations(tenant_id,updated_at desc,id);
alter table public.business_payroll_cost_allocations enable row level security;revoke all on public.business_payroll_cost_allocations from public,anon,authenticated,service_role;

insert into public.business_entity_definitions(kind,definition) values('salary_payments','{"label":"Chi trả lương nhân viên","feature":"accounting","mode":"document","fields":{"salary_run_id":{"label":"Bảng lương đã ghi sổ","type":"ref","ref":"salary_runs","required":true},"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"cash_account_id":{"label":"Tài khoản chi trả","type":"ref","ref":"gl_accounts","required":true},"amount":{"label":"Số tiền chi","type":"number","min":0.0001,"default":0},"document_date":{"label":"Ngày chi","type":"date","required":true},"posting_date":{"label":"Ngày ghi sổ","type":"date","required":true},"net_salary":{"label":"Lương thực lĩnh","type":"number","min":0,"default":0,"computed":true},"paid_before":{"label":"Đã chi trước lần này","type":"number","min":0,"default":0,"computed":true},"remaining_before":{"label":"Còn phải chi trước lần này","type":"number","min":0,"default":0,"computed":true}},"requiresFeatures":["people"],"calculable":true,"misaDomain":true,"requiresApproval":true}'::jsonb);
create table public.business_salary_payments(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 salary_run_id uuid not null,
 staff_id uuid not null,
 cash_account_id uuid not null,
 amount numeric(24,4) not null default '0' check(amount between 0.0001 and 1000000000000000),
 document_date date not null,
 posting_date date not null,
 net_salary numeric(24,4) not null default '0' check(net_salary between 0 and 1000000000000000),
 paid_before numeric(24,4) not null default '0' check(paid_before between 0 and 1000000000000000),
 remaining_before numeric(24,4) not null default '0' check(remaining_before between 0 and 1000000000000000)
);
create unique index business_salary_payments_code_idx on public.business_salary_payments(tenant_id,lower(code));
create index business_salary_payments_tenant_date_idx on public.business_salary_payments(tenant_id,updated_at desc,id);
alter table public.business_salary_payments enable row level security;revoke all on public.business_salary_payments from public,anon,authenticated,service_role;

alter table public.business_assets add foreign key(tenant_id,asset_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,accumulated_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,recognition_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,custodian_id) references public.business_staff(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,asset_id) references public.business_assets(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,income_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,counter_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_asset_charge_lines add foreign key(tenant_id,run_id) references public.business_asset_charge_runs(tenant_id,id);

alter table public.business_asset_charge_lines add foreign key(tenant_id,asset_id) references public.business_assets(tenant_id,id);

alter table public.business_asset_charge_lines add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_bank_statement_lines add foreign key(tenant_id,bank_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_bank_matches add foreign key(tenant_id,statement_line_id) references public.business_bank_statement_lines(tenant_id,id);

alter table public.business_bank_matches add foreign key(tenant_id,journal_line_id) references public.business_journal_lines(tenant_id,id);

alter table public.business_advances add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_advances add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_advances add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_advances add foreign key(tenant_id,advance_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_advance_settlements add foreign key(tenant_id,advance_id) references public.business_advances(tenant_id,id);

alter table public.business_advance_settlements add foreign key(tenant_id,expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_advance_settlements add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_loans add foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id);

alter table public.business_loans add foreign key(tenant_id,loan_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_loans add foreign key(tenant_id,interest_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_loans add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_loan_movements add foreign key(tenant_id,loan_id) references public.business_loans(tenant_id,id);

alter table public.business_loan_movements add foreign key(tenant_id,fee_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_loan_installments add foreign key(tenant_id,loan_id) references public.business_loans(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,inventory_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,wip_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,labor_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,overhead_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,cogs_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,material_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_costing_lines add foreign key(tenant_id,run_id) references public.business_costing_runs(tenant_id,id);

alter table public.business_overhead_pools add foreign key(tenant_id,source_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_overhead_pools add foreign key(tenant_id,source_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_overhead_allocations add foreign key(tenant_id,pool_id) references public.business_overhead_pools(tenant_id,id);

alter table public.business_overhead_allocations add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_overhead_allocations add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_invoice_adjustments add foreign key(tenant_id,sales_invoice_id) references public.business_sales_invoices(tenant_id,id);

alter table public.business_invoice_adjustments add foreign key(tenant_id,vendor_invoice_id) references public.business_vendor_invoices(tenant_id,id);

alter table public.business_invoice_refunds add foreign key(tenant_id,adjustment_id) references public.business_invoice_adjustments(tenant_id,id);

alter table public.business_invoice_refunds add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_closing_runs add foreign key(tenant_id,result_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_closing_runs add foreign key(tenant_id,retained_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_tax_filings add foreign key(tenant_id,policy_id) references public.business_tax_policies(tenant_id,id);

alter table public.business_tax_filings add foreign key(tenant_id,tax_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_tax_filings add foreign key(tenant_id,expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_tax_filing_lines add foreign key(tenant_id,filing_id) references public.business_tax_filings(tenant_id,id);

alter table public.business_stock_valuation_runs add foreign key(tenant_id,inventory_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_stock_valuation_runs add foreign key(tenant_id,cogs_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_stock_valuation_lines add foreign key(tenant_id,run_id) references public.business_stock_valuation_runs(tenant_id,id);

alter table public.business_stock_valuation_lines add foreign key(tenant_id,stock_move_id) references public.business_stock_moves(tenant_id,id);

alter table public.business_stock_valuation_lines add foreign key(tenant_id,item_id) references public.business_items(tenant_id,id);

alter table public.business_cost_source_links add foreign key(tenant_id,journal_line_id) references public.business_journal_lines(tenant_id,id);

alter table public.business_cost_source_links add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_cost_source_links add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_tax_brackets add foreign key(tenant_id,policy_id) references public.business_tax_policies(tenant_id,id);

alter table public.business_staff_tax_profiles add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_staff_tax_profiles add foreign key(tenant_id,pit_policy_id) references public.business_tax_policies(tenant_id,id);

alter table public.business_staff_tax_profiles add foreign key(tenant_id,insurance_policy_id) references public.business_tax_policies(tenant_id,id);

alter table public.business_payroll_tax_runs add foreign key(tenant_id,salary_run_id) references public.business_salary_runs(tenant_id,id);

alter table public.business_payroll_tax_runs add foreign key(tenant_id,pit_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_payroll_tax_runs add foreign key(tenant_id,insurance_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_payroll_tax_runs add foreign key(tenant_id,employer_expense_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_payroll_statutory_lines add foreign key(tenant_id,run_id) references public.business_payroll_tax_runs(tenant_id,id);

alter table public.business_payroll_statutory_lines add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_cost_receipt_values add foreign key(tenant_id,run_id) references public.business_costing_runs(tenant_id,id);

alter table public.business_cost_receipt_values add foreign key(tenant_id,receipt_id) references public.business_production_receipts(tenant_id,id);

alter table public.business_payroll_cost_allocations add foreign key(tenant_id,salary_line_id) references public.business_salary_lines(tenant_id,id);

alter table public.business_payroll_cost_allocations add foreign key(tenant_id,work_order_id) references public.business_work_orders(tenant_id,id);

alter table public.business_payroll_cost_allocations add foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id);

alter table public.business_salary_payments add foreign key(tenant_id,salary_run_id) references public.business_salary_runs(tenant_id,id);

alter table public.business_salary_payments add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);

alter table public.business_salary_payments add foreign key(tenant_id,cash_account_id) references public.business_gl_accounts(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_assets add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_asset_events add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_asset_charge_runs add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_asset_charge_runs add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_asset_charge_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_asset_charge_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_bank_statement_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_bank_statement_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_bank_matches add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_bank_matches add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_advances add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_advances add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_advance_settlements add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_advance_settlements add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_loans add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_loans add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_loan_movements add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_loan_movements add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_loan_installments add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_loan_installments add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_costing_runs add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_costing_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_costing_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_overhead_pools add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_overhead_pools add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_overhead_allocations add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_overhead_allocations add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_invoice_adjustments add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_invoice_adjustments add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_invoice_refunds add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_invoice_refunds add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_closing_runs add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_closing_runs add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_financial_report_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_financial_report_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_policies add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_policies add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_filings add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_filings add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_filing_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_filing_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_stock_valuation_runs add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_stock_valuation_runs add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_stock_valuation_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_stock_valuation_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_cost_source_links add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_cost_source_links add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_brackets add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_tax_brackets add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_staff_tax_profiles add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_staff_tax_profiles add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_payroll_tax_runs add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_payroll_tax_runs add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_payroll_statutory_lines add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_payroll_statutory_lines add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_cost_receipt_values add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_cost_receipt_values add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_payroll_cost_allocations add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_payroll_cost_allocations add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_salary_payments add foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id);

alter table public.business_salary_payments add foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id);

create unique index business_bank_statement_unique_txn on public.business_bank_statement_lines(tenant_id,bank_account_id,transaction_ref);
create unique index business_asset_charge_run_asset on public.business_asset_charge_lines(tenant_id,run_id,asset_id);
create unique index business_tax_filing_version on public.business_tax_filings(tenant_id,tax_type,starts_on,ends_on,filing_version) where status<>'cancelled';

update public.business_industry_packs set features='["inventory","production","mes","quality","crm","purchasing","accounting","people","sales","assets","costing"]'::jsonb where key='metalworking';

update public.business_industry_packs set features='["inventory","production","mes","quality","crm","purchasing","accounting","people","sales","assets","costing"]'::jsonb where key='plastics_packaging';

update public.business_industry_packs set features='["inventory","production","mes","traceability","quality","crm","purchasing","accounting","people","sales","assets","costing"]'::jsonb where key='electronics';

update public.business_industry_packs set features='["inventory","production","traceability","quality","crm","purchasing","accounting","people","sales","assets","costing"]'::jsonb where key='food_beverage';

update public.business_industry_packs set features='["inventory","sales","crm","purchasing","accounting","people","assets","costing"]'::jsonb where key='trading';

update public.business_industry_packs set features='["inventory","projects","crm","purchasing","accounting","people","sales","assets","costing"]'::jsonb where key='construction';

update public.business_tenants set features=features||jsonb_build_array('assets','costing'),row_version=row_version+1 where is_demo and not(features ? 'assets') and features ? 'accounting' and features ? 'inventory';

create function public.business_misa_validate_features(f jsonb) returns void language plpgsql security definer set search_path='' as $$ begin if ((f ? 'assets') and not(f ? 'accounting')) or ((f ? 'costing') and not(f ?& array['accounting','inventory'])) then raise exception 'BUSINESS_INVALID_INPUT';end if;end $$;revoke all on function public.business_misa_validate_features(jsonb) from public,anon,authenticated,service_role;

do $$ declare f text;signature regprocedure;begin foreach signature in array array['public.business_configure_workspace(uuid,uuid,integer,integer,text,jsonb,text,uuid)'::regprocedure,'public.business_provision_customer(uuid,uuid,integer,jsonb,text,text,uuid)'::regprocedure] loop select pg_get_functiondef(signature) into f;if strpos(f,'between 1 and 11')=0 then raise exception 'Review feature configuration before upgrading';end if;f:=replace(f,'between 1 and 11','between 1 and jsonb_array_length(pack.features)');f:=replace(f,'select * into pack from public.business_industry_packs where key=p_industry;',E'perform public.business_misa_validate_features(p_features);\n select * into pack from public.business_industry_packs where key=p_industry;');f:=replace(f,'select * into pack from public.business_industry_packs where key=p_config->>''industry'';',E'perform public.business_misa_validate_features(p_config->''features'');\n select * into pack from public.business_industry_packs where key=p_config->>''industry'';');execute f;end loop;end $$;
