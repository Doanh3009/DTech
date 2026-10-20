-- Realtime transports invalidation metadata only. Authoritative rows remain behind API/RPC and RLS.
create or replace function public.current_app_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.app_accounts where auth_user_id = auth.uid() and status = 'active' limit 1
$$;

create or replace function public.current_account_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_accounts account
    join public.account_roles assignment on assignment.account_id = account.id
    join public.roles role on role.id = assignment.role_id
    join public.role_permissions permission on permission.role_id = role.id
    where account.auth_user_id = auth.uid()
      and account.status = 'active'
      and permission.permission_key = p_permission
  )
$$;

revoke all on function public.current_app_account_id() from public;
revoke all on function public.current_account_has_permission(text) from public;
grant execute on function public.current_app_account_id() to authenticated;
grant execute on function public.current_account_has_permission(text) to authenticated;

create table if not exists public.realtime_invalidations (
  id bigint generated always as identity primary key,
  event_key uuid not null default gen_random_uuid() unique,
  audience text not null default 'authenticated' check (audience = 'authenticated'),
  domain text not null check (domain in ('approvals','attendance','dashboard','employees','import-export','leave','notifications','projects','settings','system-notices','timesheets','warehouse','worker-attendance')),
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  required_permission text references public.permissions(key),
  recipient_account_id uuid references public.app_accounts(id) on delete cascade,
  occurred_at timestamptz not null default now()
);

create index if not exists realtime_invalidations_occurred_idx on public.realtime_invalidations(occurred_at desc);
create index if not exists realtime_invalidations_recipient_idx on public.realtime_invalidations(recipient_account_id,occurred_at desc) where recipient_account_id is not null;
alter table public.realtime_invalidations enable row level security;

drop policy if exists "authorized users receive invalidations" on public.realtime_invalidations;
create policy "authorized users receive invalidations"
on public.realtime_invalidations
for select
to authenticated
using (
  public.current_app_account_id() is not null
  and (
    recipient_account_id = public.current_app_account_id()
    or required_permission is null
    or public.current_account_has_permission(required_permission)
  )
);

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications
for select
to authenticated
using (recipient_account_id = public.current_app_account_id());

create or replace function public.enqueue_realtime_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_entity_id text;
  v_recipient uuid;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_entity_id := coalesce(v_row->>'id', v_row->>'group_key', concat_ws(':',v_row->>'warehouse_id',v_row->>'item_id'), md5(v_row::text));
  if coalesce(tg_argv[2],'') <> '' and nullif(v_row->>tg_argv[2],'') is not null then
    v_recipient := (v_row->>tg_argv[2])::uuid;
  end if;
  insert into public.realtime_invalidations(domain,entity_type,entity_id,operation,required_permission,recipient_account_id)
  values(tg_argv[0],tg_table_name,v_entity_id,tg_op,nullif(tg_argv[1],''),v_recipient);
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function public.enqueue_realtime_invalidation() from public;

