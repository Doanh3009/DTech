-- Unused leave is paid in December payroll. HR supplies a separate daily rate.
-- No balances are carried forward and no locked payroll is changed by the job.
create table public.leave_cashout_rates (
  employee_id uuid not null references public.employees(id),
  leave_type_id uuid not null references public.leave_types(id),
  leave_year integer not null check (leave_year between 2000 and 2200),
  daily_rate numeric(18,0) not null check (daily_rate > 0 and daily_rate <= 1000000000),
  row_version integer not null default 1,
  reason text not null check (length(trim(reason)) >= 3),
  updated_by uuid not null references public.app_accounts(id),
  updated_at timestamptz not null default now(),
  primary key(employee_id,leave_type_id,leave_year)
);
create table public.leave_year_end_settlements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id),
  leave_type_id uuid not null references public.leave_types(id),
  leave_year integer not null check (leave_year between 2000 and 2200),
  days numeric(9,2) not null check (days > 0),
  daily_rate numeric(18,0) not null check (daily_rate > 0),
  amount numeric(20,0) not null check (amount > 0),
  rate_version integer not null,
  payroll_line_id uuid not null references public.payroll_lines(id) on delete restrict,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(employee_id,leave_type_id,leave_year)
);
create table public.leave_cashout_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb not null default '{}'::jsonb
);
alter table public.leave_cashout_rates enable row level security;
alter table public.leave_year_end_settlements enable row level security;
alter table public.leave_cashout_runs enable row level security;
revoke all on public.leave_cashout_rates,public.leave_year_end_settlements,public.leave_cashout_runs from anon,authenticated;
grant all on public.leave_cashout_rates,public.leave_year_end_settlements,public.leave_cashout_runs to service_role;
alter table public.payroll_lines add column leave_cashout_amount numeric(20,0) not null default 0 check (leave_cashout_amount >= 0);
update public.leave_policies set carryover_enabled=false,carryover_max_days=0,carryover_expiry_month=null,carryover_expiry_day=null;

create function public.save_leave_cashout_rate(
  p_employee_id uuid,p_leave_type_id uuid,p_year integer,p_daily_rate numeric,
  p_expected_version integer,p_reason text,p_actor_id uuid
) returns integer language plpgsql security definer set search_path=public as $$
declare v_current leave_cashout_rates%rowtype; v_version integer;
begin
  if not exists(select 1 from app_accounts a join account_roles ar on ar.account_id=a.id join role_permissions rp on rp.role_id=ar.role_id
    where a.id=p_actor_id and a.status='active' and rp.permission_key='leave.balance.adjust') then raise exception 'CASHOUT_ACTOR_DENIED'; end if;
  if p_employee_id is null or p_leave_type_id is null or p_year is null or p_daily_rate is null or p_year not between 2000 and 2200 or p_daily_rate<=0 or p_daily_rate>1000000000 or p_daily_rate<>round(p_daily_rate) or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'CASHOUT_INVALID_RATE'; end if;
  if not exists(select 1 from leave_types where id=p_leave_type_id and deducts_balance) and not exists(select 1 from leave_ledger where employee_id=p_employee_id and leave_type_id=p_leave_type_id and leave_year=p_year) then raise exception 'CASHOUT_INVALID_TYPE'; end if;
  perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||p_employee_id::text,0));
  if exists(select 1 from leave_year_end_settlements where employee_id=p_employee_id and leave_type_id=p_leave_type_id and leave_year=p_year) then raise exception 'LEAVE_YEAR_SETTLED'; end if;
  select * into v_current from leave_cashout_rates where employee_id=p_employee_id and leave_type_id=p_leave_type_id and leave_year=p_year for update;
  if (found and v_current.row_version is distinct from p_expected_version) or (not found and p_expected_version is not null) then raise exception 'VERSION_CONFLICT'; end if;
  insert into leave_cashout_rates(employee_id,leave_type_id,leave_year,daily_rate,reason,updated_by)
  values(p_employee_id,p_leave_type_id,p_year,p_daily_rate,p_reason,p_actor_id)
  on conflict(employee_id,leave_type_id,leave_year) do update set daily_rate=excluded.daily_rate,reason=excluded.reason,
    updated_by=excluded.updated_by,updated_at=now(),row_version=leave_cashout_rates.row_version+1 returning row_version into v_version;
  insert into audit_logs(actor_account_id,action,entity_type,entity_id,before_data,after_data,reason)
  values(p_actor_id,'leave.cashout_rate_saved','employee',p_employee_id,case when v_current.employee_id is not null then to_jsonb(v_current) end,
    jsonb_build_object('year',p_year,'leaveTypeId',p_leave_type_id,'dailyRate',p_daily_rate,'version',v_version),p_reason);
  return v_version;
end $$;

create function public.guard_settled_leave_ledger() returns trigger language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||new.employee_id::text,0));
  if new.reference_type<>'leave_year_end_cashout' and exists(select 1 from leave_year_end_settlements s where s.employee_id=new.employee_id and s.leave_type_id=new.leave_type_id and s.leave_year=new.leave_year) then raise exception 'LEAVE_YEAR_SETTLED'; end if;
  return new;
