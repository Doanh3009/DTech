create table if not exists public.system_settings (
  group_key text primary key check (group_key in ('branding', 'appearance', 'organization', 'localization', 'navigation', 'modules')),
  value jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings_versions (
  id uuid primary key default gen_random_uuid(),
  group_key text not null check (group_key in ('branding', 'appearance', 'organization', 'localization', 'navigation', 'modules')),
  version integer not null check (version > 0),
  snapshot jsonb not null,
  change_type text not null default 'publish' check (change_type in ('publish', 'restore')),
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  unique (group_key, version)
);

create index if not exists settings_versions_group_idx
  on public.settings_versions (group_key, created_at desc);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (asset_type in ('logo_main', 'logo_compact', 'logo_dark', 'favicon')),
  bucket text not null default 'brand-assets',
  object_path text not null,
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 2097152),
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  module_key text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets', 'brand-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop trigger if exists system_settings_touch_updated_at on public.system_settings;
create trigger system_settings_touch_updated_at
before update on public.system_settings
for each row execute function public.touch_updated_at();

alter table public.system_settings enable row level security;
alter table public.settings_versions enable row level security;
alter table public.brand_assets enable row level security;
alter table public.feature_flags enable row level security;

drop trigger if exists feature_flags_touch_updated_at on public.feature_flags;
create trigger feature_flags_touch_updated_at
before update on public.feature_flags
for each row execute function public.touch_updated_at();

insert into public.permissions (key, module, description)
values
  ('system_admin.access', 'system-admin', 'Truy cập Trung tâm quản trị'),
  ('branding.view', 'system-admin', 'Xem cấu hình thương hiệu'),
  ('branding.manage', 'system-admin', 'Quản lý cấu hình thương hiệu'),
  ('appearance.view', 'system-admin', 'Xem cấu hình giao diện'),
  ('appearance.manage', 'system-admin', 'Quản lý cấu hình giao diện'),
  ('navigation.manage', 'system-admin', 'Quản lý điều hướng'),
  ('module.manage', 'system-admin', 'Quản lý trạng thái module'),
  ('organization_settings.view', 'system-admin', 'Xem cấu hình tổ chức'),
  ('organization_settings.manage', 'system-admin', 'Quản lý cấu hình tổ chức'),
  ('localization.manage', 'system-admin', 'Quản lý định dạng và thời gian'),
  ('config_history.view', 'system-admin', 'Xem lịch sử cấu hình'),
  ('config_history.restore', 'system-admin', 'Khôi phục phiên bản cấu hình')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role_id, permission_key)
select role.id, permission.key
from public.roles role
cross join public.permissions permission
where role.code = 'admin'
  and permission.module = 'system-admin'
on conflict do nothing;

insert into public.system_settings (group_key, value)
values
  ('branding', '{"systemName":"Hệ thống nội bộ Châu Tuấn","loginSubtitle":"Quản lý nhân sự, công trường và vận hành","logoMainUrl":null,"logoCompactUrl":null,"logoDarkUrl":null,"faviconUrl":null,"assetVersion":0}'::jsonb),
  ('appearance', '{"primaryColor":"#0F766E","density":"standard","tableDensity":"standard","defaultPageSize":20,"sidebarDefault":"expanded","appearanceMode":"light"}'::jsonb),
  ('organization', '{"companyName":"Công ty Châu Tuấn","shortName":"CHÂU TUẤN","address":"","phone":"","email":"","taxCode":"","representativeName":""}'::jsonb),
  ('localization', '{"timezone":"Asia/Ho_Chi_Minh","dateFormat":"DD/MM/YYYY","timeFormat":"HH:mm","weekStartsOn":"monday","locale":"vi-VN"}'::jsonb),
  ('navigation', '{"hiddenItems":[],"itemOrder":["/dashboard","/employees","/attendance","/timesheets","/shifts","/leave","/projects","/projects/updates","/worker-attendance","/warehouse/items","/warehouse/receipts","/warehouse/issues","/warehouse/transfers","/warehouse/inventory","/import-export/shipments","/import-export/documents","/approvals","/reports"],"defaultLandingPage":"/dashboard","groupsExpanded":true}'::jsonb),
  ('modules', '{"human_resources":true,"attendance":true,"projects":true,"warehouse":false,"import_export":false,"reports":true}'::jsonb)
on conflict (group_key) do nothing;
