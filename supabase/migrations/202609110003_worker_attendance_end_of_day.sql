alter table public.worker_attendance_sessions
  add column if not exists day_closed_at timestamptz,
  add column if not exists day_closed_by uuid references public.app_accounts(id);

create index if not exists worker_attendance_sessions_day_close_idx
  on public.worker_attendance_sessions (attendance_date, day_closed_at)
  where day_closed_at is not null;
