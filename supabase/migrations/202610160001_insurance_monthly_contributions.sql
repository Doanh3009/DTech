-- Operational monthly contribution records are distinct from restricted profile
-- change/document history. No rates, missing months, payment amounts or dates
-- are inferred. Existing role grants remain unchanged.
create table public.employee_insurance_contributions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_insurance_profiles(employee_id) on delete restrict,
  contribution_month date not null check(extract(day from contribution_month)=1),
  contribution_base numeric(18,2) check(contribution_base between 0 and 1000000000000),
  contribution_rate_percent numeric(5,2) check(contribution_rate_percent between 0 and 100),
  expected_amount numeric(18,0) generated always as (round(contribution_base*contribution_rate_percent/100,0)) stored,
  paid_amount numeric(18,2) check(paid_amount between 0 and 1000000000000),
  payment_status text not null check(payment_status in ('pending','paid','overdue')),
  paid_date date,
  note text check(length(note)<=500),
  source text not null default 'recorded' check(source in ('recorded','legacy_profile')),
  updated_by uuid not null references public.app_accounts(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(employee_id,contribution_month),
  check(payment_status='paid' or (coalesce(paid_amount,0)=0 and paid_date is null))
);
create index employee_insurance_contributions_month_idx on public.employee_insurance_contributions(contribution_month desc,employee_id);

