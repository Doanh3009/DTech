-- Profile and its history entry commit together. Private object upload remains
-- outside the transaction and is compensated by the service on failure.
create or replace function public.save_insurance_profile_command(
  p_employee_id uuid,p_event_id uuid,p_actor_id uuid,p_values jsonb,p_document_file_id uuid default null,
  p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_current employee_insurance_profiles%rowtype;v_snapshot jsonb;v_status text;v_payment text;v_change text;v_reason text;
begin
  if not exists(select 1 from app_accounts a join account_roles ar on ar.account_id=a.id join role_permissions rp on rp.role_id=ar.role_id
    where a.id=p_actor_id and a.status='active' and rp.permission_key='insurance.edit') then raise exception 'INSURANCE_ACTOR_DENIED';end if;
  if p_document_file_id is not null then
    if not exists(select 1 from account_roles ar join role_permissions rp on rp.role_id=ar.role_id where ar.account_id=p_actor_id and rp.permission_key='insurance.document.upload')
      or not exists(select 1 from file_assets where id=p_document_file_id and bucket='insurance-private' and owner_entity_type='insurance_event' and owner_entity_id=p_event_id::text and created_by=p_actor_id)
      then raise exception 'INSURANCE_FILE_DENIED';end if;
  end if;
  if p_employee_id is null or p_event_id is null or p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'INSURANCE_INPUT_INVALID';end if;
  perform 1 from employees where id=p_employee_id for share;
  if not found then raise exception 'INSURANCE_EMPLOYEE_NOT_FOUND';end if;
  perform pg_advisory_xact_lock(hashtextextended('insurance-profile:'||p_employee_id::text,0));
  select * into v_current from employee_insurance_profiles where employee_id=p_employee_id for update;
  if found and (p_expected_updated_at is null or v_current.updated_at is distinct from p_expected_updated_at) then raise exception 'INSURANCE_VERSION_CONFLICT';end if;
  if not found and p_expected_updated_at is not null then raise exception 'INSURANCE_VERSION_CONFLICT';end if;
  v_status:=p_values->>'participationStatus';v_payment:=p_values->>'paymentStatus';v_change:=p_values->>'changeType';v_reason:=trim(coalesce(p_values->>'reason',''));
  if coalesce(v_status,'') not in ('active','suspended','ended','not_participating') or coalesce(v_payment,'') not in ('pending','paid','overdue')
    or coalesce(v_change,'') not in ('joined','adjusted','suspended','resumed','ended') or length(v_reason) not between 3 and 500
    or length(trim(coalesce(p_values->>'socialInsuranceNumber',''))) not between 5 and 30
    or nullif(p_values->>'effectiveDate','') is null
    or (p_values->>'contributionBase')::numeric<0 or (p_values->>'contributionBase')::numeric>1000000000000
    or (p_values->>'contributionRatePercent')::numeric<0 or (p_values->>'contributionRatePercent')::numeric>100
    or (nullif(p_values->>'contributionMonth','') is not null and p_values->>'contributionMonth' !~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    or jsonb_typeof(p_values->'socialInsuranceEnabled') is distinct from 'boolean' or jsonb_typeof(p_values->'healthInsuranceEnabled') is distinct from 'boolean'
    or jsonb_typeof(p_values->'unemploymentInsuranceEnabled') is distinct from 'boolean' then raise exception 'INSURANCE_INPUT_INVALID';end if;
  v_snapshot:=jsonb_build_object('socialInsuranceNumber',trim(p_values->>'socialInsuranceNumber'),'participationStatus',v_status,'startDate',p_values->'startDate',
    'contributionBase',p_values->'contributionBase','contributionRatePercent',p_values->'contributionRatePercent','contributionMonth',p_values->'contributionMonth','paymentStatus',v_payment,
    'socialInsuranceEnabled',p_values->'socialInsuranceEnabled','healthInsuranceEnabled',p_values->'healthInsuranceEnabled','unemploymentInsuranceEnabled',p_values->'unemploymentInsuranceEnabled');
  insert into employee_insurance_profiles(employee_id,social_insurance_number,participation_status,start_date,contribution_base,contribution_rate_percent,contribution_month,payment_status,
    social_insurance_enabled,health_insurance_enabled,unemployment_insurance_enabled,updated_by,updated_at)
  values(p_employee_id,trim(p_values->>'socialInsuranceNumber'),v_status,nullif(p_values->>'startDate','')::date,(p_values->>'contributionBase')::numeric,(p_values->>'contributionRatePercent')::numeric,
    (nullif(p_values->>'contributionMonth','')||'-01')::date,v_payment,(p_values->>'socialInsuranceEnabled')::boolean,(p_values->>'healthInsuranceEnabled')::boolean,(p_values->>'unemploymentInsuranceEnabled')::boolean,p_actor_id,clock_timestamp())
  on conflict(employee_id) do update set social_insurance_number=excluded.social_insurance_number,participation_status=excluded.participation_status,start_date=excluded.start_date,
    contribution_base=excluded.contribution_base,contribution_rate_percent=excluded.contribution_rate_percent,contribution_month=excluded.contribution_month,payment_status=excluded.payment_status,
    social_insurance_enabled=excluded.social_insurance_enabled,health_insurance_enabled=excluded.health_insurance_enabled,unemployment_insurance_enabled=excluded.unemployment_insurance_enabled,
    updated_by=excluded.updated_by,updated_at=excluded.updated_at;
  insert into employee_insurance_events(id,employee_id,change_type,effective_date,snapshot,reason,document_file_id,changed_by)
  values(p_event_id,p_employee_id,v_change,(p_values->>'effectiveDate')::date,v_snapshot,v_reason,p_document_file_id,p_actor_id);
  return p_event_id;
end $$;
revoke all on function public.save_insurance_profile_command(uuid,uuid,uuid,jsonb,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.save_insurance_profile_command(uuid,uuid,uuid,jsonb,uuid,timestamptz) to service_role;
