create extension if not exists pgcrypto;

do $$
begin
  create type public.account_status as enum ('active', 'disabled', 'invited');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  employee_id uuid,
  display_name text not null,
  primary_email text,
  phone text,
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.permissions (
  key text primary key,
  module text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key)
);

create table if not exists public.account_roles (
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.app_accounts(id),
  primary key (account_id, role_id)
);

create table if not exists public.app_configurations (
  key text primary key,
  scope text not null default 'global' check (scope in ('global', 'module', 'user')),
  value jsonb not null,
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_account_id uuid references public.app_accounts(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  happened_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, happened_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_account_id, happened_at desc);

create table if not exists public.file_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  object_path text not null,
  owner_entity_type text not null,
  owner_entity_id text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  visibility text not null default 'private' check (visibility in ('private', 'internal')),
  checksum text,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (bucket, object_path)
);

create index if not exists file_assets_owner_idx
  on public.file_assets (owner_entity_type, owner_entity_id);

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_url text not null,
  enabled boolean not null default true,
  event_types text[] not null default '{}',
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  event_id uuid not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text
);

create index if not exists webhook_deliveries_status_idx
  on public.webhook_deliveries (status, next_attempt_at, created_at);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_accounts_touch_updated_at on public.app_accounts;
create trigger app_accounts_touch_updated_at
before update on public.app_accounts
for each row execute function public.touch_updated_at();

drop trigger if exists roles_touch_updated_at on public.roles;
create trigger roles_touch_updated_at
before update on public.roles
for each row execute function public.touch_updated_at();

drop trigger if exists app_configurations_touch_updated_at on public.app_configurations;
create trigger app_configurations_touch_updated_at
before update on public.app_configurations
for each row execute function public.touch_updated_at();

drop trigger if exists webhook_endpoints_touch_updated_at on public.webhook_endpoints;
create trigger webhook_endpoints_touch_updated_at
before update on public.webhook_endpoints
for each row execute function public.touch_updated_at();

alter table public.app_accounts enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.account_roles enable row level security;
alter table public.app_configurations enable row level security;
alter table public.audit_logs enable row level security;
alter table public.file_assets enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;

drop policy if exists "accounts can read own mapping" on public.app_accounts;
create policy "accounts can read own mapping"
on public.app_accounts
for select
to authenticated
using (auth.uid() = auth_user_id);

insert into public.permissions (key, module, description)
values
  ('dashboard.view', 'foundation', 'Xem Tổng quan'),
  ('employee.view', 'employees', 'Xem hồ sơ nhân sự'),
  ('employee.create', 'employees', 'Tạo hồ sơ nhân sự'),
  ('attendance.view', 'attendance', 'Xem chấm công cá nhân'),
  ('timesheet.view', 'timesheets', 'Xem bảng công'),
  ('leave.view', 'leave', 'Xem nghỉ phép và đơn từ'),
  ('project.view', 'projects', 'Xem dự án và công trường'),
  ('worker_attendance.view', 'worker-attendance', 'Xem điểm danh công nhân'),
  ('warehouse.view', 'warehouse', 'Xem module kho'),
  ('import_export.view', 'import-export', 'Xem module xuất nhập khẩu'),
  ('approval.view', 'approvals', 'Xem phê duyệt'),
  ('report.view', 'reports', 'Xem báo cáo'),
  ('notification.view', 'notifications', 'Xem thông báo'),
  ('profile.view', 'profile', 'Xem hồ sơ cá nhân'),
  ('user.view', 'settings', 'Xem tài khoản người dùng'),
  ('role.view', 'settings', 'Xem vai trò'),
  ('permission.view', 'settings', 'Xem quyền'),
  ('settings.view', 'settings', 'Xem cấu hình hệ thống'),
  ('audit.view', 'settings', 'Xem audit log'),
  ('integration.view', 'settings', 'Xem tích hợp'),
  ('file.read', 'storage', 'Đọc file nội bộ qua signed access'),
  ('webhook.publish', 'integrations', 'Phát sự kiện webhook')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;
