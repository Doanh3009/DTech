alter table public.leave_requests add column if not exists organization_snapshot jsonb;

create or replace function public.capture_leave_organization_snapshot()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_organization jsonb; v_branding jsonb;
begin
  if new.organization_snapshot is null then
    select value into v_organization from public.system_settings where group_key='organization';
    select value into v_branding from public.system_settings where group_key='branding';
    new.organization_snapshot=jsonb_build_object(
      'organization',coalesce(v_organization,'{}'::jsonb),
      'brandingVersion',coalesce(v_branding->'assetVersion','0'::jsonb),
      'capturedAt',now()
    );
  end if;
  return new;
end; $$;

drop trigger if exists leave_requests_capture_organization on public.leave_requests;
create trigger leave_requests_capture_organization before insert on public.leave_requests
for each row execute function public.capture_leave_organization_snapshot();

update public.leave_requests
set organization_snapshot=jsonb_build_object(
  'organization',coalesce((select value from public.system_settings where group_key='organization'),'{}'::jsonb),
  'brandingVersion',coalesce((select value->'assetVersion' from public.system_settings where group_key='branding'),'0'::jsonb),
  'capturedAt',created_at
)
where organization_snapshot is null;

create or replace function public.validate_leave_approval_balance()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_deducts boolean; v_allow_negative boolean; v_balance numeric;
begin
  if new.status='approved' and old.status is distinct from 'approved' then
    select deducts_balance into v_deducts from public.leave_types where id=new.leave_type_id;
    select allow_negative_balance into v_allow_negative from public.leave_policies where active limit 1;
    if coalesce(v_deducts,false) and not coalesce(v_allow_negative,false) then
      select coalesce(sum(amount),0) into v_balance from public.leave_ledger
      where employee_id=new.employee_id and leave_year=extract(year from new.start_date)::int and leave_type_id=new.leave_type_id;
      if v_balance < new.calculated_days then raise exception 'LEAVE_BALANCE_INSUFFICIENT'; end if;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists leave_requests_validate_approval_balance on public.leave_requests;
create trigger leave_requests_validate_approval_balance before update of status on public.leave_requests
for each row execute function public.validate_leave_approval_balance();
