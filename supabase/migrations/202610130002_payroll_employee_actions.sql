create or replace function public.operate_payroll_period(
  p_period_id uuid,
  p_row_version integer,
  p_actor_id uuid,
  p_action text,
  p_values jsonb default '{}'::jsonb
)
returns void language plpgsql security invoker set search_path=public as $$
declare
  p payroll_periods%rowtype;
  t timesheet_periods%rowtype;
  inputs jsonb;
  e jsonb;
  v_basis text;
  paid_leave numeric;
  trip_extra numeric;
  payable numeric;
  ratio numeric;
  v_line_id uuid;
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
    if least((p_values->>'baseSalary')::numeric,(p_values->>'allowance')::numeric,(p_values->>'bonus')::numeric,(p_values->>'deduction')::numeric)<0 then raise exception 'PAYROLL_INVALID_AMOUNT'; end if;
    update payroll_lines set base_salary=(p_values->>'baseSalary')::numeric,allowance=(p_values->>'allowance')::numeric,
      bonus=(p_values->>'bonus')::numeric,deduction=(p_values->>'deduction')::numeric,
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

create or replace function public.publish_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare p payroll_periods%rowtype; v_version integer;
begin
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'VERSION_CONFLICT'; end if;
  if p.status<>'locked' then raise exception 'PAYROLL_NOT_LOCKED'; end if;
  perform 1 from timesheet_periods where id=p.timesheet_period_id for share;
  perform assert_payroll_inputs(p.id,true);
  select coalesce(
    max(s.version) filter (where s.status='published'),
    max(s.version)+1,
    1
  ) into v_version
  from payslips s join payroll_lines l on l.id=s.payroll_line_id
  where l.payroll_period_id=p.id;
  insert into payslips(payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
    select l.id,l.employee_id,v_version,'published',jsonb_build_object('periodMonth',p.period_month)||to_jsonb(l),now(),p_actor_id
    from payroll_lines l where l.payroll_period_id=p.id and l.is_included
    on conflict(payroll_line_id,version) do nothing;
  update payroll_periods set status='published',row_version=row_version+1,updated_at=now() where id=p.id;
  return v_version;
end $$;

create or replace function public.publish_employee_payslip(p_period_id uuid,p_employee_id uuid,p_row_version integer,p_actor_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare p payroll_periods%rowtype; l payroll_lines%rowtype; v_version integer;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'VERSION_CONFLICT'; end if;
  if p.status<>'locked' then raise exception 'PAYROLL_NOT_LOCKED'; end if;
  perform 1 from timesheet_periods where id=p.timesheet_period_id for share;
  perform assert_payroll_inputs(p.id,true);
  select * into l from payroll_lines where payroll_period_id=p.id and employee_id=p_employee_id and is_included for share;
  if not found then raise exception 'PAYROLL_LINE_NOT_FOUND'; end if;
  select coalesce(
    max(s.version) filter (where s.status='published'),
    max(s.version)+1,
    1
  ) into v_version
  from payslips s join payroll_lines pl on pl.id=s.payroll_line_id
  where pl.payroll_period_id=p.id;
  if exists(select 1 from payslips where payroll_line_id=l.id and version=v_version and status='published') then
    raise exception 'PAYSLIP_ALREADY_PUBLISHED';
  end if;
  insert into payslips(payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
  values(l.id,l.employee_id,v_version,'published',jsonb_build_object('periodMonth',p.period_month)||to_jsonb(l),now(),p_actor_id);
  if not exists(
    select 1 from payroll_lines pl
    where pl.payroll_period_id=p.id and pl.is_included
      and not exists(select 1 from payslips ps where ps.payroll_line_id=pl.id and ps.version=v_version and ps.status='published')
  ) then
    update payroll_periods set status='published',row_version=row_version+1,updated_at=now() where id=p.id;
  else
    update payroll_periods set row_version=row_version+1,updated_at=now() where id=p.id;
  end if;
  return v_version;
end $$;

revoke all on function public.publish_payroll_period(uuid,integer,uuid),public.publish_employee_payslip(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.publish_payroll_period(uuid,integer,uuid),public.publish_employee_payslip(uuid,uuid,integer,uuid) to service_role;
