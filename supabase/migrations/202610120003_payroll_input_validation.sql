-- Avoid ambiguity between PL/pgSQL variables and JSON input row aliases.
create or replace function public.assert_payroll_inputs(p_period_id uuid, p_require_calculation boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v jsonb; e jsonb;
begin
  v:=inspect_payroll_inputs(p_period_id);
  if v is null then raise exception 'PAYROLL_NOT_FOUND'; end if;
  if v->>'timesheetStatus' is distinct from 'locked' then raise exception 'TIMESHEET_NOT_LOCKED'; end if;
  if jsonb_array_length(v->'employees')=0 then raise exception 'PAYROLL_EMPTY_INPUT'; end if;
  if (v->>'openHighExceptions')::integer>0 then raise exception 'TIMESHEET_HIGH_EXCEPTIONS'; end if;
  for e in select value from jsonb_array_elements(v->'employees') loop
    if e->>'salaryHistoryId' is null then raise exception 'PAYROLL_MISSING_SALARY'; end if;
    if (e->>'dailyCount')::integer=0 then raise exception 'TIMESHEET_MISSING_DAILY'; end if;
    if abs((e->>'dailyWorkdays')::numeric-(e->>'actualWorkdays')::numeric)>.01 then raise exception 'TIMESHEET_SUMMARY_MISMATCH'; end if;
    if (e->>'scheduledWorkdays')::numeric<=0 then raise exception 'PAYROLL_MISSING_SCHEDULE'; end if;
    if (e->>'actualWorkdays')::numeric>(e->>'scheduledWorkdays')::numeric+.01 then raise exception 'PAYROLL_EXCESS_WORKDAYS'; end if;
  end loop;
  if p_require_calculation then
    if v->>'calculatedTimesheetVersion' is null or (v->>'calculatedTimesheetVersion')::integer<>(v->>'timesheetVersion')::integer then raise exception 'PAYROLL_STALE_TIMESHEET'; end if;
    if exists(select 1 from payroll_lines l where l.payroll_period_id=p_period_id and l.is_included and
      not exists(select 1 from jsonb_array_elements(v->'employees') as input_row(value) where input_row.value->>'employeeId'=l.employee_id::text and input_row.value->>'salaryHistoryId'=l.calculation_snapshot->>'salaryHistoryId'))
      then raise exception 'PAYROLL_STALE_SALARY'; end if;
    if (select count(*) from payroll_lines where payroll_period_id=p_period_id and is_included)<>jsonb_array_length(v->'employees') then raise exception 'PAYROLL_ROSTER_MISMATCH'; end if;
    if exists(select 1 from payroll_lines where payroll_period_id=p_period_id and is_included and net_salary<0) then raise exception 'PAYROLL_NEGATIVE_NET'; end if;
  end if;
  return v;
end $$;

