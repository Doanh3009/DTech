-- Atomic payroll operations and traceable timesheet inputs. Existing amounts are preserved.
alter table public.payroll_periods add column if not exists calculated_timesheet_version integer;
alter table public.payroll_periods add column if not exists pay_basis text not null default 'actual' check (pay_basis in ('actual','paid_time'));
alter table public.payroll_lines add column if not exists is_included boolean not null default true;

create or replace function public.inspect_payroll_inputs(p_period_id uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
select jsonb_build_object(
  'timesheetId', t.id, 'timesheetName', t.name, 'timesheetStatus', t.status,
  'timesheetVersion', t.version, 'calculatedTimesheetVersion', p.calculated_timesheet_version,
  'startDate', t.start_date, 'endDate', t.end_date, 'payBasis', p.pay_basis,
  'openHighExceptions', (select count(*) from timesheet_exceptions x where x.period_id=t.id and x.status='open' and x.severity='high'),
  'employees', coalesce((select jsonb_agg(jsonb_build_object(
    'employeeId', s.employee_id, 'employeeCode', e.employee_code, 'employeeName', e.full_name,
    'scheduledWorkdays', s.scheduled_workdays, 'actualWorkdays', s.actual_workdays,
    'annualLeaveDays', s.annual_leave_days, 'businessTripDays', s.business_trip_days,
    'dailyCount', d.day_count, 'dailyWorkdays', d.actual_days, 'businessTripExtraDays', d.trip_extra,
    'salaryHistoryId', h.id, 'effectiveDate', h.effective_date,
    'contractSalary', coalesce(h.base_salary,0), 'allowance', coalesce(h.allowance,0),
    'bonus', coalesce(h.bonus,0), 'deduction', coalesce(h.deduction,0)
  ) order by e.employee_code)
  from timesheet_period_summaries s join employees e on e.id=s.employee_id
  left join lateral (select count(*) day_count, coalesce(sum(work_fraction),0) actual_days,
    coalesce(sum(case when status='business_trip' then greatest(0,1-work_fraction) else 0 end),0) trip_extra
    from daily_timesheets where period_id=t.id and employee_id=s.employee_id and work_date between t.start_date and t.end_date) d on true
  left join lateral (select * from employee_salary_history where employee_id=s.employee_id and effective_date<=t.end_date
    order by effective_date desc, changed_at desc, id desc limit 1) h on true
  where s.period_id=t.id), '[]'::jsonb)
) from payroll_periods p left join timesheet_periods t on t.id=p.timesheet_period_id where p.id=p_period_id;
$$;

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
      not exists(select 1 from jsonb_array_elements(v->'employees') e where e->>'employeeId'=l.employee_id::text and e->>'salaryHistoryId'=l.calculation_snapshot->>'salaryHistoryId'))
      then raise exception 'PAYROLL_STALE_SALARY'; end if;
    if (select count(*) from payroll_lines where payroll_period_id=p_period_id and is_included)<>jsonb_array_length(v->'employees') then raise exception 'PAYROLL_ROSTER_MISMATCH'; end if;
    if exists(select 1 from payroll_lines where payroll_period_id=p_period_id and is_included and net_salary<0) then raise exception 'PAYROLL_NEGATIVE_NET'; end if;
  end if;
  return v;
end $$;

