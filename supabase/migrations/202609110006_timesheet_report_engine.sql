create extension if not exists pgcrypto;

do $$ begin create type public.timesheet_period_status as enum ('open','reviewing','locked','reopened'); exception when duplicate_object then null; end $$;
do $$ begin create type public.timesheet_daily_status as enum ('full_work','late','early_leave','missing_check_in','missing_check_out','annual_leave','unpaid_leave','absent','business_trip','holiday','rest_day','worker_site','needs_review'); exception when duplicate_object then null; end $$;
do $$ begin create type public.timesheet_adjustment_type as enum ('add_missing_check_in','add_missing_check_out','adjust_effective_time','mark_leave','mark_business_trip','correct_status','correct_work_fraction','note_only','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.timesheet_exception_type as enum ('missing_check_in','missing_check_out','attendance_leave_conflict','gps_issue','photo_pending','offline_sync_pending','worker_roster_conflict','duplicate_source_conflict'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_type as enum ('timesheet','employee_list','employee_profile'); exception when duplicate_object then null; end $$;
do $$ begin create type public.report_export_status as enum ('queued','processing','completed','failed'); exception when duplicate_object then null; end $$;

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(), code text not null, name text not null,
  start_time time not null, end_time time not null, break_minutes integer not null default 0 check(break_minutes between 0 and 720),
  late_grace_minutes integer not null default 0 check(late_grace_minutes between 0 and 180),
  early_leave_grace_minutes integer not null default 0 check(early_leave_grace_minutes between 0 and 180),
  check_in_earliest_minutes integer not null default 120 check(check_in_earliest_minutes between 0 and 720),
  check_in_latest_minutes integer not null default 240 check(check_in_latest_minutes between 0 and 720),
  check_out_earliest_minutes integer not null default 0 check(check_out_earliest_minutes between 0 and 720),
  check_out_latest_minutes integer not null default 360 check(check_out_latest_minutes between 0 and 720),
  cross_midnight boolean not null default false, active boolean not null default true,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists shifts_code_unique_idx on public.shifts(lower(code));

create table if not exists public.shift_assignments (
  id uuid primary key default gen_random_uuid(), shift_id uuid not null references public.shifts(id),
  scope_type text not null check(scope_type in ('company','department','project','employee')), scope_id uuid,
  effective_from date not null, effective_to date, weekdays integer[] not null default array[1,2,3,4,5],
  active boolean not null default true, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  check((scope_type='company' and scope_id is null) or (scope_type<>'company' and scope_id is not null)),
  check(effective_to is null or effective_to>=effective_from), unique(shift_id,scope_type,scope_id,effective_from)
);
create index if not exists shift_assignments_resolution_idx on public.shift_assignments(scope_type,scope_id,effective_from,effective_to,active);

create table if not exists public.work_calendar_days (
  id uuid primary key default gen_random_uuid(), calendar_date date not null, name text not null,
  day_type text not null check(day_type in ('holiday','company_holiday','makeup_workday','special')),
  scope_type text not null default 'company' check(scope_type in ('company','department','project','employee')), scope_id uuid,
  is_working_day boolean not null default false, active boolean not null default true,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((scope_type='company' and scope_id is null) or (scope_type<>'company' and scope_id is not null)), unique(calendar_date,scope_type,scope_id)
);
create index if not exists work_calendar_days_date_idx on public.work_calendar_days(calendar_date,active);

create table if not exists public.timesheet_periods (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  start_date date not null, end_date date not null, status public.timesheet_period_status not null default 'open',
  version integer not null default 0 check(version>=0), row_version integer not null default 1 check(row_version>0),
  locked_at timestamptz, locked_by uuid references public.app_accounts(id), reopened_at timestamptz, reopened_by uuid references public.app_accounts(id), reopen_reason text,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(end_date>=start_date), unique(start_date,end_date)
);
create index if not exists timesheet_periods_dates_idx on public.timesheet_periods(start_date,end_date,status);

create table if not exists public.daily_timesheets (
  id uuid primary key default gen_random_uuid(), period_id uuid not null references public.timesheet_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id), work_date date not null,
  employee_snapshot jsonb not null, shift_id uuid references public.shifts(id), shift_snapshot jsonb,
  source_codes text[] not null default '{}', raw_source_snapshot jsonb not null default '{}'::jsonb,
  effective_check_in timestamptz, effective_check_out timestamptz, work_minutes integer not null default 0 check(work_minutes>=0),
  work_fraction numeric(5,2) not null default 0, leave_fraction numeric(5,2) not null default 0,
  late_minutes integer not null default 0, early_leave_minutes integer not null default 0,
  leave_type_code text, leave_type_name text, status public.timesheet_daily_status not null,
  hr_note text, exception_count integer not null default 0, adjustment_snapshot jsonb not null default '[]'::jsonb,
  calculation_version integer not null default 1, computed_at timestamptz not null default now(),
  unique(period_id,employee_id,work_date)
);
create index if not exists daily_timesheets_employee_date_idx on public.daily_timesheets(employee_id,work_date);
create index if not exists daily_timesheets_period_status_idx on public.daily_timesheets(period_id,status);

