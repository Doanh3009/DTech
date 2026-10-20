-- Keep the employee role as a default business role, not a second role attached
-- to every employee account. Linked employees receive self-service permissions
-- through the application access policy.
delete from public.account_roles employee_assignment
using public.roles employee_role, public.app_accounts account
where employee_assignment.role_id = employee_role.id
  and employee_role.code = 'employee'
  and account.id = employee_assignment.account_id
  and account.employee_id is not null
  and exists (
    select 1
    from public.account_roles business_assignment
    where business_assignment.account_id = employee_assignment.account_id
      and business_assignment.role_id <> employee_assignment.role_id
  );

-- Repair legacy or seeded locked periods that predate the immutable snapshot.
-- Export always prefers this snapshot, preserving the same contract as a normal lock.
insert into public.timesheet_period_versions (
  period_id,
  version,
  snapshot,
  created_by,
  created_at
)
select
  period.id,
  period.version,
  jsonb_build_object(
    'period', to_jsonb(period),
    'daily', coalesce((
      select jsonb_agg(to_jsonb(day_row) order by day_row.work_date, day_row.employee_id)
      from public.daily_timesheets day_row
      where day_row.period_id = period.id
    ), '[]'::jsonb),
    'summaries', coalesce((
      select jsonb_agg(to_jsonb(summary_row) order by summary_row.employee_id)
      from public.timesheet_period_summaries summary_row
      where summary_row.period_id = period.id
    ), '[]'::jsonb)
  ),
  coalesce(period.locked_by, period.created_by),
  coalesce(period.locked_at, period.updated_at, now())
from public.timesheet_periods period
where period.status = 'locked'
  and period.version > 0
  and not exists (
    select 1
    from public.timesheet_period_versions period_version
    where period_version.period_id = period.id
      and period_version.version = period.version
  )
on conflict (period_id, version) do nothing;
