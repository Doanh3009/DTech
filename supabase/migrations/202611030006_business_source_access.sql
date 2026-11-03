-- Polymorphic sources have the same tenant, capability and row scope checks as
-- ordinary references. Client metadata is never an authorization boundary.
create or replace function public.business_assert_reference_access(p_actor uuid,p_kind text,v jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;k text;f jsonb;target_kind text;referenced jsonb;d jsonb;
begin
 select * into a from public.business_accounts where id=p_actor and status='active';if not found then raise exception 'BUSINESS_FORBIDDEN';end if;
 select definition into d from public.business_entity_definitions where kind=p_kind;
 for k,f in select key,value from jsonb_each(d->'fields') loop
  if f ? 'kindOptions' and nullif(v->>k,'') is not null and not(f->'kindOptions' ? (v->>k)) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if f->>'type'<>'ref' and not(f ? 'lookup') then continue;end if;
  if nullif(v->>k,'') is null then continue;end if;
  if f ? 'lookup' then
   target_kind:=v->>(f->'lookup'->>'kindField');
   if target_kind is null or not(f->'lookup'->'kinds' ? target_kind) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  else target_kind:=f->>'ref';end if;
  perform public.business_assert_kind(a.tenant_id,target_kind);
  begin execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(target_kind)) into referenced using a.tenant_id,(v->>k)::uuid;
  exception when invalid_text_representation then raise exception 'BUSINESS_INVALID_REFERENCE';end;
  if referenced is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  perform public.business_assert_access(a.id,target_kind,'read',referenced);
  if f->'lookup' ? 'statuses' and not(f->'lookup'->'statuses' ? (referenced->>'status')) then raise exception 'BUSINESS_SOURCE_NOT_READY';end if;
 end loop;
end $$;

create function public.business_entity_reference_labels(p_actor uuid,p_kind text,v jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;d jsonb;target jsonb;k text;f jsonb;target_kind text;referenced jsonb;result jsonb:='{}'::jsonb;
begin
 select * into a from public.business_accounts where id=p_actor and status='active';select * into t from public.business_tenants where id=a.tenant_id;
 if a.id is null or v->>'tenant_id' is distinct from a.tenant_id::text then return result;end if;
 select definition into d from public.business_entity_definitions where kind=p_kind;
 for k,f in select key,value from jsonb_each(d->'fields') loop
  if (f->>'type'<>'ref' and not(f ? 'lookup')) or nullif(v->>k,'') is null or not(coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb) ? a.role) then continue;end if;
  target_kind:=case when f ? 'lookup' then v->>(f->'lookup'->>'kindField') else f->>'ref' end;
  if f ? 'lookup' and not(coalesce(f->'lookup'->'kinds','[]'::jsonb) ? target_kind) then continue;end if;
  select definition into target from public.business_entity_definitions where kind=target_kind;
  if target is null or not(t.features ? (target->>'feature')) or (target ? 'industries' and not(target->'industries' ? t.industry)) or (target ? 'requiresFeatures' and not(t.features @> (target->'requiresFeatures'))) then continue;end if;
  begin execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(target_kind)) into referenced using a.tenant_id,(v->>k)::uuid;
  exception when invalid_text_representation then continue;end;
  if referenced is not null and public.business_access_allowed(a.id,target_kind,'read',referenced) then result:=result||jsonb_build_object(k,(referenced->>'code')||' · '||(referenced->>'name'));end if;
 end loop;
 return result;
end $$;

create or replace function public.business_list_records(p_hash text,p_slug text,p_kind text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;r jsonb;n bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);perform public.business_assert_access(a.id,p_kind,'read');
 if p_page is null or p_page not between 1 and 100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select count(*) from public.%I t where tenant_id=$1 and public.business_access_allowed($3,$4,''read'',to_jsonb(t)) and (strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0)',public.business_entity_table(p_kind)) into n using a.tenant_id,p_query,a.id,p_kind;
 execute format('select coalesce(jsonb_agg(public.business_entity_redact_fields(to_jsonb(r),$5,$6)||jsonb_build_object(''references'',public.business_entity_reference_labels($3,$7,to_jsonb(r)))),''[]''::jsonb) from (select * from public.%I t where tenant_id=$1 and public.business_access_allowed($3,$7,''read'',to_jsonb(t)) and (strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0) order by updated_at desc,id limit 25 offset $4) r',public.business_entity_table(p_kind)) into r using a.tenant_id,p_query,a.id,(p_page-1)*25,d,a.role,p_kind;
 return jsonb_build_object('records',r,'total',n,'page',p_page,'pageSize',25);
end $$;

