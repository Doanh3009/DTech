update public.business_entity_definitions
set definition=jsonb_set(
  definition,
  '{fields,sales_contract_id}',
  '{"label":"Hợp đồng nguồn","type":"ref","ref":"sales_contracts","requiresFeature":"sales"}'::jsonb,
  true
)
where kind='projects';

alter table public.business_projects add column sales_contract_id uuid;
alter table public.business_projects add constraint business_projects_sales_contract_fk
  foreign key(tenant_id,sales_contract_id) references public.business_sales_contracts(tenant_id,id);
create unique index business_projects_sales_contract_idx on public.business_projects(tenant_id,sales_contract_id) where sales_contract_id is not null;

create function public.business_project_contract_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare c public.business_sales_contracts%rowtype;
begin
 if tg_op='UPDATE' and old.sales_contract_id is not null and new.sales_contract_id is distinct from old.sales_contract_id then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.sales_contract_id is not null then
  select * into c from public.business_sales_contracts where tenant_id=new.tenant_id and id=new.sales_contract_id for key share;
  if not found or c.status<>'posted' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.starts_on<c.starts_on or c.ends_on is not null and new.ends_on is not null and new.ends_on>c.ends_on then raise exception 'BUSINESS_INVALID_DATE';end if;
 end if;
 return new;
end $$;
revoke all on function public.business_project_contract_guard() from public,anon,authenticated,service_role;
create trigger business_project_contract_guard before insert or update of sales_contract_id,starts_on,ends_on on public.business_projects for each row execute function public.business_project_contract_guard();

create function public.business_sales_contract_project_lock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='posted' and new.status<>'posted' and exists(select 1 from public.business_projects where tenant_id=old.tenant_id and sales_contract_id=old.id) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_sales_contract_project_lock() from public,anon,authenticated,service_role;
create trigger business_sales_contract_project_lock before update of status on public.business_sales_contracts for each row execute function public.business_sales_contract_project_lock();
