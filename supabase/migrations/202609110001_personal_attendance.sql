create extension if not exists pgcrypto;

do $$ begin
  create type public.attendance_event_type as enum ('check_in', 'check_out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_business_status as enum ('recorded', 'rejected', 'needs_review');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_photo_status as enum ('not_required', 'pending_upload', 'uploading', 'uploaded', 'upload_failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_sync_status as enum ('local_pending', 'syncing', 'synced', 'sync_failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_geofence_status as enum ('valid', 'outside', 'accuracy_low', 'unavailable', 'not_required');
exception when duplicate_object then null; end $$;

create table if not exists public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  attendance_enabled boolean not null default true,
  photo_required boolean not null default true,
  gps_required boolean not null default true,
  offline_enabled boolean not null default true,
  allowed_accuracy_threshold_meters integer not null default 100 check (allowed_accuracy_threshold_meters between 10 and 1000),
  early_checkin_window_minutes integer not null default 60 check (early_checkin_window_minutes between 0 and 360),
  late_threshold_minutes integer not null default 5 check (late_threshold_minutes between 0 and 180),
  shift_name text not null default 'Ca hành chính',
  shift_start time not null default '08:00',
  shift_end time not null default '17:00',
  timezone text not null default 'Asia/Ho_Chi_Minh',
  active boolean not null default true,
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists attendance_policies_one_active_idx
  on public.attendance_policies (active) where active;

create table if not exists public.attendance_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_meters integer not null check (radius_meters between 10 and 5000),
  active boolean not null default true,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_attendance_locations (
  employee_id uuid not null references public.employees(id) on delete cascade,
  location_id uuid not null references public.attendance_locations(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.app_accounts(id),
  primary key (employee_id, location_id)
);

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id uuid not null unique,
  employee_id uuid not null references public.employees(id) on delete restrict,
  account_id uuid references public.app_accounts(id) on delete restrict,
  event_type public.attendance_event_type not null,
  attendance_date date not null,
  effective_at timestamptz not null,
  captured_at_client timestamptz not null,
  received_at_server timestamptz not null default now(),
  synced_at timestamptz,
  location_id uuid references public.attendance_locations(id) on delete restrict,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  distance_meters double precision,
  geofence_status public.attendance_geofence_status not null,
  attendance_status public.attendance_business_status not null default 'recorded',
  photo_status public.attendance_photo_status not null default 'pending_upload',
  sync_status public.attendance_sync_status not null default 'syncing',
  source text not null default 'SELF_MOBILE_WEB' check (source = 'SELF_MOBILE_WEB'),
  captured_offline boolean not null default false,
  device_metadata jsonb not null default '{}'::jsonb,
  anomaly_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)),
  check (accuracy_meters is null or accuracy_meters >= 0),
  unique (employee_id, attendance_date, event_type)
);

create index if not exists attendance_events_employee_time_idx
  on public.attendance_events (employee_id, effective_at desc);
create index if not exists attendance_events_review_idx
  on public.attendance_events (attendance_status, attendance_date desc);
create index if not exists attendance_events_sync_idx
  on public.attendance_events (sync_status, photo_status, received_at_server);

