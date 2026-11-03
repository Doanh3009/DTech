-- Workspace search uses the same module ownership as the shared entity registry.
create function public.business_search_module_records(p_hash text,p_slug text,p_feature text,p_query text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;d record;hit record;found_rows jsonb:='[]'::jsonb;total integer:=0;needle text;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if p_query is null or char_length(btrim(p_query)) not between 2 and 80 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into t from public.business_tenants where id=a.tenant_id;
 if p_feature is null or not(t.features ? p_feature) then raise exception 'BUSINESS_FORBIDDEN';end if;
 needle:=lower(btrim(p_query));
 for d in select kind,definition from public.business_entity_definitions
 where case when definition ? 'workspaceFeature' and t.features ? (definition->>'workspaceFeature') then definition->>'workspaceFeature' else definition->>'feature' end=p_feature order by kind loop
  if not(t.features ? (d.definition->>'feature')) then continue;end if;
  if (d.definition ? 'industries') and not((d.definition->'industries') ? t.industry) then continue;end if;
  if (d.definition ? 'requiresFeatures') and not(t.features @> (d.definition->'requiresFeatures')) then continue;end if;
  for hit in execute format('select r.id,r.code,r.name,r.updated_at from public.%I r where r.tenant_id=$1 and r.status not in (''inactive'',''cancelled'') and (strpos(lower(r.code),$3)>0 or strpos(lower(r.name),$3)>0) and public.business_access_allowed($2,$4,''read'',to_jsonb(r)) order by (lower(r.code)=$3) desc,r.updated_at desc,r.id limit 5',public.business_entity_table(d.kind)) using a.tenant_id,a.id,needle,d.kind loop
   if total>=50 then return jsonb_build_object('results',found_rows,'truncated',true);end if;
   found_rows:=found_rows||jsonb_build_array(jsonb_build_object('id',hit.id,'kind',d.kind,'label',d.definition->>'label','code',hit.code,'name',hit.name,'updatedAt',hit.updated_at));total:=total+1;
  end loop;
 end loop;
 return jsonb_build_object('results',found_rows,'truncated',false);
end $$;
revoke all on function public.business_search_module_records(text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_search_module_records(text,text,text,text) to service_role;
notify pgrst,'reload schema';