end $$;
create trigger leave_ledger_cashout_guard before insert on public.leave_ledger for each row execute function public.guard_settled_leave_ledger();

create function public.guard_settled_leave_request() returns trigger language plpgsql set search_path=public as $$
begin
  if new.status in ('draft','submitted','pending_approval','approved') then
    if tg_op='INSERT' or new.status is distinct from old.status or new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date or new.leave_type_id is distinct from old.leave_type_id then
      perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||new.employee_id::text,0));
      if exists(select 1 from leave_year_end_settlements where employee_id=new.employee_id and leave_type_id=new.leave_type_id and leave_year=extract(year from new.start_date)::integer) then raise exception 'LEAVE_YEAR_SETTLED'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger leave_requests_cashout_guard before insert or update on public.leave_requests for each row execute function public.guard_settled_leave_request();

create function public.guard_cashout_payroll_line() returns trigger language plpgsql set search_path=public as $$
begin
  if old.leave_cashout_amount>0 and not new.is_included then raise exception 'CASHOUT_EMPLOYEE_REMOVAL'; end if;
  return new;
end $$;
create trigger payroll_lines_cashout_guard before update on public.payroll_lines for each row execute function public.guard_cashout_payroll_line();

-- The period is always locked before employee advisory locks, including cron.
create function public.attach_leave_year_end_cashout(p_period_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare p payroll_periods%rowtype; v_year integer; r record; rate leave_cashout_rates%rowtype;
  v_days numeric; v_id uuid; v_amount numeric; v_added integer:=0; l record; v_total numeric; v_snap jsonb;
begin
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or extract(month from p.period_month)<>12 then return 0; end if;
  v_year:=extract(year from p.period_month)::integer;
  if v_year>=extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer or p.status not in ('calculated','reviewed') then return 0; end if;
  for r in select ledger.employee_id,ledger.leave_type_id from leave_ledger ledger
    join payroll_lines pl on pl.employee_id=ledger.employee_id and pl.payroll_period_id=p.id and pl.is_included
    where ledger.leave_year=v_year group by ledger.employee_id,ledger.leave_type_id having sum(ledger.amount)>0
    order by ledger.employee_id,ledger.leave_type_id loop
    perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||r.employee_id::text,0));
    if exists(select 1 from leave_year_end_settlements where employee_id=r.employee_id and leave_type_id=r.leave_type_id and leave_year=v_year) then continue; end if;
    if exists(select 1 from leave_requests where employee_id=r.employee_id and leave_type_id=r.leave_type_id and status in ('submitted','pending_approval') and start_date<=make_date(v_year,12,31) and end_date>=make_date(v_year,1,1)) then continue; end if;
    select * into rate from leave_cashout_rates where employee_id=r.employee_id and leave_type_id=r.leave_type_id and leave_year=v_year for share;
    if not found then continue; end if;
    select coalesce(sum(amount),0) into v_days from leave_ledger where employee_id=r.employee_id and leave_type_id=r.leave_type_id and leave_year=v_year;
    if v_days<=0 then continue; end if;
    select id into v_id from payroll_lines where payroll_period_id=p.id and employee_id=r.employee_id and is_included for update;
    v_amount:=round(v_days*rate.daily_rate);
    if v_amount<1 then continue; end if;
    insert into leave_year_end_settlements(employee_id,leave_type_id,leave_year,days,daily_rate,amount,rate_version,payroll_line_id,snapshot)
    values(r.employee_id,r.leave_type_id,v_year,v_days,rate.daily_rate,v_amount,rate.row_version,v_id,
      jsonb_build_object('days',v_days,'dailyRate',rate.daily_rate,'rateVersion',rate.row_version,'rateSetBy',rate.updated_by,'rateSetAt',rate.updated_at,'rateReason',rate.reason,'year',v_year,'leaveTypeId',r.leave_type_id,
        'leaveTypeName',(select name from leave_types where id=r.leave_type_id),'leaveTypeCode',(select code from leave_types where id=r.leave_type_id))) returning id into v_id;
    insert into leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason)
    values(r.employee_id,v_year,r.leave_type_id,'adjustment_subtract',-v_days,'leave_year_end_cashout',v_id::text,make_date(v_year,12,31),'Thanh toán phép dư cuối năm '||v_year);
    v_added:=v_added+1;
  end loop;
  for l in select pl.id,pl.leave_cashout_amount,pl.calculation_snapshot from payroll_lines pl where pl.payroll_period_id=p.id and pl.is_included order by pl.id for update loop
    select coalesce(sum(amount),0),coalesce(jsonb_agg(snapshot order by leave_type_id),'[]'::jsonb) into v_total,v_snap from leave_year_end_settlements where payroll_line_id=l.id;
    if l.leave_cashout_amount is distinct from v_total or (v_total>0 and l.calculation_snapshot->'leaveCashout' is distinct from v_snap) then
      update payroll_lines set bonus=bonus-leave_cashout_amount+v_total,leave_cashout_amount=v_total,
        calculation_snapshot=calculation_snapshot||jsonb_build_object('leaveCashout',v_snap),row_version=row_version+1,updated_at=now() where id=l.id;
    end if;
  end loop;
  if v_added>0 then update payroll_periods set status='calculated',reviewed_at=null,reviewed_by=null,row_version=row_version+1,updated_at=now() where id=p.id; end if;
  return v_added;