create table if not exists public.timesheet_period_summaries (
  id uuid primary key default gen_random_uuid(), period_id uuid not null references public.timesheet_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id), employee_snapshot jsonb not null,
  scheduled_workdays numeric(7,2) not null default 0, actual_workdays numeric(7,2) not null default 0,
  worked_minutes integer not null default 0, late_days integer not null default 0, late_minutes integer not null default 0,
  early_leave_days integer not null default 0, early_leave_minutes integer not null default 0,
  annual_leave_days numeric(7,2) not null default 0, unpaid_leave_days numeric(7,2) not null default 0,
  absent_days numeric(7,2) not null default 0, business_trip_days numeric(7,2) not null default 0,
  holiday_days numeric(7,2) not null default 0, missing_check_in_days integer not null default 0,
  missing_check_out_days integer not null default 0, exception_count integer not null default 0,
  computed_at timestamptz not null default now(), unique(period_id,employee_id)
);

create table if not exists public.timesheet_adjustments (
  id uuid primary key default gen_random_uuid(), period_id uuid not null references public.timesheet_periods(id),
  employee_id uuid not null references public.employees(id), work_date date not null,
  adjustment_type public.timesheet_adjustment_type not null, effective_time timestamptz,
  corrected_status public.timesheet_daily_status, corrected_work_fraction numeric(5,2), hr_note text,
  reason text not null check(length(trim(reason))>=3), before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now()
);
create index if not exists timesheet_adjustments_target_idx on public.timesheet_adjustments(period_id,employee_id,work_date,created_at);

create table if not exists public.timesheet_exceptions (
  id uuid primary key default gen_random_uuid(), period_id uuid not null references public.timesheet_periods(id) on delete cascade,
  daily_timesheet_id uuid not null references public.daily_timesheets(id) on delete cascade,
  employee_id uuid not null references public.employees(id), work_date date not null,
  exception_type public.timesheet_exception_type not null, severity text not null check(severity in ('warning','high')),
  status text not null default 'open' check(status in ('open','resolved','ignored')), details jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.app_accounts(id), resolved_at timestamptz, resolution_note text,
  created_at timestamptz not null default now(), unique(daily_timesheet_id,exception_type)
);
create index if not exists timesheet_exceptions_queue_idx on public.timesheet_exceptions(period_id,status,severity,work_date);

create table if not exists public.timesheet_period_versions (
  id uuid primary key default gen_random_uuid(), period_id uuid not null references public.timesheet_periods(id) on delete restrict,
  version integer not null, snapshot jsonb not null, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  unique(period_id,version)
);

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, report_type public.report_type not null,
  definition jsonb not null, version integer not null default 1, active boolean not null default true,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.report_template_versions (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.report_templates(id) on delete restrict,
  version integer not null, snapshot jsonb not null, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  unique(template_id,version)
);
create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(), report_type public.report_type not null,
  template_id uuid not null references public.report_templates(id), template_version integer not null,
  period_id uuid references public.timesheet_periods(id), period_version integer, filters jsonb not null default '{}'::jsonb,
  requested_by uuid references public.app_accounts(id), requested_at timestamptz not null default now(), completed_at timestamptz,
  file_id uuid references public.file_assets(id), status public.report_export_status not null default 'queued',
  error_message text, metadata jsonb not null default '{}'::jsonb
);
create index if not exists report_exports_requester_idx on public.report_exports(requested_by,requested_at desc);