drop trigger if exists attendance_events_realtime_invalidation on public.attendance_events;
create trigger attendance_events_realtime_invalidation after insert or update on public.attendance_events for each row execute function public.enqueue_realtime_invalidation('attendance','attendance.view_all','account_id');
drop trigger if exists leave_requests_realtime_invalidation on public.leave_requests;
create trigger leave_requests_realtime_invalidation after insert or update on public.leave_requests for each row execute function public.enqueue_realtime_invalidation('leave','leave.view_all','created_by');
drop trigger if exists approval_cases_realtime_invalidation on public.approval_cases;
create trigger approval_cases_realtime_invalidation after insert or update on public.approval_cases for each row execute function public.enqueue_realtime_invalidation('approvals','approval.inbox.view','requester_account_id');
drop trigger if exists projects_realtime_invalidation on public.projects;
create trigger projects_realtime_invalidation after insert or update on public.projects for each row execute function public.enqueue_realtime_invalidation('projects','project.view','');
drop trigger if exists project_assignments_realtime_invalidation on public.project_assignments;
create trigger project_assignments_realtime_invalidation after insert or update or delete on public.project_assignments for each row execute function public.enqueue_realtime_invalidation('projects','project.view','');
drop trigger if exists worksites_realtime_invalidation on public.worksites;
create trigger worksites_realtime_invalidation after insert or update on public.worksites for each row execute function public.enqueue_realtime_invalidation('projects','worksite.view','');
drop trigger if exists project_updates_realtime_invalidation on public.project_updates;
create trigger project_updates_realtime_invalidation after insert or update on public.project_updates for each row execute function public.enqueue_realtime_invalidation('projects','project_update.view_project','');
drop trigger if exists project_issues_realtime_invalidation on public.project_issues;
create trigger project_issues_realtime_invalidation after insert or update on public.project_issues for each row execute function public.enqueue_realtime_invalidation('projects','project_issue.view','');
drop trigger if exists worker_sessions_realtime_invalidation on public.worker_attendance_sessions;
create trigger worker_sessions_realtime_invalidation after insert or update on public.worker_attendance_sessions for each row execute function public.enqueue_realtime_invalidation('worker-attendance','worker_attendance.view_project','');
drop trigger if exists inventory_documents_realtime_invalidation on public.inventory_documents;
create trigger inventory_documents_realtime_invalidation after insert or update on public.inventory_documents for each row execute function public.enqueue_realtime_invalidation('warehouse','warehouse.view','');
drop trigger if exists inventory_balances_realtime_invalidation on public.inventory_balances;
create trigger inventory_balances_realtime_invalidation after insert or update on public.inventory_balances for each row execute function public.enqueue_realtime_invalidation('warehouse','warehouse.view','');
drop trigger if exists stock_counts_realtime_invalidation on public.stock_counts;
create trigger stock_counts_realtime_invalidation after insert or update on public.stock_counts for each row execute function public.enqueue_realtime_invalidation('warehouse','warehouse.view','');
drop trigger if exists shipments_realtime_invalidation on public.shipments;
create trigger shipments_realtime_invalidation after insert or update on public.shipments for each row execute function public.enqueue_realtime_invalidation('import-export','import_export.view','assigned_account_id');
drop trigger if exists import_contracts_realtime_invalidation on public.import_contracts;
create trigger import_contracts_realtime_invalidation after insert or update on public.import_contracts for each row execute function public.enqueue_realtime_invalidation('import-export','import_export.view','');
drop trigger if exists business_partners_realtime_invalidation on public.business_partners;
create trigger business_partners_realtime_invalidation after insert or update on public.business_partners for each row execute function public.enqueue_realtime_invalidation('import-export','partner.view','');
drop trigger if exists employees_realtime_invalidation on public.employees;
create trigger employees_realtime_invalidation after insert or update on public.employees for each row execute function public.enqueue_realtime_invalidation('employees','employee.view','');
drop trigger if exists shifts_realtime_invalidation on public.shifts;
create trigger shifts_realtime_invalidation after insert or update on public.shifts for each row execute function public.enqueue_realtime_invalidation('timesheets','shift.view','');
drop trigger if exists shift_assignments_realtime_invalidation on public.shift_assignments;
create trigger shift_assignments_realtime_invalidation after insert or update or delete on public.shift_assignments for each row execute function public.enqueue_realtime_invalidation('timesheets','shift.view','');
drop trigger if exists timesheet_periods_realtime_invalidation on public.timesheet_periods;
create trigger timesheet_periods_realtime_invalidation after insert or update on public.timesheet_periods for each row execute function public.enqueue_realtime_invalidation('timesheets','timesheet.view','');
drop trigger if exists timesheet_exceptions_realtime_invalidation on public.timesheet_exceptions;
create trigger timesheet_exceptions_realtime_invalidation after insert or update on public.timesheet_exceptions for each row execute function public.enqueue_realtime_invalidation('timesheets','timesheet.view','');
drop trigger if exists work_calendar_days_realtime_invalidation on public.work_calendar_days;
create trigger work_calendar_days_realtime_invalidation after insert or update or delete on public.work_calendar_days for each row execute function public.enqueue_realtime_invalidation('timesheets','timesheet.view','');
drop trigger if exists system_settings_realtime_invalidation on public.system_settings;
create trigger system_settings_realtime_invalidation after insert or update on public.system_settings for each row execute function public.enqueue_realtime_invalidation('settings','','');
drop trigger if exists system_notices_realtime_invalidation on public.system_notices;
create trigger system_notices_realtime_invalidation after insert or update on public.system_notices for each row execute function public.enqueue_realtime_invalidation('system-notices','','');

create or replace function public.purge_realtime_invalidations(p_before timestamptz default now() - interval '2 days')
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_count bigint;
begin
  delete from public.realtime_invalidations where occurred_at < p_before;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
revoke all on function public.purge_realtime_invalidations(timestamptz) from public, anon, authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'realtime_invalidations') then
      alter publication supabase_realtime add table public.realtime_invalidations;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
  end if;
end
$$;