end $$;

create function public.assert_payroll_cashout_ready(p_period_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare p payroll_periods%rowtype; v_year integer;
begin
  select * into p from payroll_periods where id=p_period_id;
  if not found or extract(month from p.period_month)<>12 then return; end if;
  v_year:=extract(year from p.period_month)::integer;
  if v_year>=extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer then return; end if;
  if exists(select 1 from leave_ledger ledger join payroll_lines pl on pl.employee_id=ledger.employee_id and pl.payroll_period_id=p.id and pl.is_included
    where ledger.leave_year=v_year group by ledger.employee_id,ledger.leave_type_id having sum(ledger.amount)>0) then raise exception 'CASHOUT_NOT_READY'; end if;
end $$;

alter function public.operate_payroll_period(uuid,integer,uuid,text,jsonb) rename to operate_payroll_period_before_cashout;
revoke all on function public.operate_payroll_period_before_cashout(uuid,integer,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.operate_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid,p_action text,p_values jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_amount numeric;
begin
  perform 1 from payroll_periods where id=p_period_id for update;
  if p_action='update_line' then
    select leave_cashout_amount into v_amount from payroll_lines where id=(p_values->>'lineId')::uuid and payroll_period_id=p_period_id;
    p_values:=p_values||jsonb_build_object('bonus',(p_values->>'bonus')::numeric+coalesce(v_amount,0));
  end if;
  if p_action in ('review','lock') then perform assert_payroll_cashout_ready(p_period_id); end if;
  perform operate_payroll_period_before_cashout(p_period_id,p_row_version,p_actor_id,p_action,p_values);
  if p_action='calculate' then
    update payroll_lines set bonus=bonus+leave_cashout_amount where payroll_period_id=p_period_id and leave_cashout_amount>0;
    perform attach_leave_year_end_cashout(p_period_id);
  end if;
end $$;

alter function public.publish_payroll_period(uuid,integer,uuid) rename to publish_payroll_period_before_cashout;
alter function public.publish_employee_payslip(uuid,uuid,integer,uuid) rename to publish_employee_payslip_before_cashout;
revoke all on function public.publish_payroll_period_before_cashout(uuid,integer,uuid),public.publish_employee_payslip_before_cashout(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
create function public.publish_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
begin
  perform 1 from payroll_periods where id=p_period_id for update;
  perform assert_payroll_cashout_ready(p_period_id);
  return publish_payroll_period_before_cashout(p_period_id,p_row_version,p_actor_id);
end $$;
create function public.publish_employee_payslip(p_period_id uuid,p_employee_id uuid,p_row_version integer,p_actor_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
begin
  perform 1 from payroll_periods where id=p_period_id for update;
  perform assert_payroll_cashout_ready(p_period_id);
  return publish_employee_payslip_before_cashout(p_period_id,p_employee_id,p_row_version,p_actor_id);
end $$;

create function public.process_leave_year_end_cashout() returns jsonb language plpgsql security definer set search_path=public as $$
declare v_run uuid; p record; v_added integer:=0; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('leave-year-end-cashout-job',0));
  insert into leave_cashout_runs default values returning id into v_run;
  for p in select id from payroll_periods where extract(month from period_month)=12
    and extract(year from period_month)<extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))
    and status in ('calculated','reviewed') order by period_month,id loop
    v_added:=v_added+attach_leave_year_end_cashout(p.id);
  end loop;
  v_result:=jsonb_build_object('settlementsAdded',v_added,'checkedAt',now());
  update leave_cashout_runs set finished_at=now(),result=v_result where id=v_run;
  return v_result;
end $$;

revoke all on function public.save_leave_cashout_rate(uuid,uuid,integer,numeric,integer,text,uuid),public.attach_leave_year_end_cashout(uuid),public.process_leave_year_end_cashout(),public.operate_payroll_period(uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_leave_cashout_rate(uuid,uuid,integer,numeric,integer,text,uuid),public.attach_leave_year_end_cashout(uuid),public.process_leave_year_end_cashout(),public.operate_payroll_period(uuid,integer,uuid,text,jsonb) to service_role;
revoke all on function public.assert_payroll_cashout_ready(uuid),public.publish_payroll_period(uuid,integer,uuid),public.publish_employee_payslip(uuid,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.publish_payroll_period(uuid,integer,uuid),public.publish_employee_payslip(uuid,uuid,integer,uuid) to service_role;

create extension if not exists pg_cron;
-- pg_cron is GMT. 17:05 UTC is 00:05 the following day in Vietnam.
select cron.schedule('ct-leave-year-end-cashout','5 17 * * *','select public.process_leave_year_end_cashout();');