alter table public.attendance_events drop constraint if exists attendance_events_employee_id_attendance_date_event_type_key;

create or replace function public.touch_timesheet_period_version() returns trigger language plpgsql as $$ begin new.updated_at=now();new.row_version=old.row_version+1;return new;end;$$;
drop trigger if exists shifts_touch_updated_at on public.shifts; create trigger shifts_touch_updated_at before update on public.shifts for each row execute function public.touch_updated_at();
drop trigger if exists calendar_days_touch_updated_at on public.work_calendar_days; create trigger calendar_days_touch_updated_at before update on public.work_calendar_days for each row execute function public.touch_updated_at();
drop trigger if exists periods_touch_version on public.timesheet_periods; create trigger periods_touch_version before update on public.timesheet_periods for each row execute function public.touch_timesheet_period_version();
drop trigger if exists report_templates_touch_updated_at on public.report_templates; create trigger report_templates_touch_updated_at before update on public.report_templates for each row execute function public.touch_updated_at();

create or replace function public.lock_timesheet_period(p_period_id uuid,p_actor_id uuid,p_expected_row_version integer)
returns integer language plpgsql security definer set search_path=public as $$
declare v_period public.timesheet_periods%rowtype; v_next integer; v_snapshot jsonb;
begin
  select * into v_period from public.timesheet_periods where id=p_period_id for update;
  if not found then raise exception 'PERIOD_NOT_FOUND'; end if;
  if v_period.row_version<>p_expected_row_version then raise exception 'PERIOD_VERSION_CONFLICT'; end if;
  if v_period.status='locked' then return v_period.version; end if;
  if exists(select 1 from public.timesheet_exceptions where period_id=p_period_id and status='open' and severity='high') then raise exception 'PERIOD_HIGH_EXCEPTIONS'; end if;
  v_next:=v_period.version+1;
  select jsonb_build_object('period',to_jsonb(v_period),'daily',coalesce((select jsonb_agg(to_jsonb(d) order by d.work_date,d.employee_id) from public.daily_timesheets d where d.period_id=p_period_id),'[]'::jsonb),'summaries',coalesce((select jsonb_agg(to_jsonb(s) order by s.employee_id) from public.timesheet_period_summaries s where s.period_id=p_period_id),'[]'::jsonb)) into v_snapshot;
  insert into public.timesheet_period_versions(period_id,version,snapshot,created_by) values(p_period_id,v_next,v_snapshot,p_actor_id);
  update public.timesheet_periods set status='locked',version=v_next,locked_at=now(),locked_by=p_actor_id where id=p_period_id;
  return v_next;
end;$$;

create or replace function public.unlock_timesheet_period(p_period_id uuid,p_actor_id uuid,p_expected_row_version integer,p_reason text)
returns integer language plpgsql security definer set search_path=public as $$
declare v_period public.timesheet_periods%rowtype;
begin
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'UNLOCK_REASON_REQUIRED'; end if;
  select * into v_period from public.timesheet_periods where id=p_period_id for update;
  if not found then raise exception 'PERIOD_NOT_FOUND'; end if;
  if v_period.row_version<>p_expected_row_version then raise exception 'PERIOD_VERSION_CONFLICT'; end if;
  if v_period.status<>'locked' then raise exception 'PERIOD_NOT_LOCKED'; end if;
  update public.timesheet_periods set status='reopened',reopened_at=now(),reopened_by=p_actor_id,reopen_reason=p_reason where id=p_period_id;
  return v_period.version;
end;$$;

