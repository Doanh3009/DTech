create function public.business_scope_project(p_tenant uuid,p_kind text,v jsonb,p_depth integer default 0) returns uuid language plpgsql stable security definer set search_path='' as $$
declare d jsonb;parent jsonb;
begin
 if p_kind='projects' then return (v->>'id')::uuid;end if;
 if v->>'project_id' is not null then return (v->>'project_id')::uuid;end if;
 if p_depth>=4 then return null;end if;
 select definition into d from public.business_entity_definitions where kind=p_kind;
 if d->>'parentKind' is null or v->>(d->>'parentField') is null then return null;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using p_tenant,(v->>(d->>'parentField'))::uuid;
 return public.business_scope_project(p_tenant,d->>'parentKind',parent,p_depth+1);
end $$;
revoke all on function public.business_scope_project(uuid,text,jsonb,integer) from public,anon,authenticated,service_role;
do $$ declare body text;begin
 select pg_get_functiondef('public.business_access_allowed(uuid,text,text,jsonb)'::regprocedure) into body;
 execute replace(body,'project:=case when p_kind=''projects'' then (v->>''id'')::uuid else (v->>''project_id'')::uuid end;','project:=public.business_scope_project(a.tenant_id,p_kind,v);');
end $$;

create function public.business_document_lines(p_hash text,p_slug text,p_parent_kind text,p_parent_id uuid,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;c jsonb;parent jsonb;rows jsonb;total bigint;refs text:='';k text;f jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_parent_kind);
 if d->>'lineKind' is null or p_page is null or p_page not between 1 and 100000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 c:=public.business_assert_kind(a.tenant_id,d->>'lineKind');if c->>'parentKind'<>p_parent_kind then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_parent_kind)) into parent using a.tenant_id,p_parent_id;
 if parent is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,p_parent_kind,'read',parent);perform public.business_assert_access(a.id,d->>'lineKind','read');
 for k,f in select key,value from jsonb_each(c->'fields') where value->>'type'='ref' loop refs:=refs||case when refs='' then '' else ',' end||format('%L,(select code||'' · ''||name from public.%I where tenant_id=r.tenant_id and id=r.%I)',k,public.business_entity_table(f->>'ref'),k);end loop;
 execute format('select count(*) from public.%I x where tenant_id=$1 and %I=$2 and status=''active'' and public.business_access_allowed($3,%L,''read'',to_jsonb(x))',public.business_entity_table(d->>'lineKind'),c->>'parentField',d->>'lineKind') into total using a.tenant_id,p_parent_id,a.id;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object(''references'',jsonb_build_object(%s))),''[]''::jsonb) from (select * from public.%I x where tenant_id=$1 and %I=$2 and status=''active'' and public.business_access_allowed($3,%L,''read'',to_jsonb(x)) order by created_at,id limit 25 offset $4) r',refs,public.business_entity_table(d->>'lineKind'),c->>'parentField',d->>'lineKind') into rows using a.tenant_id,p_parent_id,a.id,(p_page-1)*25;
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'pageSize',25,'parentVersion',parent->'row_version','parentReviewedBy',parent->'reviewed_by');
end $$;
revoke all on function public.business_document_lines(text,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_document_lines(text,text,text,uuid,integer) to service_role;

do $$ declare body text;anchor text;begin
 select pg_get_functiondef('public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into body;
 body:=replace(body,'perform public.business_assert_access(a.id,p_kind,p_action,v);','perform public.business_assert_access(a.id,p_kind,case when p_action in (''deactivate'',''activate'') then ''update'' else p_action end,v);');
 anchor:='if p_action=''reverse'' and p_kind=''project_materials''';if strpos(body,anchor)=0 then raise exception 'Review document line actions';end if;
 body:=replace(body,anchor,$guard$if p_action in ('deactivate','activate') and d->>'parentKind' is not null then
  r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
  if (v->>'row_version')::integer is distinct from p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 or (p_action='deactivate' and v->>'status'<>'active') or (p_action='activate' and v->>'status'<>'inactive') then raise exception 'BUSINESS_INVALID_TRANSITION';end if;
  perform public.business_operational_validate(a.tenant_id,p_kind,p_id,v,v);
  execute format('update public.%I set status=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,case p_action when 'activate' then 'active' else 'inactive' end;
  insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'line.'||p_action,p_kind,p_id,jsonb_build_object('reason',p_reason,'parentId',v->>(d->>'parentField')));
  r:=jsonb_build_object('recordId',p_id,'rowVersion',p_expected_version+1);
  insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);return r;
 end if;
 $guard$||anchor);execute body;
end $$;