-- Immutable receipts make lost RPC responses distinguishable from failed saves.
-- Before/after details remain audit data, not part of insurance.view responses.
create table public.employee_insurance_contribution_commands (
  id uuid primary key,
  contribution_id uuid not null references public.employee_insurance_contributions(id) on delete restrict,
  actor_id uuid not null references public.app_accounts(id),
  before_data jsonb,
  after_data jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
create trigger insurance_contribution_commands_append_only before update or delete on public.employee_insurance_contribution_commands
for each row execute function public.protect_audit_log();
alter table public.employee_insurance_contributions enable row level security;
alter table public.employee_insurance_contribution_commands enable row level security;
revoke all on public.employee_insurance_contributions,public.employee_insurance_contribution_commands from public,anon,authenticated,service_role;
grant select on public.employee_insurance_contributions,public.employee_insurance_contribution_commands to service_role;

-- Import only explicitly recorded employee/month snapshots. Repeated profile
-- changes for one month collapse to its latest snapshot; absent months stay
-- absent. No history reasons or private document metadata are copied.
with candidates as (
  select e.employee_id,e.snapshot,e.changed_at as recorded_at,e.changed_by as actor_id,0 as priority,e.id::text as tie
  from public.employee_insurance_events e join public.employee_insurance_profiles p on p.employee_id=e.employee_id
  where jsonb_typeof(e.snapshot)='object'
  union all
  select p.employee_id,jsonb_build_object('contributionMonth',to_char(p.contribution_month,'YYYY-MM'),
    'contributionBase',p.contribution_base,'contributionRatePercent',p.contribution_rate_percent,'paymentStatus',p.payment_status),
    p.updated_at,p.updated_by,1,p.employee_id::text
  from public.employee_insurance_profiles p where p.contribution_month is not null
), ranked as (
  select *,dense_rank() over(partition by employee_id,snapshot->>'contributionMonth' order by priority desc,recorded_at desc) as newest from candidates
  where snapshot->>'contributionMonth' ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'
    and snapshot->>'paymentStatus' in ('pending','paid','overdue')
), recorded as (
  -- The current profile is authoritative for its own month. Conflicting
  -- historical snapshots with identical timestamps cannot establish payment
  -- truth; those months remain unrecorded for HR to reconcile.
  select distinct on(a.employee_id,a.snapshot->>'contributionMonth') a.* from ranked a where a.newest=1
    and not exists(select 1 from ranked b where b.newest=1 and b.employee_id=a.employee_id and b.snapshot->>'contributionMonth'=a.snapshot->>'contributionMonth'
      and jsonb_build_array(b.snapshot->'paymentStatus',b.snapshot->'contributionBase',b.snapshot->'contributionRatePercent')
        is distinct from jsonb_build_array(a.snapshot->'paymentStatus',a.snapshot->'contributionBase',a.snapshot->'contributionRatePercent'))
  order by a.employee_id,a.snapshot->>'contributionMonth',a.tie desc
), parsed as (
  select *,case when snapshot->>'contributionBase' ~ '^[0-9]+([.][0-9]+)?$' then (snapshot->>'contributionBase')::numeric end as base,
    case when snapshot->>'contributionRatePercent' ~ '^[0-9]+([.][0-9]+)?$' then (snapshot->>'contributionRatePercent')::numeric end as rate from recorded
)
insert into public.employee_insurance_contributions(employee_id,contribution_month,contribution_base,contribution_rate_percent,payment_status,source,updated_by,created_at,updated_at)
select employee_id,((snapshot->>'contributionMonth')||'-01')::date,
  case when base between 0 and 1000000000000 then base end,case when rate between 0 and 100 then rate end,
  snapshot->>'paymentStatus','legacy_profile',actor_id,recorded_at,recorded_at from parsed;

create function public.save_insurance_contribution_command(
  p_command_id uuid,p_employee_id uuid,p_actor_id uuid,p_values jsonb,p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile employee_insurance_profiles%rowtype;v_current employee_insurance_contributions%rowtype;
  v_after employee_insurance_contributions%rowtype;v_latest employee_insurance_contributions%rowtype;v_month date;v_status text;v_base numeric;v_rate numeric;v_paid numeric;v_date date;v_note text;v_receipt employee_insurance_contribution_commands%rowtype;
begin
  if not exists(select 1 from app_accounts a join account_roles ar on ar.account_id=a.id join role_permissions rp on rp.role_id=ar.role_id
    where a.id=p_actor_id and a.status='active' and rp.permission_key='insurance.edit') then raise exception 'INSURANCE_ACTOR_DENIED';end if;
  if p_command_id is null or p_employee_id is null or p_values is null or jsonb_typeof(p_values)<>'object'
    or coalesce(p_values->>'contributionMonth','') !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'
    or coalesce(p_values->>'paymentStatus','') not in ('pending','paid','overdue')
    or (p_values ? 'employeeId' and p_values->>'employeeId' is distinct from p_employee_id::text)
    or (p_values ? 'contributionBase' and jsonb_typeof(p_values->'contributionBase') not in ('number','null'))
    or (p_values ? 'contributionRatePercent' and jsonb_typeof(p_values->'contributionRatePercent') not in ('number','null'))
    or (p_values ? 'paidAmount' and jsonb_typeof(p_values->'paidAmount') not in ('number','null')) then raise exception 'INSURANCE_INPUT_INVALID';end if;
  v_month:=((p_values->>'contributionMonth')||'-01')::date;v_status:=p_values->>'paymentStatus';
  v_base:=(p_values->>'contributionBase')::numeric;v_rate:=(p_values->>'contributionRatePercent')::numeric;v_paid:=(p_values->>'paidAmount')::numeric;
  if nullif(p_values->>'paidDate','') is not null and p_values->>'paidDate' !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then raise exception 'INSURANCE_INPUT_INVALID';end if;
  v_date:=nullif(p_values->>'paidDate','')::date;v_note:=nullif(trim(p_values->>'note'),'');
  if v_base<0 or v_base>1000000000000 or v_rate<0 or v_rate>100 or v_paid<0 or v_paid>1000000000000
    or length(v_note)>500 or (v_status<>'paid' and (coalesce(v_paid,0)>0 or v_date is not null)) then raise exception 'INSURANCE_INPUT_INVALID';end if;
  -- Match the existing profile command's lock order for old/new month edits.
  perform pg_advisory_xact_lock(hashtextextended('insurance-profile:'||p_employee_id::text,0));
  select * into v_profile from employee_insurance_profiles where employee_id=p_employee_id for update;
  if not found then raise exception 'INSURANCE_PROFILE_NOT_FOUND';end if;
  select * into v_receipt from employee_insurance_contribution_commands where id=p_command_id;
  if found then
    if v_receipt.actor_id<>p_actor_id or v_receipt.after_data->>'employee_id'<>p_employee_id::text then raise exception 'INSURANCE_ACTOR_DENIED';end if;
    return v_receipt.contribution_id;
  end if;
  select * into v_current from employee_insurance_contributions where employee_id=p_employee_id and contribution_month=v_month for update;
  if found and (p_expected_updated_at is null or v_current.updated_at is distinct from p_expected_updated_at) then raise exception 'INSURANCE_VERSION_CONFLICT';end if;
  if not found and p_expected_updated_at is not null then raise exception 'INSURANCE_VERSION_CONFLICT';end if;
  insert into employee_insurance_contributions(employee_id,contribution_month,contribution_base,contribution_rate_percent,paid_amount,payment_status,paid_date,note,source,updated_by)
  values(p_employee_id,v_month,v_base,v_rate,v_paid,v_status,v_date,v_note,'recorded',p_actor_id)
  on conflict(employee_id,contribution_month) do update set contribution_base=excluded.contribution_base,contribution_rate_percent=excluded.contribution_rate_percent,
    paid_amount=excluded.paid_amount,payment_status=excluded.payment_status,paid_date=excluded.paid_date,note=excluded.note,source='recorded',updated_by=p_actor_id,
    updated_at=greatest(clock_timestamp(),employee_insurance_contributions.updated_at+interval '1 microsecond') returning * into v_after;
  -- Past-month corrections never replace the latest recorded month. Changing
  -- any ledger version also invalidates an already-open profile edit form.
  select * into v_latest from employee_insurance_contributions where employee_id=p_employee_id order by contribution_month desc limit 1;
  update employee_insurance_profiles set
    contribution_month=v_latest.contribution_month,payment_status=v_latest.payment_status,
    contribution_base=case when v_latest.contribution_month=v_month then v_base else contribution_base end,
    contribution_rate_percent=case when v_latest.contribution_month=v_month then v_rate else contribution_rate_percent end,
    updated_by=p_actor_id,updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where employee_id=p_employee_id;
  insert into employee_insurance_contribution_commands(id,contribution_id,actor_id,before_data,after_data)
  values(p_command_id,v_after.id,p_actor_id,case when v_current.id is not null then to_jsonb(v_current) end,to_jsonb(v_after));
  insert into audit_logs(actor_account_id,action,entity_type,entity_id,module,before_data,after_data,reason,metadata)
  values(p_actor_id,'insurance.contribution_saved','employee_insurance_contribution',v_after.id::text,'insurance',
    case when v_current.id is not null then to_jsonb(v_current) end,to_jsonb(v_after),v_note,jsonb_build_object('commandId',p_command_id,'employeeId',p_employee_id));
  return v_after.id;
end $$;
revoke all on function public.save_insurance_contribution_command(uuid,uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.save_insurance_contribution_command(uuid,uuid,uuid,jsonb,timestamptz) to service_role;

-- Keep the existing atomic profile/history/upload command intact. Its wrapper
-- also stores the explicitly selected month, retaining all previous months.
alter function public.save_insurance_profile_command(uuid,uuid,uuid,jsonb,uuid,timestamptz) rename to save_insurance_profile_record_command;
revoke all on function public.save_insurance_profile_record_command(uuid,uuid,uuid,jsonb,uuid,timestamptz) from public,anon,authenticated,service_role;
create function public.save_insurance_profile_command(
  p_employee_id uuid,p_event_id uuid,p_actor_id uuid,p_values jsonb,p_document_file_id uuid default null,p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_event_id uuid;v_month date;v_current employee_insurance_contributions%rowtype;v_after employee_insurance_contributions%rowtype;
  v_profile employee_insurance_profiles%rowtype;v_values jsonb;v_latest employee_insurance_contributions%rowtype;
begin
  if p_values ? 'recordContribution' and jsonb_typeof(p_values->'recordContribution') is distinct from 'boolean' then raise exception 'INSURANCE_INPUT_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('insurance-profile:'||p_employee_id::text,0));
  select * into v_profile from employee_insurance_profiles where employee_id=p_employee_id for update;
  v_values:=p_values;
  if p_values->>'recordContribution'='false' then
    v_values:=p_values||jsonb_build_object('contributionMonth',to_char(v_profile.contribution_month,'YYYY-MM'),'paymentStatus',coalesce(v_profile.payment_status,'pending'));
  end if;
  v_event_id:=save_insurance_profile_record_command(p_employee_id,p_event_id,p_actor_id,v_values,p_document_file_id,p_expected_updated_at);
  if p_values->>'recordContribution' is distinct from 'false' and nullif(p_values->>'contributionMonth','') is not null then
    v_month:=((p_values->>'contributionMonth')||'-01')::date;
    select * into v_current from employee_insurance_contributions where employee_id=p_employee_id and contribution_month=v_month for update;
    if found and p_values->>'paymentStatus'<>'paid' and (coalesce(v_current.paid_amount,0)>0 or v_current.paid_date is not null)
      then raise exception 'INSURANCE_PAYMENT_RECORD_CONFLICT';end if;
    insert into employee_insurance_contributions(employee_id,contribution_month,contribution_base,contribution_rate_percent,payment_status,source,updated_by)
    values(p_employee_id,v_month,(p_values->>'contributionBase')::numeric,(p_values->>'contributionRatePercent')::numeric,p_values->>'paymentStatus','recorded',p_actor_id)
    on conflict(employee_id,contribution_month) do update set contribution_base=excluded.contribution_base,contribution_rate_percent=excluded.contribution_rate_percent,
      payment_status=excluded.payment_status,source='recorded',updated_by=p_actor_id,
      updated_at=greatest(clock_timestamp(),employee_insurance_contributions.updated_at+interval '1 microsecond') returning * into v_after;
    insert into employee_insurance_contribution_commands(id,contribution_id,actor_id,before_data,after_data)
    values(p_event_id,v_after.id,p_actor_id,case when v_current.id is not null then to_jsonb(v_current) end,to_jsonb(v_after));
    insert into audit_logs(actor_account_id,action,entity_type,entity_id,module,before_data,after_data,reason,metadata)
    values(p_actor_id,'insurance.contribution_saved','employee_insurance_contribution',v_after.id::text,'insurance',
      case when v_current.id is not null then to_jsonb(v_current) end,to_jsonb(v_after),p_values->>'reason',jsonb_build_object('profileEventId',p_event_id,'employeeId',p_employee_id));
    select * into v_latest from employee_insurance_contributions where employee_id=p_employee_id order by contribution_month desc limit 1;
    update employee_insurance_profiles set contribution_month=v_latest.contribution_month,payment_status=v_latest.payment_status,
      contribution_base=case when v_latest.contribution_month>v_month then v_profile.contribution_base else contribution_base end,
      contribution_rate_percent=case when v_latest.contribution_month>v_month then v_profile.contribution_rate_percent else contribution_rate_percent end
    where employee_id=p_employee_id;
  end if;
  return v_event_id;
end $$;
revoke all on function public.save_insurance_profile_command(uuid,uuid,uuid,jsonb,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.save_insurance_profile_command(uuid,uuid,uuid,jsonb,uuid,timestamptz) to service_role;
