-- HR closes attendance; preparation is durable and never publishes a payslip.
create table public.payroll_timesheet_handoffs (
  timesheet_period_id uuid primary key references public.timesheet_periods(id) on delete cascade,
  timesheet_version integer not null,
  actor_account_id uuid not null references public.app_accounts(id),
  payroll_period_id uuid references public.payroll_periods(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','ready','attention','waiting')),
  last_error text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payroll_timesheet_handoffs enable row level security;
revoke all on public.payroll_timesheet_handoffs from public,anon,authenticated;
grant all on public.payroll_timesheet_handoffs to service_role;

create function public.queue_timesheet_payroll_handoff()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='locked' and (old.status is distinct from new.status or old.version is distinct from new.version) then
    insert into payroll_timesheet_handoffs(timesheet_period_id,timesheet_version,actor_account_id)
    values(new.id,new.version,new.locked_by)
    on conflict(timesheet_period_id) do update set timesheet_version=excluded.timesheet_version,
      actor_account_id=excluded.actor_account_id,status='pending',last_error=null,attempts=0,next_attempt_at=now(),updated_at=now();
  elsif new.status<>'locked' then
    update payroll_timesheet_handoffs set status='waiting',updated_at=now() where timesheet_period_id=new.id;
  end if;
  return new;
end $$;
create trigger timesheet_payroll_handoff after update of status,version on public.timesheet_periods
  for each row execute function public.queue_timesheet_payroll_handoff();

create function public.prepare_timesheet_payroll(p_timesheet_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare h payroll_timesheet_handoffs%rowtype; t timesheet_periods%rowtype; p payroll_periods%rowtype; v_error text;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('payroll-handoff:'||p_timesheet_id::text,0)) then
    return jsonb_build_object('status','pending');
  end if;
  select * into h from payroll_timesheet_handoffs where timesheet_period_id=p_timesheet_id;
  if not found then return jsonb_build_object('status','waiting'); end if;
  -- Do not lock the queue before the timesheet: closing HR transactions also
  -- touch the queue and must not deadlock with background preparation.
  select * into t from timesheet_periods where id=p_timesheet_id for share;
  if not found or t.status<>'locked' then return jsonb_build_object('status','waiting'); end if;
  select * into p from payroll_periods where timesheet_period_id=t.id for update;
  if not found then
    insert into payroll_periods(period_month,timesheet_period_id,created_by)
      values(date_trunc('month',t.start_date)::date,t.id,h.actor_account_id)
      on conflict(period_month) do nothing returning * into p;
    if not found then
      select * into p from payroll_periods where period_month=date_trunc('month',t.start_date)::date;
      update payroll_timesheet_handoffs set payroll_period_id=p.id,status='attention',last_error='PAYROLL_MONTH_CONFLICT',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',updated_at=now() where timesheet_period_id=t.id;
      return jsonb_build_object('status','attention','payrollPeriodId',p.id);
    end if;
  end if;
  if p.status in ('locked','published') then
    update payroll_timesheet_handoffs set payroll_period_id=p.id,status='ready',last_error=null,updated_at=now() where timesheet_period_id=t.id;
    return jsonb_build_object('status','ready','payrollPeriodId',p.id);
  end if;
  if h.status='ready' and p.calculated_timesheet_version=t.version and p.status<>'draft' then
    return jsonb_build_object('status','ready','payrollPeriodId',p.id);
  end if;
  begin
    perform operate_payroll_period(p.id,p.row_version,h.actor_account_id,'calculate',jsonb_build_object('payBasis',p.pay_basis));
  exception when others then
    get stacked diagnostics v_error=message_text;
    update payroll_timesheet_handoffs set payroll_period_id=p.id,status='attention',last_error=left(v_error,300),attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',updated_at=now() where timesheet_period_id=t.id;
    return jsonb_build_object('status','attention','payrollPeriodId',p.id);
  end;
  update payroll_timesheet_handoffs set payroll_period_id=p.id,timesheet_version=t.version,status='ready',last_error=null,attempts=attempts+1,updated_at=now() where timesheet_period_id=t.id;
  return jsonb_build_object('status','ready','payrollPeriodId',p.id);
end $$;

create function public.process_payroll_timesheet_handoffs()
returns integer language plpgsql security invoker set search_path=public as $$
declare h record; v_count integer:=0;
begin
  for h in select timesheet_period_id from payroll_timesheet_handoffs where status in ('pending','attention') and next_attempt_at<=now() order by updated_at limit 10 loop
    begin
      perform prepare_timesheet_payroll(h.timesheet_period_id); v_count:=v_count+1;
    exception when others then
      update payroll_timesheet_handoffs set status='attention',last_error='PAYROLL_PREPARATION_FAILED',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes',updated_at=now() where timesheet_period_id=h.timesheet_period_id;
    end;
  end loop;
  return v_count;
end $$;

create function public.approve_payroll_salary(p_period_id uuid,p_row_version integer,p_actor_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare p payroll_periods%rowtype;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'VERSION_CONFLICT'; end if;
  if p.status in ('locked','published') then return; end if;
  if p.status='draft' then
    perform operate_payroll_period(p.id,p.row_version,p_actor_id,'calculate',jsonb_build_object('payBasis',p.pay_basis));
    select * into p from payroll_periods where id=p.id;
  end if;
  if p.status='calculated' then
    perform operate_payroll_period(p.id,p.row_version,p_actor_id,'review','{}');
    select * into p from payroll_periods where id=p.id;
  end if;
  perform operate_payroll_period(p.id,p.row_version,p_actor_id,'lock','{}');
  update payroll_timesheet_handoffs set status='ready',last_error=null,updated_at=now()
    where payroll_period_id=p.id and timesheet_period_id=p.timesheet_period_id;
end $$;

create function public.amend_payroll_salary(p_period_id uuid,p_row_version integer,p_actor_id uuid,p_values jsonb)
returns void language plpgsql security invoker set search_path=public as $$
declare p payroll_periods%rowtype;
begin
  select * into p from payroll_periods where id=p_period_id for update;
  if not found or p.row_version<>p_row_version then raise exception 'VERSION_CONFLICT'; end if;
  if p.status='published' or exists(select 1 from payslips s join payroll_lines l on l.id=s.payroll_line_id where l.payroll_period_id=p.id and s.status='published') then raise exception 'PAYROLL_PUBLISHED'; end if;
  if p.status='locked' then
    perform reopen_payroll_period(p.id,p.row_version,p_actor_id,p_values->>'reason');
    select * into p from payroll_periods where id=p.id;
  end if;
  perform operate_payroll_period(p.id,p.row_version,p_actor_id,'update_line',p_values);
  update payroll_periods set locked_at=null,locked_by=null,reviewed_at=null,reviewed_by=null where id=p.id;
end $$;

revoke all on function public.queue_timesheet_payroll_handoff(),public.prepare_timesheet_payroll(uuid),public.process_payroll_timesheet_handoffs(),public.approve_payroll_salary(uuid,integer,uuid),public.amend_payroll_salary(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.queue_timesheet_payroll_handoff(),public.prepare_timesheet_payroll(uuid),public.process_payroll_timesheet_handoffs(),public.approve_payroll_salary(uuid,integer,uuid),public.amend_payroll_salary(uuid,integer,uuid,jsonb) to service_role;
select cron.schedule('ct-payroll-timesheet-handoffs','* * * * *','select public.process_payroll_timesheet_handoffs();');
create trigger payroll_periods_realtime_invalidation after insert or update on public.payroll_periods
  for each row execute function public.enqueue_realtime_invalidation('dashboard','payroll.view','');
