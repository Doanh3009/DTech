create extension if not exists pgcrypto;

do $$ begin create type public.project_health as enum ('on_track', 'at_risk', 'delayed', 'paused', 'completed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_update_type as enum ('progress', 'issue', 'material', 'safety', 'change', 'general'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_update_status as enum ('in_progress', 'waiting', 'done'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_update_publish_status as enum ('draft', 'published', 'archived'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_update_sync_status as enum ('local_draft', 'pending_sync', 'syncing', 'synced', 'sync_failed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_issue_severity as enum ('low', 'medium', 'high', 'critical'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_issue_status as enum ('open', 'in_progress', 'resolved', 'closed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.project_attachment_type as enum ('image', 'pdf', 'spreadsheet', 'document'); exception when duplicate_object then null; end $$;

alter table public.projects add column if not exists health public.project_health not null default 'on_track';
alter table public.projects add column if not exists daily_update_required boolean not null default false;
alter table public.projects add column if not exists daily_update_deadline time;
alter table public.projects add column if not exists stale_after_days integer not null default 3 check (stale_after_days between 1 and 90);
create index if not exists projects_monitoring_idx on public.projects (status, health, updated_at desc);

create table if not exists public.project_update_types (
  code public.project_update_type primary key,
  label text not null,
  semantic_icon text not null,
  semantic_color text not null check (semantic_color in ('neutral', 'info', 'success', 'warning', 'error')),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.project_update_types (code, label, semantic_icon, semantic_color, sort_order) values
  ('progress', 'Tiến độ', 'chart-no-axes-column-increasing', 'success', 10),
  ('issue', 'Vấn đề', 'triangle-alert', 'warning', 20),
  ('material', 'Vật tư', 'package', 'info', 30),
  ('safety', 'An toàn', 'shield-check', 'error', 40),
  ('change', 'Thay đổi', 'refresh-cw', 'info', 50),
  ('general', 'Thông tin chung', 'info', 'neutral', 60)
on conflict (code) do update set label = excluded.label, semantic_icon = excluded.semantic_icon, semantic_color = excluded.semantic_color, sort_order = excluded.sort_order;

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  client_update_id uuid unique,
  project_id uuid not null references public.projects(id) on delete restrict,
  project_name_snapshot text not null,
  worksite_id uuid references public.worksites(id) on delete restrict,
  worksite_name_snapshot text,
  author_employee_id uuid references public.employees(id) on delete restrict,
  author_name_snapshot text not null,
  author_project_role_snapshot text not null,
  update_type public.project_update_type not null,
  title text not null,
  content text not null,
  status public.project_update_status not null default 'in_progress',
  publish_status public.project_update_publish_status not null default 'published',
  pinned boolean not null default false,
  related_attendance_session_id uuid references public.worker_attendance_sessions(id) on delete restrict,
  sync_status public.project_update_sync_status not null default 'synced',
  captured_at_client timestamptz,
  received_at_server timestamptz not null default now(),
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  archived_at timestamptz,
  archived_by uuid references public.app_accounts(id),
  check (length(trim(title)) between 3 and 180),
  check (length(trim(content)) between 3 and 10000),
  check ((publish_status = 'archived') = (archived_at is not null))
);
create index if not exists project_updates_timeline_idx on public.project_updates (project_id, pinned desc, created_at desc) where publish_status = 'published';
create index if not exists project_updates_filter_idx on public.project_updates (update_type, status, worksite_id, author_employee_id, created_at desc);
create index if not exists project_updates_search_idx on public.project_updates using gin (to_tsvector('simple', title || ' ' || content));
create unique index if not exists project_updates_one_client_request_idx on public.project_updates (client_update_id) where client_update_id is not null;

create table if not exists public.project_update_versions (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.project_updates(id) on delete restrict,
  version integer not null,
  before_data jsonb not null,
  after_data jsonb not null,
  edited_by uuid references public.app_accounts(id),
  edited_at timestamptz not null default now(),
  reason text,
  unique (update_id, version)
);
create index if not exists project_update_versions_update_idx on public.project_update_versions (update_id, version desc);

create table if not exists public.project_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  worksite_id uuid references public.worksites(id) on delete restrict,
  source_update_id uuid not null unique references public.project_updates(id) on delete restrict,
  title text not null,
  severity public.project_issue_severity not null,
  status public.project_issue_status not null default 'open',
  owner_employee_id uuid references public.employees(id) on delete restrict,
  resolution_note text,
  resolved_by uuid references public.app_accounts(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  check ((status in ('resolved', 'closed')) = (resolved_at is not null))
);
create index if not exists project_issues_attention_idx on public.project_issues (status, severity, created_at) where status in ('open', 'in_progress');
create index if not exists project_issues_project_idx on public.project_issues (project_id, status, updated_at desc);

create table if not exists public.project_issue_history (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.project_issues(id) on delete restrict,
  from_status public.project_issue_status,
  to_status public.project_issue_status not null,
  from_severity public.project_issue_severity,
  to_severity public.project_issue_severity not null,
  note text,
  changed_by uuid references public.app_accounts(id),
  changed_at timestamptz not null default now()
);
create index if not exists project_issue_history_issue_idx on public.project_issue_history (issue_id, changed_at desc);

create table if not exists public.project_health_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  from_health public.project_health,
  to_health public.project_health not null,
  reason text,
  changed_by uuid references public.app_accounts(id),
  changed_by_name_snapshot text not null,
  changed_at timestamptz not null default now(),
  check (to_health <> 'delayed' or length(trim(reason)) >= 3)
);
create index if not exists project_health_history_project_idx on public.project_health_history (project_id, changed_at desc);

create table if not exists public.project_update_attachments (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.project_updates(id) on delete restrict,
  file_id uuid not null references public.file_assets(id) on delete restrict,
  attachment_type public.project_attachment_type not null,
  caption text,
  source_attendance_photo_id uuid references public.worker_attendance_photos(id) on delete restrict,
  uploaded_by uuid references public.app_accounts(id),
  uploaded_at timestamptz not null default now(),
  sort_order integer not null default 0,
  unique (update_id, file_id)
);
create index if not exists project_update_attachments_update_idx on public.project_update_attachments (update_id, sort_order);

create table if not exists public.project_domain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('project.update.created','project.issue.created','project.issue.high','project.issue.resolved','project.health.changed')),
  project_id uuid not null references public.projects(id) on delete restrict,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists project_domain_events_pending_idx on public.project_domain_events (occurred_at) where processed_at is null;

create or replace function public.touch_project_update_version() returns trigger language plpgsql as $$ begin new.updated_at = now(); new.row_version = old.row_version + 1; return new; end; $$;
create or replace function public.touch_project_issue_version() returns trigger language plpgsql as $$ begin new.updated_at = now(); new.row_version = old.row_version + 1; return new; end; $$;
drop trigger if exists project_updates_touch_version on public.project_updates; create trigger project_updates_touch_version before update on public.project_updates for each row execute function public.touch_project_update_version();
drop trigger if exists project_issues_touch_version on public.project_issues; create trigger project_issues_touch_version before update on public.project_issues for each row execute function public.touch_project_issue_version();
drop trigger if exists project_update_types_touch_updated_at on public.project_update_types; create trigger project_update_types_touch_updated_at before update on public.project_update_types for each row execute function public.touch_updated_at();

alter table public.project_update_types enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_update_versions enable row level security;
alter table public.project_issues enable row level security;
alter table public.project_issue_history enable row level security;
alter table public.project_health_history enable row level security;
alter table public.project_update_attachments enable row level security;
alter table public.project_domain_events enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-update-files', 'project-update-files', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into public.permissions (key, module, description) values
  ('project_update.create', 'project-monitoring', 'Đăng cập nhật dự án'),
  ('project_update.view_project', 'project-monitoring', 'Xem cập nhật dự án được phân công'),
  ('project_update.view_all', 'project-monitoring', 'Xem toàn bộ cập nhật dự án'),
  ('project_update.edit_own', 'project-monitoring', 'Sửa cập nhật của mình'),
  ('project_update.edit_all', 'project-monitoring', 'Sửa mọi cập nhật dự án'),
  ('project_update.archive', 'project-monitoring', 'Lưu trữ cập nhật dự án'),
  ('project_update.pin', 'project-monitoring', 'Ghim cập nhật dự án'),
  ('project_health.update', 'project-monitoring', 'Cập nhật tình trạng dự án'),
  ('project_issue.view', 'project-monitoring', 'Xem vấn đề dự án'),
  ('project_issue.manage', 'project-monitoring', 'Quản lý vấn đề dự án'),
  ('project_issue.resolve', 'project-monitoring', 'Xử lý vấn đề dự án'),
  ('project_monitoring.view', 'project-monitoring', 'Xem dashboard dự án được phân công'),
  ('project_monitoring.view_all', 'project-monitoring', 'Xem dashboard toàn công ty')
on conflict (key) do update set module = excluded.module, description = excluded.description;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p
where r.code = 'admin' and p.module = 'project-monitoring' on conflict do nothing;
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r join public.permissions p on p.key = any(array[
  'project_update.create','project_update.view_project','project_update.edit_own','project_issue.view','project_monitoring.view'
]) where r.code = 'supervisor' on conflict do nothing;

insert into public.project_updates (id, client_update_id, project_id, project_name_snapshot, worksite_id, worksite_name_snapshot, author_name_snapshot, author_project_role_snapshot, update_type, title, content, status, publish_status, pinned, created_at)
values
  ('c0000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Bảo trì hệ thống ray Cảng ABC','b1000000-0000-4000-8000-000000000001','Khu QC03','Nguyễn Văn Minh','Giám sát chính','issue','Thiếu vật tư tại khu vực QC03','Vật tư ray dự kiến về trễ, cần xác nhận lịch giao mới.','waiting','published',true,now() - interval '2 hours'),
  ('c0000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Bảo trì hệ thống ray Cảng ABC','b1000000-0000-4000-8000-000000000001','Khu QC03','Trần Văn An','Kỹ sư','progress','Hoàn thành kiểm tra khu vực QC03','Đội hiện trường đã hoàn thành kiểm tra đầu ca và vệ sinh mặt bằng.','done','published',false,now() - interval '7 hours')
on conflict (id) do nothing;

insert into public.project_issues (id, project_id, worksite_id, source_update_id, title, severity, status)
values ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','Thiếu vật tư tại khu vực QC03','high','open')
on conflict (id) do nothing;
