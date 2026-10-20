-- Personal workspace persistence and attendance evidence retention metadata.

alter table public.attendance_photos alter column file_id drop not null;
alter table public.attendance_photos
  add column if not exists evidence_status text not null default 'available'
    check (evidence_status in ('available', 'expired')),
  add column if not exists evidence_deleted_at timestamptz;

alter table public.worker_attendance_photos alter column file_id drop not null;
alter table public.worker_attendance_photos
  add column if not exists evidence_status text not null default 'available'
    check (evidence_status in ('available', 'expired')),
  add column if not exists evidence_deleted_at timestamptz;

create index if not exists attendance_photos_retention_idx
  on public.attendance_photos (evidence_status, captured_at);
create index if not exists worker_attendance_photos_retention_idx
  on public.worker_attendance_photos (evidence_status, captured_at);

create table if not exists public.user_dashboard_notes (
  account_id uuid primary key references public.app_accounts(id) on delete cascade,
  content text not null default '' check (length(content) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_accounts(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 240),
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_todos_owner_due_idx
  on public.user_todos (user_id, completed, due_date, created_at desc);

create table if not exists public.user_ui_preferences (
  account_id uuid primary key references public.app_accounts(id) on delete cascade,
  density text not null default 'default' check (density in ('compact', 'default', 'comfortable')),
  sidebar_collapsed boolean not null default false,
  pinned_modules text[] not null default '{}',
  dashboard_widget_visibility jsonb not null default '{}'::jsonb,
  dashboard_widget_order text[] not null default '{}',
  theme_preference text not null default 'system' check (theme_preference in ('system', 'light')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_dashboard_notes_touch_updated_at on public.user_dashboard_notes;
create trigger user_dashboard_notes_touch_updated_at before update on public.user_dashboard_notes
for each row execute function public.touch_updated_at();
drop trigger if exists user_todos_touch_updated_at on public.user_todos;
create trigger user_todos_touch_updated_at before update on public.user_todos
for each row execute function public.touch_updated_at();
drop trigger if exists user_ui_preferences_touch_updated_at on public.user_ui_preferences;
create trigger user_ui_preferences_touch_updated_at before update on public.user_ui_preferences
for each row execute function public.touch_updated_at();

alter table public.user_dashboard_notes enable row level security;
alter table public.user_todos enable row level security;
alter table public.user_ui_preferences enable row level security;