alter table public.shifts enable row level security; alter table public.shift_assignments enable row level security;
alter table public.work_calendar_days enable row level security; alter table public.timesheet_periods enable row level security;
alter table public.daily_timesheets enable row level security; alter table public.timesheet_period_summaries enable row level security;
alter table public.timesheet_adjustments enable row level security; alter table public.timesheet_exceptions enable row level security;
alter table public.timesheet_period_versions enable row level security; alter table public.report_templates enable row level security;
alter table public.report_template_versions enable row level security; alter table public.report_exports enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('report-exports','report-exports',false,52428800,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.permissions(key,module,description) values
('shift.view','timesheet','Xem ca làm'),('shift.manage','timesheet','Quản lý ca làm'),
('timesheet.self.view','timesheet','Xem bảng công cá nhân'),('timesheet.view_team','timesheet','Xem bảng công nhóm'),('timesheet.view_all','timesheet','Xem mọi bảng công'),
('timesheet.adjust','timesheet','Điều chỉnh bảng công'),('timesheet.lock','timesheet','Khóa kỳ công'),('timesheet.unlock','timesheet','Mở khóa kỳ công'),
('timesheet.export','timesheet','Xuất tổng hợp bảng công'),('timesheet.export_detail','timesheet','Xuất chi tiết bảng công'),
('attendance.raw.view','timesheet','Xem sự kiện chấm công gốc'),('attendance.photo.view','timesheet','Xem ảnh chấm công'),
('export_template.view','reports','Xem mẫu xuất'),('export_template.manage','reports','Quản lý mẫu xuất'),
('report.employee_basic','reports','Xuất nhân sự cơ bản'),('report.employee_sensitive','reports','Xuất nhân sự nhạy cảm'),('leave.export','reports','Xuất dữ liệu nghỉ phép')
on conflict(key) do update set module=excluded.module,description=excluded.description;
insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r cross join public.permissions p where r.code='admin' and p.module in ('timesheet','reports') on conflict do nothing;
insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r join public.permissions p on p.key=any(array['timesheet.view','timesheet.self.view']) where r.code in ('employee','supervisor') on conflict do nothing;
insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r join public.permissions p on p.key=any(array['timesheet.view','shift.view','shift.manage','timesheet.self.view','timesheet.view_all','timesheet.adjust','timesheet.lock','timesheet.unlock','timesheet.export','timesheet.export_detail','attendance.raw.view','attendance.photo.view','export_template.view','export_template.manage','report.employee_basic','report.employee_sensitive','leave.export']) where r.code='hr' on conflict do nothing;

insert into public.shifts(id,code,name,start_time,end_time,break_minutes,late_grace_minutes,early_leave_grace_minutes)
values('d0000000-0000-4000-8000-000000000001','OFFICE','Ca hành chính','08:00','17:00',60,5,5) on conflict do nothing;
insert into public.shift_assignments(shift_id,scope_type,effective_from,weekdays)
select 'd0000000-0000-4000-8000-000000000001','company','2020-01-01',array[1,2,3,4,5]
where not exists(select 1 from public.shift_assignments where scope_type='company' and active);

insert into public.report_templates(id,code,name,report_type,definition) values
('d1000000-0000-4000-8000-000000000001','TIMESHEET_HR','Bảng công - HR','timesheet',jsonb_build_object('freezeHeader',true,'autoFilter',true,'includeBranding',true,'sheets',jsonb_build_array(
 jsonb_build_object('key','summary','name','01_Tong_hop_cong','enabled',true),jsonb_build_object('key','daily','name','02_Chi_tiet_cong','enabled',true),jsonb_build_object('key','events','name','03_Lich_su_cham_cong','enabled',true),jsonb_build_object('key','leave','name','04_Don_nghi','enabled',true),jsonb_build_object('key','balance','name','05_Phep_nam','enabled',true),jsonb_build_object('key','ledger','name','06_Lich_su_phep','enabled',false)))),
('d1000000-0000-4000-8000-000000000002','EMPLOYEE_BASIC','Nhân sự cơ bản','employee_list',jsonb_build_object('freezeHeader',true,'autoFilter',true,'sheets',jsonb_build_array(jsonb_build_object('key','employees','name','Nhan_su','enabled',true)))),
('d1000000-0000-4000-8000-000000000003','EMPLOYEE_PROFILE','Hồ sơ nhân viên','employee_profile',jsonb_build_object('freezeHeader',true,'autoFilter',true,'sheets',jsonb_build_array(jsonb_build_object('key','profile','name','01_Ho_so','enabled',true),jsonb_build_object('key','history','name','02_Qua_trinh','enabled',true))))
on conflict(code) do nothing;
insert into public.report_template_versions(template_id,version,snapshot)
select id,version,definition from public.report_templates on conflict do nothing;
