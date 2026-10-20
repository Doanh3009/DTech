create table public.payslip_deliveries (
  id uuid primary key default gen_random_uuid(),
  payslip_id uuid not null references public.payslips(id) on delete cascade,
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  recipient_account_id uuid not null references public.app_accounts(id),
  actor_account_id uuid not null references public.app_accounts(id),
  channel text not null check(channel in ('notification','chat')),
  status text not null default 'pending' check(status in ('pending','processing','delivered','failed','cancelled')),
  attempts integer not null default 0 check(attempts >= 0),
  last_error text,
  claim_token uuid,
  lease_until timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payslip_id,recipient_account_id,channel)
);
create index payslip_deliveries_period_idx on public.payslip_deliveries(payroll_period_id,status);
create unique index messages_payslip_delivery_key on public.messages((metadata->>'payslipDeliveryId')) where metadata ? 'payslipDeliveryId';
alter table public.payslip_deliveries enable row level security;
revoke all on public.payslip_deliveries from public,anon,authenticated;
grant all on public.payslip_deliveries to service_role;

create function public.queue_payslip_delivery(p_payslip_id uuid,p_actor_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare s payslips%rowtype; v_period uuid; v_count integer;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into s from payslips where id=p_payslip_id for share;
  if not found or s.status<>'published' then raise exception 'PAYSLIP_NOT_PUBLISHED'; end if;
  select payroll_period_id into v_period from payroll_lines where id=s.payroll_line_id;
  perform 1 from app_accounts where employee_id=s.employee_id and status='active' for share;
  if not found then raise exception 'PAYSLIP_RECIPIENT_REQUIRED'; end if;
  insert into payslip_deliveries(payslip_id,payroll_period_id,recipient_account_id,actor_account_id,channel)
    select s.id,v_period,a.id,p_actor_id,c.channel from app_accounts a
    cross join (values('notification'),('chat')) c(channel)
    where a.employee_id=s.employee_id and a.status='active'
    on conflict(payslip_id,recipient_account_id,channel) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function public.track_payslip_delivery()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='published' and (tg_op='INSERT' or old.status is distinct from new.status) then
    perform queue_payslip_delivery(new.id,new.published_by);
  elsif new.status<>'published' then
    update payslip_deliveries set status='cancelled',claim_token=null,lease_until=null,updated_at=now()
      where payslip_id=new.id and status in ('pending','processing','failed');
  end if;
  return new;
end $$;
create trigger payslip_delivery_outbox after insert or update of status on public.payslips
  for each row execute function public.track_payslip_delivery();

create function public.retry_payroll_deliveries(p_period_id uuid,p_actor_id uuid,p_employee_id uuid default null)
returns integer language plpgsql security invoker set search_path=public as $$
declare s record; v_count integer:=0;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  perform 1 from payroll_periods where id=p_period_id for share;
  if not found then raise exception 'PAYROLL_NOT_FOUND'; end if;
  for s in select ps.id from payslips ps join payroll_lines l on l.id=ps.payroll_line_id
    where l.payroll_period_id=p_period_id and ps.status='published'
    and (p_employee_id is null or ps.employee_id=p_employee_id) order by ps.id
  loop
    v_count:=v_count+queue_payslip_delivery(s.id,p_actor_id);
  end loop;
  return v_count;
end $$;

create function public.claim_payslip_deliveries(p_period_id uuid,p_claim_token uuid,p_employee_id uuid default null)
returns setof public.payslip_deliveries language plpgsql security invoker set search_path=public as $$
begin
  if p_claim_token is null then raise exception 'CLAIM_REQUIRED'; end if;
  return query
    with ready as (
      select d.id from payslip_deliveries d join payslips s on s.id=d.payslip_id
      where d.payroll_period_id=p_period_id and s.status='published'
        and (p_employee_id is null or s.employee_id=p_employee_id)
        and (d.status in ('pending','failed') or d.status='processing' and d.lease_until<now())
      order by d.created_at,d.id limit 40 for update of d skip locked
    )
    update payslip_deliveries d set status='processing',claim_token=p_claim_token,lease_until=now()+interval '2 minutes',
      attempts=d.attempts+1,last_error=null,updated_at=now() from ready where d.id=ready.id returning d.*;
end $$;

revoke all on function public.queue_payslip_delivery(uuid,uuid),public.track_payslip_delivery(),public.retry_payroll_deliveries(uuid,uuid,uuid),public.claim_payslip_deliveries(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.queue_payslip_delivery(uuid,uuid),public.track_payslip_delivery(),public.retry_payroll_deliveries(uuid,uuid,uuid),public.claim_payslip_deliveries(uuid,uuid,uuid) to service_role;
