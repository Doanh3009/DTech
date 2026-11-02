update public.business_entity_definitions
set definition=jsonb_set(
  definition,
  '{fields,change_type,values}',
  definition#>'{fields,change_type,values}' || '{"termination":"Nghỉ việc"}'::jsonb,
  true
)
where kind='staff_history';

alter table public.business_staff_history drop constraint business_staff_history_change_type_check;
alter table public.business_staff_history add constraint business_staff_history_change_type_check
  check(change_type in ('department','position','compensation','assignment','termination'));

create or replace function public.business_staff_history_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 staff public.business_staff%rowtype;
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if tg_op='UPDATE' and old.status='posted' and
   (new.staff_id,new.document_date,new.effective_on,new.change_type,new.department,new.position,new.base_salary,new.project_id,new.reason,new.name,new.notes)
   is distinct from
   (old.staff_id,old.document_date,old.effective_on,old.change_type,old.department,old.position,old.base_salary,old.project_id,old.reason,old.name,old.notes)
 then raise exception 'BUSINESS_RECORD_LOCKED';end if;

 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':employment:'||new.staff_id::text,0));
  select * into staff from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id for update;
  if not found or staff.status<>'active' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.effective_on>today or new.effective_on<staff.joined_on then raise exception 'BUSINESS_INVALID_DATE';end if;

  if new.change_type='termination' then
   if new.department is not null or new.position is not null or new.base_salary is not null or new.project_id is not null then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if exists(select 1 from public.business_accounts where tenant_id=new.tenant_id and staff_id=new.staff_id and role='owner' and status='active') then raise exception 'BUSINESS_OWNER_TRANSFER_REQUIRED';end if;
   new.previous_department:=staff.department;new.previous_position:=staff.position;new.previous_salary:=staff.base_salary;
   update public.business_staff set status='inactive',row_version=row_version+1,updated_at=now() where tenant_id=new.tenant_id and id=new.staff_id;
   update public.business_sessions ss set revoked_at=now()
   from public.business_accounts a
   where a.tenant_id=new.tenant_id and a.staff_id=new.staff_id and ss.tenant_id=a.tenant_id and ss.account_id=a.id and ss.revoked_at is null;
   update public.business_accounts set status='disabled',credential_version=credential_version+1
   where tenant_id=new.tenant_id and staff_id=new.staff_id and status='active';
  else
   if new.change_type='department' and new.department is null or new.change_type='position' and new.position is null or new.change_type='compensation' and new.base_salary is null or new.change_type='assignment' and new.project_id is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
   new.previous_department:=staff.department;new.previous_position:=staff.position;new.previous_salary:=staff.base_salary;
   perform set_config('app.staff_history_apply','on',true);
   update public.business_staff set department=coalesce(new.department,department),position=coalesce(new.position,position),base_salary=coalesce(new.base_salary,base_salary),row_version=row_version+1,updated_at=now() where tenant_id=new.tenant_id and id=new.staff_id;
   perform set_config('app.staff_history_apply','off',true);
  end if;
 end if;
 return new;
end $$;

revoke all on function public.business_staff_history_guard() from public,anon,authenticated,service_role;
