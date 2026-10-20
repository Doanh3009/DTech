create extension if not exists pgcrypto;

do $$ begin create type public.project_status as enum ('preparing', 'active', 'paused', 'completed', 'closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worksite_status as enum ('active', 'inactive', 'closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_assignment_role as enum ('project_manager', 'engineer', 'supervisor_main', 'supervisor_replacement', 'worker', 'support'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_assignment_status as enum ('active', 'inactive', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worker_attendance_session_status as enum ('draft', 'in_progress', 'submitted', 'locked', 'needs_review'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worker_attendance_entry_status as enum ('unconfirmed', 'present', 'absent', 'leave', 'late', 'transferred'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worker_exception_reason as enum ('approved_leave', 'unapproved', 'unknown', 'other_worksite', 'other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worker_day_exception as enum ('none', 'early_leave', 'transferred', 'half_day', 'overtime', 'left_worksite'); exception when duplicate_object then null; end $$;
do $$ begin create type public.worker_session_sync_status as enum ('local_pending', 'syncing', 'synced', 'sync_failed'); exception when duplicate_object then null; end $$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  customer_name text,
  summary text,
  start_date date not null,
  expected_end_date date,
  actual_end_date date,
  status public.project_status not null default 'preparing',
  project_manager_employee_id uuid references public.employees(id) on delete restrict,
  note text,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  check (trim(code) <> '' and trim(name) <> ''),
  check (expected_end_date is null or expected_end_date >= start_date),
  check (actual_end_date is null or actual_end_date >= start_date)
);
create unique index if not exists projects_code_unique_idx on public.projects (lower(code));
create index if not exists projects_status_dates_idx on public.projects (status, start_date, expected_end_date);

create table if not exists public.worksites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  radius_meters integer not null default 200 check (radius_meters between 10 and 5000),
  gps_required boolean not null default true,
  allowed_accuracy_threshold_meters integer not null default 100 check (allowed_accuracy_threshold_meters between 10 and 1000),
  status public.worksite_status not null default 'active',
  active_from date,
  active_to date,
  note text,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)),
  check (active_to is null or active_from is null or active_to >= active_from),
  unique (project_id, name)
);
create index if not exists worksites_project_status_idx on public.worksites (project_id, status);

create table if not exists public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  worksite_id uuid references public.worksites(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  assignment_role public.project_assignment_role not null,
  start_date date not null,
  end_date date,
  shift_code text not null default 'DAY',
  shift_name text not null default 'Ca ngày',
  shift_start time not null default '07:00',
  shift_end time not null default '17:00',
  status public.project_assignment_status not null default 'active',
  assigned_by uuid references public.app_accounts(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  check (end_date is null or end_date >= start_date),
  unique (project_id, worksite_id, employee_id, assignment_role, start_date)
);
create index if not exists project_assignments_roster_idx on public.project_assignments (project_id, worksite_id, start_date, end_date, status);
create index if not exists project_assignments_employee_date_idx on public.project_assignments (employee_id, start_date, end_date, status);

create table if not exists public.worker_attendance_policies (
  id uuid primary key default gen_random_uuid(),
  minimum_photos integer not null default 1 check (minimum_photos between 0 and 10),
  work_note_required boolean not null default false,
  end_of_day_required boolean not null default false,
  offline_enabled boolean not null default true,
  edit_window_minutes integer not null default 120 check (edit_window_minutes between 0 and 10080),
  morning_window_start time not null default '06:00',
  morning_window_end time not null default '09:00',
  active boolean not null default true,
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists worker_attendance_policies_one_active_idx on public.worker_attendance_policies (active) where active;

create table if not exists public.worker_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id uuid not null unique,
  project_id uuid not null references public.projects(id) on delete restrict,
  project_name_snapshot text not null,
  worksite_id uuid not null references public.worksites(id) on delete restrict,
  worksite_name_snapshot text not null,
  attendance_date date not null,
  shift_code text not null,
  shift_name_snapshot text not null,
  session_type text not null default 'morning' check (session_type in ('morning', 'end_of_day')),
  supervisor_employee_id uuid not null references public.employees(id) on delete restrict,
  supervisor_name_snapshot text not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  captured_at_client timestamptz not null,
  received_at_server timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  distance_meters double precision,
  geofence_status text not null default 'unavailable' check (geofence_status in ('valid', 'outside', 'accuracy_low', 'unavailable', 'not_required')),
  work_note text,
  note text,
  status public.worker_attendance_session_status not null default 'draft',
  sync_status public.worker_session_sync_status not null default 'syncing',
  photo_status text not null default 'pending_upload' check (photo_status in ('not_required', 'pending_upload', 'uploading', 'uploaded', 'upload_failed')),
  source text not null default 'SUPERVISOR_ROSTER' check (source = 'SUPERVISOR_ROSTER'),
  version integer not null default 1 check (version > 0),
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, worksite_id, attendance_date, shift_code, session_type)
);
create index if not exists worker_attendance_sessions_scope_idx on public.worker_attendance_sessions (project_id, worksite_id, attendance_date desc);
create index if not exists worker_attendance_sessions_supervisor_idx on public.worker_attendance_sessions (supervisor_employee_id, attendance_date desc, status);

create table if not exists public.worker_attendance_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.worker_attendance_sessions(id) on delete cascade,
  worker_id uuid not null references public.employees(id) on delete restrict,
  employee_code_snapshot text not null,
  worker_name_snapshot text not null,
  assignment_role_snapshot text not null,
  status public.worker_attendance_entry_status not null default 'unconfirmed',
  exception_reason public.worker_exception_reason,
  day_exception public.worker_day_exception not null default 'none',
  exception_time time,
  is_unplanned boolean not null default false,
  unplanned_reason text,
  note text,
  source text not null default 'SUPERVISOR_ROSTER' check (source = 'SUPERVISOR_ROSTER'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, worker_id)
);
create index if not exists worker_attendance_entries_worker_idx on public.worker_attendance_entries (worker_id, session_id);
create index if not exists worker_attendance_entries_status_idx on public.worker_attendance_entries (session_id, status);

create table if not exists public.worker_attendance_photos (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.worker_attendance_sessions(id) on delete restrict,
  file_id uuid not null references public.file_assets(id) on delete restrict,
  thumbnail_file_id uuid references public.file_assets(id) on delete restrict,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  sort_order integer not null default 0,
  width integer not null check (width between 1 and 10000),
  height integer not null check (height between 1 and 10000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists worker_attendance_photos_session_idx on public.worker_attendance_photos (session_id, sort_order);

create table if not exists public.worker_attendance_adjustments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.worker_attendance_sessions(id) on delete restrict,
  entry_id uuid references public.worker_attendance_entries(id) on delete restrict,
  actor_account_id uuid references public.app_accounts(id),
  reason text not null check (length(trim(reason)) >= 3),
  before_data jsonb not null,
  after_data jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists worker_attendance_adjustments_session_idx on public.worker_attendance_adjustments (session_id, created_at desc);

create or replace function public.touch_project_version() returns trigger language plpgsql as $$ begin new.updated_at = now(); new.row_version = old.row_version + 1; return new; end; $$;
create or replace function public.touch_assignment_version() returns trigger language plpgsql as $$ begin new.updated_at = now(); new.row_version = old.row_version + 1; return new; end; $$;
create or replace function public.touch_worker_session_version() returns trigger language plpgsql as $$ begin new.updated_at = now(); new.version = old.version + 1; return new; end; $$;
drop trigger if exists projects_touch_version on public.projects; create trigger projects_touch_version before update on public.projects for each row execute function public.touch_project_version();
drop trigger if exists worksites_touch_updated_at on public.worksites; create trigger worksites_touch_updated_at before update on public.worksites for each row execute function public.touch_updated_at();
drop trigger if exists project_assignments_touch_version on public.project_assignments; create trigger project_assignments_touch_version before update on public.project_assignments for each row execute function public.touch_assignment_version();
drop trigger if exists worker_attendance_policies_touch_updated_at on public.worker_attendance_policies; create trigger worker_attendance_policies_touch_updated_at before update on public.worker_attendance_policies for each row execute function public.touch_updated_at();
drop trigger if exists worker_attendance_sessions_touch_version on public.worker_attendance_sessions; create trigger worker_attendance_sessions_touch_version before update on public.worker_attendance_sessions for each row execute function public.touch_worker_session_version();
drop trigger if exists worker_attendance_entries_touch_updated_at on public.worker_attendance_entries; create trigger worker_attendance_entries_touch_updated_at before update on public.worker_attendance_entries for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;
alter table public.worksites enable row level security;
alter table public.project_assignments enable row level security;
alter table public.worker_attendance_policies enable row level security;
alter table public.worker_attendance_sessions enable row level security;
alter table public.worker_attendance_entries enable row level security;
alter table public.worker_attendance_photos enable row level security;
alter table public.worker_attendance_adjustments enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('worker-attendance-photos', 'worker-attendance-photos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.worker_attendance_policies (minimum_photos)
select 1 where not exists (select 1 from public.worker_attendance_policies where active);

insert into public.permissions (key, module, description)
values
  ('project.create', 'projects', 'Tạo dự án'), ('project.edit', 'projects', 'Chỉnh sửa dự án'),
  ('project.manage_team', 'projects', 'Quản lý đội dự án'), ('project.manage_schedule', 'projects', 'Quản lý lịch dự án'),
  ('worksite.view', 'projects', 'Xem công trường'), ('worksite.manage', 'projects', 'Quản lý công trường'),
  ('worker_attendance.self_scope', 'worker-attendance', 'Xem phạm vi điểm danh được phân công'),
  ('worker_attendance.create', 'worker-attendance', 'Tạo điểm danh công nhân'),
  ('worker_attendance.view_project', 'worker-attendance', 'Xem điểm danh dự án'),
  ('worker_attendance.view_all', 'worker-attendance', 'Xem toàn bộ điểm danh công nhân'),
  ('worker_attendance.view_photo', 'worker-attendance', 'Xem ảnh điểm danh công nhân'),
  ('worker_attendance.adjust', 'worker-attendance', 'Điều chỉnh điểm danh công nhân'),
  ('worker_attendance.lock', 'worker-attendance', 'Khóa phiên điểm danh')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.code = 'admin' and p.module in ('projects', 'worker-attendance') on conflict do nothing;
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r join public.permissions p on p.key = any(array[
  'project.view','worksite.view','worker_attendance.view_project','worker_attendance.view_all','worker_attendance.view_photo','worker_attendance.adjust','worker_attendance.lock'
]) where r.code = 'hr' on conflict do nothing;
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r join public.permissions p on p.key = any(array[
  'project.view','worksite.view','worker_attendance.self_scope','worker_attendance.create','worker_attendance.view_project','worker_attendance.view_photo'
]) where r.code = 'supervisor' on conflict do nothing;

-- Demo data follows the existing foundation account and can be replaced by real records.
insert into public.employees (id, employee_code, full_name, display_name, personal_phone, normalized_phone, department_id, position_id, employment_type_id, join_date, employment_status, profile_status, profile_completeness)
select v.id::uuid, v.code, v.name, v.name, v.phone, v.normalized_phone, d.id, p.id, et.id, '2026-01-01', 'active', 'complete', 70
from (values
  ('41000000-0000-4000-8000-000000000001','CN018','Trần Thị Bình','0912345678','84912345678'),
  ('41000000-0000-4000-8000-000000000002','CN019','Nguyễn Văn Hùng','0912345679','84912345679'),
  ('41000000-0000-4000-8000-000000000003','CN020','Lê Văn Cường','0912345680','84912345680')
) as v(id,code,name,phone,normalized_phone)
cross join public.departments d cross join public.positions p cross join public.employment_types et
where d.code = 'construction' and p.code = 'worker' and et.code = 'worker'
on conflict (id) do nothing;

insert into public.projects (id, code, name, customer_name, summary, start_date, expected_end_date, status, project_manager_employee_id)
select 'b0000000-0000-4000-8000-000000000001', 'CT-2026-015', 'Bảo trì hệ thống ray Cảng ABC', 'Cảng ABC', 'Bảo trì khu vực ray QC03 và QC04.', current_date - 10, current_date + 30, 'active', e.id
from public.employees e where lower(e.employee_code) = 'hr002'
on conflict (id) do nothing;

insert into public.worksites (id, project_id, name, address, latitude, longitude, radius_meters, status, active_from)
values ('b1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Khu QC03','Cảng ABC',10.7769,106.7009,250,'active',current_date - 10)
on conflict (id) do nothing;

insert into public.project_assignments (project_id, worksite_id, employee_id, assignment_role, start_date, end_date, shift_code, shift_name, assigned_by)
select 'b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',e.id,
  case when lower(e.employee_code) = 'hr002' then 'supervisor_main'::public.project_assignment_role else 'worker'::public.project_assignment_role end,
  current_date - 10, current_date + 30, 'DAY', 'Ca ngày', a.id
from public.employees e
left join public.app_accounts a on lower(a.primary_email) = 'admin@chautuan.local'
where lower(e.employee_code) in ('hr002','cn018','cn019','cn020')
on conflict do nothing;