create or replace function public.business_record_detail(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(r) from public.%I r where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into r using a.tenant_id,p_id;
 if r is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',r);
 return public.business_entity_redact_fields(r,d,a.role)||jsonb_build_object('references',public.business_entity_reference_labels(a.id,p_kind,r));
end $$;

create or replace function public.business_document_lines(p_hash text,p_slug text,p_parent_kind text,p_parent_id uuid,p_page integer default 1) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;c jsonb;parent jsonb;rows jsonb;total bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_parent_kind);
 if d->>'lineKind' is null or p_page is null or p_page not between 1 and 100000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 c:=public.business_assert_kind(a.tenant_id,d->>'lineKind');if c->>'parentKind' is distinct from p_parent_kind then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_parent_kind)) into parent using a.tenant_id,p_parent_id;
 if parent is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,p_parent_kind,'read',parent);perform public.business_assert_access(a.id,d->>'lineKind','read');
 execute format('select count(*) from public.%I x where tenant_id=$1 and %I=$2 and status not in (''inactive'',''cancelled'') and public.business_access_allowed($3,$4,''read'',to_jsonb(x))',public.business_entity_table(d->>'lineKind'),c->>'parentField') into total using a.tenant_id,p_parent_id,a.id,d->>'lineKind';
 execute format('select coalesce(jsonb_agg(public.business_entity_redact_fields(to_jsonb(r),$5,$6)||jsonb_build_object(''references'',public.business_entity_reference_labels($3,$7,to_jsonb(r)))),''[]''::jsonb) from (select * from public.%I x where tenant_id=$1 and %I=$2 and status not in (''inactive'',''cancelled'') and public.business_access_allowed($3,$7,''read'',to_jsonb(x)) order by created_at,id limit 25 offset $4) r',public.business_entity_table(d->>'lineKind'),c->>'parentField') into rows using a.tenant_id,p_parent_id,a.id,(p_page-1)*25,c,a.role,d->>'lineKind';
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'pageSize',25,'parentVersion',parent->'row_version','parentReviewedBy',parent->'reviewed_by');
end $$;

create function public.business_record_options_filtered(p_hash text,p_slug text,p_kind text,p_query text default '',p_selected uuid default null,p_statuses text[] default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);perform public.business_assert_access(a.id,p_kind,'read');
 if p_query is null or char_length(p_query)>100 or (p_statuses is not null and (cardinality(p_statuses) not between 1 and 7 or not(p_statuses <@ array['draft','active','inactive','released','completed','posted','cancelled']::text[]))) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select id,code,name,status from public.%I t where tenant_id=$1 and public.business_access_allowed($4,$5,''read'',to_jsonb(t)) and status not in (''inactive'',''cancelled'') and ($6 is null or status=any($6)) and (id=$3 or strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0) order by (id=$3) desc nulls last,code limit 101) r',public.business_entity_table(p_kind)) into r using a.tenant_id,p_query,p_selected,a.id,p_kind,p_statuses;
 return jsonb_build_object('options',(select coalesce(jsonb_agg(value),'[]'::jsonb) from jsonb_array_elements(r) with ordinality x(value,n) where n<=100),'truncated',jsonb_array_length(r)>100);
end $$;
create or replace function public.business_record_options(p_hash text,p_slug text,p_kind text,p_query text default '',p_selected uuid default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin return public.business_record_options_filtered(p_hash,p_slug,p_kind,p_query,p_selected,null);end $$;

-- Released orders may be signed as well as posted documents. Source version and
-- ready attachment checks in the existing trigger remain mandatory.
do $$declare body text;anchor text;begin
 select pg_get_functiondef('public.business_document_signing_guard()'::regprocedure) into body;
 anchor:='definition->>''mode''=''document''';if strpos(body,anchor)=0 then raise exception 'Review signing source modes';end if;
 body:=replace(body,anchor,'definition->>''mode'' in (''document'',''order'')');
 anchor:='source->>''status''<>''posted''';if strpos(body,anchor)=0 then raise exception 'Review signing source states';end if;
 body:=replace(body,anchor,'source->>''status'' not in (''posted'',''released'',''completed'')');execute body;
end $$;
revoke all on function public.business_assert_reference_access(uuid,text,jsonb),public.business_entity_reference_labels(uuid,text,jsonb),public.business_list_records(text,text,text,integer,text),public.business_record_detail(text,text,text,uuid),public.business_document_lines(text,text,text,uuid,integer),public.business_record_options(text,text,text,text,uuid),public.business_record_options_filtered(text,text,text,text,uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function public.business_list_records(text,text,text,integer,text),public.business_record_detail(text,text,text,uuid),public.business_document_lines(text,text,text,uuid,integer),public.business_record_options(text,text,text,text,uuid),public.business_record_options_filtered(text,text,text,text,uuid,text[]) to service_role;
notify pgrst,'reload schema';