create or replace function public.operate_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid,p_action text,p_values jsonb default '{}'::jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare p payroll_periods%rowtype; t timesheet_periods%rowtype; inputs jsonb; e jsonb;
  v_basis text; paid_leave numeric; trip_extra numeric; payable numeric; ratio numeric; v_line_id uuid;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'VERSION_CONFLICT'; end if;
  select * into t from timesheet_periods where id=p.timesheet_period_id for share;
  if p_action='calculate' then
    if p.status not in ('draft','calculated','reviewed') then raise exception 'PAYROLL_LOCKED'; end if;
    inputs:=assert_payroll_inputs(p.id,false);
    v_basis:=coalesce(p_values->>'payBasis',p.pay_basis);
    if v_basis not in ('actual','paid_time') then raise exception 'PAYROLL_INVALID_BASIS'; end if;
    update payroll_lines set is_included=false where payroll_period_id=p.id and is_included and employee_id::text not in
      (select value->>'employeeId' from jsonb_array_elements(inputs->'employees'));
    for e in select value from jsonb_array_elements(inputs->'employees') loop
      paid_leave:=case when v_basis='paid_time' then (e->>'annualLeaveDays')::numeric else 0 end;
      trip_extra:=case when v_basis='paid_time' then (e->>'businessTripExtraDays')::numeric else 0 end;
      payable:=least((e->>'scheduledWorkdays')::numeric,(e->>'actualWorkdays')::numeric+paid_leave+trip_extra);
      ratio:=payable/(e->>'scheduledWorkdays')::numeric;
      insert into payroll_lines(payroll_period_id,employee_id,work_days,base_salary,allowance,bonus,deduction,calculation_snapshot,is_included)
      values(p.id,(e->>'employeeId')::uuid,(e->>'actualWorkdays')::numeric,round((e->>'contractSalary')::numeric*ratio),
        (e->>'allowance')::numeric,(e->>'bonus')::numeric,(e->>'deduction')::numeric,
        e||jsonb_build_object('timesheetPeriodId',t.id,'timesheetVersion',t.version,'payBasis',v_basis,'paidLeaveDays',paid_leave,
          'businessTripPayDays',trip_extra,'payableWorkdays',payable,'ratio',ratio,'calculatedAt',now()),true)
      on conflict(payroll_period_id,employee_id) do update set work_days=excluded.work_days,base_salary=excluded.base_salary,
        allowance=excluded.allowance,bonus=excluded.bonus,deduction=excluded.deduction,calculation_snapshot=excluded.calculation_snapshot,
        is_included=true,row_version=payroll_lines.row_version+1,updated_at=now();
    end loop;
    update payroll_periods set status='calculated',pay_basis=v_basis,calculated_timesheet_version=t.version,
      calculated_at=now(),calculated_by=p_actor_id,reviewed_at=null,reviewed_by=null,locked_at=null,locked_by=null,
      row_version=row_version+1,updated_at=now() where id=p.id;
  elsif p_action='update_line' then
    if p.status not in ('calculated','reviewed') then raise exception 'PAYROLL_NOT_EDITABLE'; end if;
    if length(trim(coalesce(p_values->>'reason','')))<3 then raise exception 'REASON_REQUIRED'; end if;
    if least((p_values->>'allowance')::numeric,(p_values->>'bonus')::numeric,(p_values->>'deduction')::numeric)<0 then raise exception 'PAYROLL_INVALID_AMOUNT'; end if;
    update payroll_lines set allowance=(p_values->>'allowance')::numeric,bonus=(p_values->>'bonus')::numeric,deduction=(p_values->>'deduction')::numeric,
      row_version=row_version+1,updated_at=now(),calculation_snapshot=calculation_snapshot||jsonb_build_object('lastAdjustment',p_values->>'reason','adjustedBy',p_actor_id,'adjustedAt',now())
      where id=(p_values->>'lineId')::uuid and payroll_period_id=p.id and is_included and row_version=(p_values->>'lineRowVersion')::integer returning id into v_line_id;
    if v_line_id is null then raise exception 'VERSION_CONFLICT'; end if;
    update payroll_periods set status='calculated',reviewed_at=null,reviewed_by=null,row_version=row_version+1,updated_at=now() where id=p.id;
  elsif p_action in ('review','lock') then
    if p_action='review' and p.status<>'calculated' or p_action='lock' and p.status<>'reviewed' then raise exception 'PAYROLL_INVALID_TRANSITION'; end if;
    perform assert_payroll_inputs(p.id,true);
    if p_action='review' then update payroll_periods set status='reviewed',reviewed_at=now(),reviewed_by=p_actor_id,row_version=row_version+1,updated_at=now() where id=p.id;
    else update payroll_periods set status='locked',locked_at=now(),locked_by=p_actor_id,row_version=row_version+1,updated_at=now() where id=p.id; end if;
  else raise exception 'PAYROLL_INVALID_ACTION'; end if;
end $$;

create or replace function public.guard_payroll_workflow() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status in ('locked','published') and new.status is distinct from old.status then
    perform 1 from timesheet_periods where id=new.timesheet_period_id for share;
    perform assert_payroll_inputs(new.id,true);
  end if;
  return new;
end $$;
drop trigger if exists payroll_workflow_guard on payroll_periods;
create trigger payroll_workflow_guard before update on payroll_periods for each row execute function guard_payroll_workflow();