create table if not exists public.attendance_photos (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null unique references public.attendance_events(id) on delete restrict,
  file_id uuid not null references public.file_assets(id) on delete restrict,
  thumbnail_file_id uuid references public.file_assets(id) on delete restrict,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_sync_events (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null references public.attendance_events(id) on delete cascade,
  state public.attendance_sync_status not null,
  category text,
  retry_count integer not null default 0 check (retry_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null default now()
);

create index if not exists attendance_sync_events_event_idx
  on public.attendance_sync_events (attendance_event_id, happened_at desc);

drop trigger if exists attendance_policies_touch_updated_at on public.attendance_policies;
create trigger attendance_policies_touch_updated_at before update on public.attendance_policies
for each row execute function public.touch_updated_at();
drop trigger if exists attendance_locations_touch_updated_at on public.attendance_locations;
create trigger attendance_locations_touch_updated_at before update on public.attendance_locations
for each row execute function public.touch_updated_at();
drop trigger if exists attendance_events_touch_updated_at on public.attendance_events;
create trigger attendance_events_touch_updated_at before update on public.attendance_events
for each row execute function public.touch_updated_at();

alter table public.attendance_policies enable row level security;
alter table public.attendance_locations enable row level security;
alter table public.employee_attendance_locations enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_photos enable row level security;
alter table public.attendance_sync_events enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.attendance_policies (name)
select 'Chính sách chấm công mặc định'
where not exists (select 1 from public.attendance_policies where active);

insert into public.attendance_locations (name, latitude, longitude, radius_meters)
select 'Văn phòng Châu Tuấn', 10.7769, 106.7009, 200
where not exists (select 1 from public.attendance_locations);

-- Tài khoản hiện tại của ứng dụng vẫn là demo. Tạo mapping có khóa ổn định để
-- module ghi dữ liệu thật lên Cloud; auth_user_id có thể được nối với Supabase Auth sau.
do $$
declare
  demo_employee_id uuid := '40000000-0000-4000-8000-000000000004';
  demo_account_id uuid := 'a0000000-0000-4000-8000-000000000001';
  department_id uuid;
  position_id uuid;
  employment_type_id uuid;
begin
  select id into department_id from public.departments where code = 'hr' limit 1;
  select id into position_id from public.positions where code = 'hr_specialist' limit 1;
  select id into employment_type_id from public.employment_types where code = 'office_employee' limit 1;

  if department_id is not null and position_id is not null and employment_type_id is not null
     and not exists (select 1 from public.employees where lower(employee_code) = 'hr002') then
    insert into public.employees (
      id, employee_code, full_name, display_name, personal_phone, normalized_phone,
      company_email, department_id, position_id, employment_type_id, join_date,
      employment_status, profile_status, profile_completeness
    ) values (
      demo_employee_id, 'HR002', 'Phạm Mai Anh', 'Mai Anh', '0934567890', '84934567890',
      'admin@chautuan.local', department_id, position_id, employment_type_id, '2022-06-01',
      'active', 'complete', 94
    );
  end if;

  select id into demo_employee_id from public.employees where lower(employee_code) = 'hr002' limit 1;
  if demo_employee_id is not null and not exists (
    select 1 from public.app_accounts where lower(primary_email) = 'admin@chautuan.local'
  ) then
    insert into public.app_accounts (id, employee_id, display_name, primary_email, status)
    values (demo_account_id, demo_employee_id, 'Phạm Mai Anh', 'admin@chautuan.local', 'active');
  end if;
end $$;

insert into public.permissions (key, module, description)
values
  ('attendance.self.view', 'attendance', 'Xem lịch sử chấm công cá nhân'),
  ('attendance.self.create', 'attendance', 'Tạo lượt chấm công cá nhân'),
  ('attendance.view_team', 'attendance', 'Xem chấm công trong nhóm phụ trách'),
  ('attendance.view_all', 'attendance', 'Xem toàn bộ dữ liệu chấm công'),
  ('attendance.view_photo', 'attendance', 'Xem ảnh chấm công'),
  ('attendance.review', 'attendance', 'Rà soát lượt chấm công'),
  ('attendance.adjust', 'attendance', 'Điều chỉnh lượt chấm công'),
  ('attendance.config.view', 'attendance', 'Xem cấu hình chấm công'),
  ('attendance.config.manage', 'attendance', 'Quản lý cấu hình chấm công')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.code = 'admin' and p.module = 'attendance'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r join public.permissions p on p.key = any(array[
  'attendance.view', 'attendance.self.view', 'attendance.self.create', 'attendance.view_all',
  'attendance.view_photo', 'attendance.review', 'attendance.adjust',
  'attendance.config.view', 'attendance.config.manage'
]) where r.code = 'hr'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r join public.permissions p on p.key = any(array[
  'attendance.view', 'attendance.self.view', 'attendance.self.create'
]) where r.code in ('employee', 'supervisor')
on conflict do nothing;

insert into public.employee_attendance_locations (employee_id, location_id)
select e.id, l.id
from public.employees e cross join public.attendance_locations l
where lower(e.employee_code) = 'hr002' and l.active
on conflict do nothing;

insert into public.account_roles (account_id, role_id)
select a.id, r.id
from public.app_accounts a
cross join public.roles r
where lower(a.primary_email) = 'admin@chautuan.local' and r.code = 'admin'
on conflict do nothing;
