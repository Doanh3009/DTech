-- Minimal, disposable PostgreSQL fixture for the settings command. These table
-- contracts mirror the foundation/system-admin migrations; this is not a seed
-- for a customer database and does not validate the full Supabase migration set.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
-- Reproduce Supabase's broad defaults before creating the command receipt table.
-- The command migration must replace these privileges with read-only access.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
create type public.account_status as enum ('active','disabled','invited');
create table public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  status public.account_status not null default 'active'
);
create table public.permissions (key text primary key);
create table public.roles (id uuid primary key, code text not null unique);
create table public.account_roles (
  account_id uuid not null references public.app_accounts(id),
  role_id uuid not null references public.roles(id),
  primary key(account_id,role_id)
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id),
  permission_key text not null references public.permissions(key),
  primary key(role_id,permission_key)
);
create table public.system_settings (
  group_key text primary key check(group_key in ('branding','appearance','organization','localization','navigation','dashboard','modules','payslip')),
  value jsonb not null,
  version integer not null default 1 check(version > 0),
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.settings_versions (
  id uuid primary key default gen_random_uuid(),
  group_key text not null check(group_key in ('branding','appearance','organization','localization','navigation','dashboard','modules','payslip')),
  version integer not null check(version > 0),
  snapshot jsonb not null,
  change_type text not null default 'publish' check(change_type in ('publish','restore')),
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  unique(group_key,version)
);
create table public.employees (id uuid primary key);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references public.app_accounts(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  happened_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  -- Matching nullable/defaulted additions from 202609120004_shared_platforms.
  actor_employee_id uuid references public.employees(id),
  entity_reference text,
  module text,
  source text not null default 'web',
  ip_address inet,
  user_agent_summary text,
  correlation_id uuid,
  severity text not null default 'normal' check(severity in ('normal','security','sensitive'))
);
create or replace function public.protect_audit_log() returns trigger language plpgsql as $$
begin raise exception 'AUDIT_LOG_APPEND_ONLY'; end $$;
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.protect_audit_log();
alter table public.system_settings enable row level security;
alter table public.settings_versions enable row level security;
alter table public.audit_logs enable row level security;

insert into public.permissions(key) values
  ('system_admin.access'),('branding.manage'),('appearance.manage'),
  ('organization_settings.manage'),('localization.manage'),('navigation.manage'),
  ('module.manage'),('config_history.restore');
insert into public.roles(id,code) values
  ('10000000-0000-4000-8000-000000000001','test_admin'),
  ('10000000-0000-4000-8000-000000000002','test_branding'),
  ('10000000-0000-4000-8000-000000000003','test_no_access'),
  ('10000000-0000-4000-8000-000000000004','test_restore_only');
insert into public.role_permissions(role_id,permission_key)
select '10000000-0000-4000-8000-000000000001',key from public.permissions;
insert into public.role_permissions(role_id,permission_key) values
  ('10000000-0000-4000-8000-000000000002','system_admin.access'),
  ('10000000-0000-4000-8000-000000000002','branding.manage'),
  ('10000000-0000-4000-8000-000000000003','branding.manage'),
  ('10000000-0000-4000-8000-000000000004','system_admin.access'),
  ('10000000-0000-4000-8000-000000000004','config_history.restore');
insert into public.app_accounts(id,display_name,status) values
  ('20000000-0000-4000-8000-000000000001','Integration admin','active'),
  ('20000000-0000-4000-8000-000000000002','Integration branding','active'),
  ('20000000-0000-4000-8000-000000000003','Integration no access','active'),
  ('20000000-0000-4000-8000-000000000004','Integration disabled','disabled'),
  ('20000000-0000-4000-8000-000000000005','Integration other admin','active'),
  ('20000000-0000-4000-8000-000000000006','Integration restore only','active');
insert into public.account_roles(account_id,role_id) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004');