create or replace function public.guard_payroll_line() returns trigger language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_status payroll_status;
begin
  v_id:=case when tg_op='DELETE' then old.payroll_period_id else new.payroll_period_id end;
  select status into v_status from payroll_periods where id=v_id for update;
  if v_status in ('locked','published') then raise exception 'PAYROLL_LOCKED'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists payroll_line_guard on payroll_lines;
create trigger payroll_line_guard before insert or update or delete on payroll_lines for each row execute function guard_payroll_line();

create or replace function public.guard_timesheet_payroll_dependency() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if old.status='locked' and new.status<>'locked' and exists(select 1 from payroll_periods where timesheet_period_id=old.id and status in ('locked','published')) then
    raise exception 'PAYROLL_REOPEN_REQUIRED';
  end if;
  return new;
end $$;
drop trigger if exists timesheet_payroll_dependency on timesheet_periods;
create trigger timesheet_payroll_dependency before update on timesheet_periods for each row execute function guard_timesheet_payroll_dependency();

create or replace function public.publish_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare p payroll_periods%rowtype; v_version integer;
begin
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'VERSION_CONFLICT'; end if;
  if p.status<>'locked' then raise exception 'PAYROLL_NOT_LOCKED'; end if;
  perform 1 from timesheet_periods where id=p.timesheet_period_id for share;
  perform assert_payroll_inputs(p.id,true);
  select coalesce(max(s.version),0)+1 into v_version from payslips s join payroll_lines l on l.id=s.payroll_line_id where l.payroll_period_id=p.id;
  insert into payslips(payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
    select l.id,l.employee_id,v_version,'published',jsonb_build_object('periodMonth',p.period_month)||to_jsonb(l),now(),p_actor_id
    from payroll_lines l where l.payroll_period_id=p.id and l.is_included;
  update payroll_periods set status='published',row_version=row_version+1,updated_at=now() where id=p.id;
  return v_version;
end $$;

revoke all on function public.inspect_payroll_inputs(uuid),public.assert_payroll_inputs(uuid,boolean),public.operate_payroll_period(uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.inspect_payroll_inputs(uuid),public.assert_payroll_inputs(uuid,boolean),public.operate_payroll_period(uuid,integer,uuid,text,jsonb) to service_role;

-- Commit daily records, exceptions, summaries and the period version together.
create or replace function public.save_timesheet_computation(p_period_id uuid,p_row_version integer,p_actor_id uuid,p_daily jsonb,p_exceptions jsonb,p_summaries jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare p timesheet_periods%rowtype;
begin
  select * into p from timesheet_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'PERIOD_VERSION_CONFLICT'; end if;
  if p.status='locked' then raise exception 'PERIOD_LOCKED'; end if;
  if exists(select 1 from jsonb_array_elements(p_daily) d where (d->>'period_id')::uuid<>p.id or (d->>'work_date')::date not between p.start_date and p.end_date)
    then raise exception 'PERIOD_INVALID_DAILY'; end if;
  delete from timesheet_exceptions where period_id=p.id and status='open';
  delete from daily_timesheets d where d.period_id=p.id and not exists(select 1 from jsonb_array_elements(p_daily) j where j->>'employee_id'=d.employee_id::text and j->>'work_date'=d.work_date::text);
  insert into daily_timesheets(period_id,employee_id,work_date,employee_snapshot,shift_id,shift_snapshot,source_codes,raw_source_snapshot,
    effective_check_in,effective_check_out,work_minutes,work_fraction,leave_fraction,late_minutes,early_leave_minutes,leave_type_code,leave_type_name,
    status,hr_note,exception_count,adjustment_snapshot,calculation_version,computed_at)
  select period_id,employee_id,work_date,employee_snapshot,shift_id,shift_snapshot,source_codes,raw_source_snapshot,
    effective_check_in,effective_check_out,work_minutes,work_fraction,leave_fraction,late_minutes,early_leave_minutes,leave_type_code,leave_type_name,
    status,hr_note,exception_count,adjustment_snapshot,calculation_version,computed_at from jsonb_populate_recordset(null::daily_timesheets,p_daily)
  on conflict(period_id,employee_id,work_date) do update set
    employee_snapshot=excluded.employee_snapshot,shift_id=excluded.shift_id,shift_snapshot=excluded.shift_snapshot,source_codes=excluded.source_codes,
    raw_source_snapshot=excluded.raw_source_snapshot,effective_check_in=excluded.effective_check_in,effective_check_out=excluded.effective_check_out,
    work_minutes=excluded.work_minutes,work_fraction=excluded.work_fraction,leave_fraction=excluded.leave_fraction,late_minutes=excluded.late_minutes,
    early_leave_minutes=excluded.early_leave_minutes,leave_type_code=excluded.leave_type_code,leave_type_name=excluded.leave_type_name,status=excluded.status,
    hr_note=excluded.hr_note,exception_count=excluded.exception_count,adjustment_snapshot=excluded.adjustment_snapshot,
    calculation_version=daily_timesheets.calculation_version+1,computed_at=excluded.computed_at;
  insert into timesheet_exceptions(period_id,daily_timesheet_id,employee_id,work_date,exception_type,severity,details)
    select p.id,d.id,d.employee_id,d.work_date,(j->>'exception_type')::timesheet_exception_type,j->>'severity',j->'details'
    from jsonb_array_elements(p_exceptions) j join daily_timesheets d on d.period_id=p.id and d.employee_id=(j->>'employee_id')::uuid and d.work_date=(j->>'work_date')::date
    on conflict(daily_timesheet_id,exception_type) do nothing;
  delete from timesheet_period_summaries where period_id=p.id;
  insert into timesheet_period_summaries(period_id,employee_id,employee_snapshot,scheduled_workdays,actual_workdays,worked_minutes,late_days,late_minutes,
    early_leave_days,early_leave_minutes,annual_leave_days,unpaid_leave_days,absent_days,business_trip_days,holiday_days,missing_check_in_days,missing_check_out_days,exception_count,computed_at)
  select period_id,employee_id,employee_snapshot,scheduled_workdays,actual_workdays,worked_minutes,late_days,late_minutes,
    early_leave_days,early_leave_minutes,annual_leave_days,unpaid_leave_days,absent_days,business_trip_days,holiday_days,missing_check_in_days,missing_check_out_days,exception_count,computed_at
    from jsonb_populate_recordset(null::timesheet_period_summaries,p_summaries);
  update timesheet_periods set status='reviewing' where id=p.id;
end $$;
revoke all on function public.save_timesheet_computation(uuid,integer,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_timesheet_computation(uuid,integer,uuid,jsonb,jsonb,jsonb) to service_role;

-- Guard all existing callers, including the lock RPC, against empty or inconsistent sources.
create or replace function public.guard_timesheet_close() returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='locked' and old.status<>'locked' then
    if not exists(select 1 from timesheet_period_summaries where period_id=new.id) then raise exception 'PERIOD_EMPTY'; end if;
    if exists(select 1 from timesheet_period_summaries s left join lateral (
      select count(*) n,coalesce(sum(work_fraction),0) actual from daily_timesheets where period_id=s.period_id and employee_id=s.employee_id
    ) d on true where s.period_id=new.id and (d.n=0 or abs(d.actual-s.actual_workdays)>.01)) then raise exception 'PERIOD_SOURCE_MISMATCH'; end if;
  end if;
  return new;
end $$;
drop trigger if exists timesheet_close_guard on timesheet_periods;
create trigger timesheet_close_guard before update on timesheet_periods for each row execute function guard_timesheet_close();

create or replace function public.guard_timesheet_adjustment() returns trigger language plpgsql security invoker set search_path=public as $$
declare p timesheet_periods%rowtype;
begin
  select * into p from timesheet_periods where id=new.period_id for update;
  if not found or p.status='locked' then raise exception 'PERIOD_LOCKED'; end if;
  if new.work_date not between p.start_date and p.end_date then raise exception 'PERIOD_INVALID_DATE'; end if;
  if (new.after_snapshot->>'rowVersion')::integer is distinct from p.row_version then raise exception 'PERIOD_VERSION_CONFLICT'; end if;
  update timesheet_periods set status='reviewing' where id=p.id;
  return new;
end $$;
drop trigger if exists timesheet_adjustment_guard on timesheet_adjustments;
create trigger timesheet_adjustment_guard before insert on timesheet_adjustments for each row execute function guard_timesheet_adjustment();
