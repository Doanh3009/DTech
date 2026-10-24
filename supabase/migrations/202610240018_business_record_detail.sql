create function public.business_record_detail(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;refs text:='';k text;f jsonb;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);
 for k,f in select key,value from jsonb_each(d->'fields') where value->>'type'='ref' loop
  refs:=refs||case when refs='' then '' else ',' end||format('%L,(select code||'' · ''||name from public.%I where tenant_id=r.tenant_id and id=r.%I)',k,public.business_entity_table(f->>'ref'),k);
 end loop;
 execute format('select to_jsonb(r)||jsonb_build_object(''references'',jsonb_build_object(%s)) from public.%I r where tenant_id=$1 and id=$2',refs,public.business_entity_table(p_kind)) into r using a.tenant_id,p_id;
 if r is null then raise exception 'BUSINESS_NOT_FOUND';end if;return r;
end $$;
revoke all on function public.business_record_detail(text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_record_detail(text,text,text,uuid) to service_role;
