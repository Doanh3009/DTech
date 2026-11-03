update public.business_entity_definitions set definition=definition||jsonb_build_object('readRoles',jsonb_build_array('owner','editor')) where kind in ('salary_runs','salary_lines','salary_payments','payroll_tax_runs','payroll_cost_allocations','staff_tax_profiles','recruitment_candidates','recruitment_interviews','recruitment_offers','recruitment_hires');

alter function public.business_access_allowed(uuid,text,text,jsonb) rename to business_access_allowed_before_sensitive_roles;
revoke all on function public.business_access_allowed_before_sensitive_roles(uuid,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.business_access_allowed(p_actor uuid,p_kind text,p_action text,v jsonb default null) returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor_role text;roles jsonb;
begin
 select role into actor_role from public.business_accounts where id=p_actor and status='active';if actor_role is null then return false;end if;
 select definition->'readRoles' into roles from public.business_entity_definitions where kind=p_kind;
 if actor_role<>'owner' and roles is not null and not(roles ? actor_role) then return false;end if;
 return public.business_access_allowed_before_sensitive_roles(p_actor,p_kind,p_action,v);
end $$;
revoke all on function public.business_access_allowed(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.business_entity_redact_fields(p_data jsonb,p_definition jsonb,p_role text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=coalesce(p_data,'{}'::jsonb);k text;f jsonb;roles jsonb;redacted boolean:=false;
begin
 for k,f in select key,value from jsonb_each(coalesce(p_definition->'fields','{}'::jsonb)) loop
  roles:=coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb);if not roles ? p_role then result:=result-k;redacted:=true;end if;
 end loop;
 if redacted then result:=result-'calculation_snapshot';end if;
 return result;
end $$;

alter function public.business_misa_snapshot(text,text,text,date,date,integer) rename to business_misa_snapshot_before_sensitive_roles;
revoke all on function public.business_misa_snapshot_before_sensitive_roles(text,text,text,date,date,integer) from public,anon,authenticated,service_role;
create function public.business_misa_snapshot(p_hash text,p_slug text,p_view text,p_from date,p_to date,p_page integer default 1) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if p_view='payroll' then perform public.business_assert_access(a.id,'salary_payments','read');perform public.business_assert_access(a.id,'salary_payments','report');end if;
 return public.business_misa_snapshot_before_sensitive_roles(p_hash,p_slug,p_view,p_from,p_to,p_page);
end $$;
revoke all on function public.business_misa_snapshot(text,text,text,date,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_misa_snapshot(text,text,text,date,date,integer) to service_role;
notify pgrst,'reload schema';
