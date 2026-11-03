create function public.business_document_export(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;d jsonb;c jsonb;doc jsonb;lines jsonb:='[]'::jsonb;batch jsonb;total bigint:=0;denied bigint;page integer:=1;creator text;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);doc:=public.business_record_detail(p_hash,p_slug,p_kind,p_id);
 perform public.business_assert_access(a.id,p_kind,'report',doc);
 select * into t from public.business_tenants where id=a.tenant_id;
 select display_name into creator from public.business_accounts where tenant_id=a.tenant_id and id=(doc->>'created_by')::uuid;
 if d->>'lineKind' is not null and t.features ? (select definition->>'feature' from public.business_entity_definitions where kind=d->>'lineKind') then
  c:=public.business_assert_kind(a.tenant_id,d->>'lineKind');
  execute format('select count(*),count(*) filter(where not public.business_access_allowed($3,%L,''read'',to_jsonb(x)) or not public.business_access_allowed($3,%L,''report'',to_jsonb(x))) from public.%I x where tenant_id=$1 and %I=$2 and status not in (''inactive'',''cancelled'')',d->>'lineKind',d->>'lineKind',public.business_entity_table(d->>'lineKind'),c->>'parentField') into total,denied using a.tenant_id,p_id,a.id;
  if denied>0 then raise exception 'BUSINESS_SCOPED_REPORT';end if;
  if total>500 then raise exception 'BUSINESS_EXPORT_TOO_LARGE';end if;
  loop
   batch:=public.business_document_lines(p_hash,p_slug,p_kind,p_id,page);lines:=lines||(batch->'rows');exit when jsonb_array_length(lines)>=total or jsonb_array_length(batch->'rows')=0;page:=page+1;
  end loop;
  if jsonb_array_length(lines)<>total then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'document.exported',p_kind,p_id,jsonb_build_object('format','pdf','rowVersion',doc->'row_version','lineCount',total));
 return jsonb_build_object('record',doc,'lines',lines,'lineKind',case when total>0 then d->>'lineKind' end,'tenantName',t.name,'systemName',t.system_name,'isDemo',t.is_demo,'createdBy',coalesce(creator,'Hệ thống'));
end $$;
revoke all on function public.business_document_export(text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_document_export(text,text,text,uuid) to service_role;
notify pgrst,'reload schema';
