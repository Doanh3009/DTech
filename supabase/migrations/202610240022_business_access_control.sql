-- Explicit grants are live at each command/read; legacy roles keep their existing access until customized.
create table public.business_access_profiles (
 tenant_id uuid not null,account_id uuid not null,custom_access boolean not null default false,row_version integer not null default 1,
 primary key(tenant_id,account_id),foreign key(tenant_id,account_id) references public.business_accounts(tenant_id,id)
);
create table public.business_access_grants (
 tenant_id uuid not null,account_id uuid not null,kind text not null references public.business_entity_definitions(kind),
 actions text[] not null default '{}',scope text not null default 'tenant' check(scope in ('tenant','own','projects','department')),
 project_ids uuid[] not null default '{}',department text not null default '',
 primary key(tenant_id,account_id,kind),foreign key(tenant_id,account_id) references public.business_accounts(tenant_id,id),
 check(actions <@ array['read','report','create','update','calculate','approve','post','release','complete','cancel','reverse']::text[]),
 check(scope<>'projects' or cardinality(project_ids)>0),check(scope<>'department' or char_length(btrim(department))>0)
);
alter table public.business_access_profiles enable row level security;
alter table public.business_access_grants enable row level security;
revoke all on public.business_access_profiles,public.business_access_grants from public,anon,authenticated,service_role;

create function public.business_access_allowed(p_actor uuid,p_kind text,p_action text,v jsonb default null) returns boolean language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;g public.business_access_grants%rowtype;project uuid;department_name text;
begin
 select * into a from public.business_accounts where id=p_actor and status='active';if not found then return false;end if;
 if a.role='owner' then return true;end if;
 if p_action='reverse' or a.role='viewer' and p_action not in ('read','report') then return false;end if;
 if not coalesce((select custom_access from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id),false) then return true;end if;
 select * into g from public.business_access_grants where tenant_id=a.tenant_id and account_id=a.id and kind=p_kind;
 if not found or not(p_action=any(g.actions)) then return false;end if;
 if v is null or g.scope='tenant' then return true;end if;
 if g.scope='own' then return v->>'created_by'=a.id::text;end if;
 if g.scope='projects' then
  project:=case when p_kind='projects' then (v->>'id')::uuid else (v->>'project_id')::uuid end;
  return coalesce(project=any(g.project_ids),false);
 end if;
 department_name:=v->>'department';
 if department_name is null and v->>'staff_id' is not null then select department into department_name from public.business_staff where tenant_id=a.tenant_id and id=(v->>'staff_id')::uuid;end if;
 return coalesce(department_name=g.department,false);
end $$;
revoke all on function public.business_access_allowed(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

create function public.business_assert_access(p_actor uuid,p_kind text,p_action text,v jsonb default null) returns void language plpgsql security definer set search_path='' as $$
begin if not public.business_access_allowed(p_actor,p_kind,p_action,v) then raise exception 'BUSINESS_FORBIDDEN';end if;end $$;
revoke all on function public.business_assert_access(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

create function public.business_assert_reference_access(p_actor uuid,p_kind text,v jsonb) returns void language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;k text;f jsonb;referenced jsonb;
begin
 select * into a from public.business_accounts where id=p_actor;
 for k,f in select key,value from jsonb_each((select definition->'fields' from public.business_entity_definitions where kind=p_kind)) where value->>'type'='ref' loop
  if v->>k is null then continue;end if;
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(f->>'ref')) into referenced using a.tenant_id,(v->>k)::uuid;
  if referenced is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  perform public.business_assert_access(p_actor,f->>'ref','read',referenced);
 end loop;
end $$;
revoke all on function public.business_assert_reference_access(uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.business_assert_report_access(p_actor uuid,p_features text[] default null) returns void language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;d record;g public.business_access_grants%rowtype;
begin
 select * into a from public.business_accounts where id=p_actor;select * into t from public.business_tenants where id=a.tenant_id;
 if a.role='owner' or not coalesce((select custom_access from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id),false) then return;end if;
 for d in select kind,definition from public.business_entity_definitions where (p_features is null or definition->>'feature'=any(p_features)) and t.features ? (definition->>'feature') and (not(definition ? 'industries') or definition->'industries' ? t.industry) and (not(definition ? 'requiresFeatures') or t.features @> definition->'requiresFeatures') loop
  select * into g from public.business_access_grants where tenant_id=a.tenant_id and account_id=a.id and kind=d.kind;
  if not found or not(g.actions @> array['read','report']::text[]) or g.scope<>'tenant' then raise exception 'BUSINESS_SCOPED_REPORT';end if;
 end loop;
end $$;
revoke all on function public.business_assert_report_access(uuid,text[]) from public,anon,authenticated,service_role;

-- Apply permissions to the public command entry points, preserving receipts and source guards.
do $$ declare body text;signature regprocedure;anchor text;begin
 foreach signature in array array['public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text)'::regprocedure,'public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure] loop
  select pg_get_functiondef(signature) into body;anchor:='d:=public.business_assert_kind(a.tenant_id,p_kind);';
  if strpos(body,anchor)=0 then raise exception 'Review command authorization before upgrading';end if;
  if strpos(body,'p_data jsonb')>0 then
   body:=replace(body,anchor,anchor||$guard$
    perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
    perform public.business_assert_access(a.id,p_kind,case when p_expected_version=0 then 'create' else 'update' end,p_data||jsonb_build_object('created_by',a.id));
    perform public.business_assert_reference_access(a.id,p_kind,p_data);
    execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into old using a.tenant_id,p_id;
    if old is not null then perform public.business_assert_access(a.id,p_kind,'update',old);end if;
   $guard$);
  else
   body:=replace(body,anchor,anchor||$guard$
    perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
    execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
    if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
    perform public.business_assert_access(a.id,p_kind,p_action,v);
   $guard$);
  end if;execute body;
 end loop;
end $$;

create or replace function public.business_list_records(p_hash text,p_slug text,p_kind text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;r jsonb;n bigint;refs text:='';k text;f jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);perform public.business_assert_access(a.id,p_kind,'read');
 if p_page is null or p_page not between 1 and 100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select count(*) from public.%I t where tenant_id=$1 and public.business_access_allowed($3,%L,''read'',to_jsonb(t)) and (strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0)',public.business_entity_table(p_kind),p_kind) into n using a.tenant_id,p_query,a.id;
 for k,f in select key,value from jsonb_each(d->'fields') where value->>'type'='ref' loop
  refs:=refs||case when refs='' then '' else ',' end||format('%L,(select code||'' · ''||name from public.%I where tenant_id=r.tenant_id and id=r.%I)',k,public.business_entity_table(f->>'ref'),k);
 end loop;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object(''references'',jsonb_build_object(%s))),''[]''::jsonb) from (select * from public.%I t where tenant_id=$1 and public.business_access_allowed($3,%L,''read'',to_jsonb(t)) and (strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0) order by updated_at desc,id limit 25 offset $4) r',refs,public.business_entity_table(p_kind),p_kind) into r using a.tenant_id,p_query,a.id,(p_page-1)*25;
 return jsonb_build_object('records',r,'total',n,'page',p_page,'pageSize',25);
end $$;

create or replace function public.business_record_options(p_hash text,p_slug text,p_kind text,p_query text default '',p_selected uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);perform public.business_assert_access(a.id,p_kind,'read');
 if p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select id,code,name,status from public.%I t where tenant_id=$1 and public.business_access_allowed($4,%L,''read'',to_jsonb(t)) and status not in (''inactive'',''cancelled'') and (id=$3 or strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0) order by (id=$3) desc nulls last,code limit 101) r',public.business_entity_table(p_kind),p_kind) into r using a.tenant_id,p_query,p_selected,a.id;
 return jsonb_build_object('options',r,'truncated',jsonb_array_length(r)>100);
end $$;

-- Detail endpoints and aggregate endpoints must obey the same rules as the worklists.
do $$ declare body text;anchor text;spec record;begin
 for spec in select * from (values
 ('public.business_record_detail(text,text,text,uuid)','if r is null then raise exception ''BUSINESS_NOT_FOUND'';end if;','perform public.business_assert_access(a.id,p_kind,''read'',r);'),
 ('public.business_journal_detail(text,text,uuid)','if not found then raise exception ''BUSINESS_NOT_FOUND'';end if;','perform public.business_assert_access(a.id,''journal_entries'',''read'',to_jsonb(h));'),
 ('public.business_overview(text,text)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id);'),
 ('public.business_company_dashboard(text,text,date)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id);'),
 ('public.business_operations_view(text,text,text)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id,array[p_feature]);'),
 ('public.business_financial_snapshot(text,text,date,date,uuid)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id,array[''accounting'',''purchasing'']);'),
 ('public.business_misa_snapshot(text,text,text,date,date,integer)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id,array[''accounting'',''costing'',''assets'',''people'',''purchasing'']);'),
 ('public.business_procurement_matching(text,text,integer,text)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id,array[''purchasing'',''inventory'',''accounting'']);'),
 ('public.business_trace_lot(text,text,uuid,text)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id,array[''traceability'',''inventory'',''production'',''quality'']);'),
 ('public.business_sales_fulfillment(text,text,uuid)','a:=public.business_assert_session(p_hash,p_slug);','perform public.business_assert_report_access(a.id,array[''sales'',''inventory'']);'),
 ('public.business_deliver_sales_order(text,text,uuid,uuid,integer,date,jsonb)','a:=public.business_assert_session(p_hash,p_slug,true);','perform public.business_assert_access(a.id,''sales_orders'',''post'');perform public.business_assert_access(a.id,''stock_moves'',''post'');perform public.business_assert_report_access(a.id,array[''sales'',''inventory'']);')
 ) t(signature,anchor,guard) loop
  select pg_get_functiondef(spec.signature::regprocedure) into body;if strpos(body,spec.anchor)=0 then raise exception 'Review % authorization before upgrading',spec.signature;end if;
  execute replace(body,spec.anchor,spec.anchor||spec.guard);
 end loop;
end $$;

create function public.business_access_snapshot(p_hash text,p_slug text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name,'username',x.username,'role',x.role,'status',x.status,'customAccess',coalesce(p.custom_access,false),'rowVersion',coalesce(p.row_version,0),'grants',coalesce((select jsonb_agg(to_jsonb(g)-'tenant_id'-'account_id' order by kind) from public.business_access_grants g where g.tenant_id=x.tenant_id and g.account_id=x.id),'[]'::jsonb)) order by x.display_name),'[]'::jsonb) into r from public.business_accounts x left join public.business_access_profiles p on p.tenant_id=x.tenant_id and p.account_id=x.id where x.tenant_id=a.tenant_id;
 return jsonb_build_object('accounts',r);
end $$;

create function public.business_access_update(p_hash text,p_slug text,p_account uuid,p_expected_version integer,p_custom boolean,p_grants jsonb,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;target public.business_accounts%rowtype;version integer;r jsonb;g jsonb;project uuid;prior jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if a.role<>'owner' or p_custom is null or coalesce(jsonb_typeof(p_grants),'')<>'array' or jsonb_array_length(p_grants)>300 then raise exception 'BUSINESS_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'access.update',p_payload_hash);if r is not null then return r;end if;
 select * into target from public.business_accounts where tenant_id=a.tenant_id and id=p_account and role<>'owner';if not found then raise exception 'BUSINESS_FORBIDDEN';end if;
 select row_version into version from public.business_access_profiles where tenant_id=a.tenant_id and account_id=p_account;
 if p_expected_version is null or coalesce(version,0)<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select jsonb_build_object('customAccess',coalesce((select custom_access from public.business_access_profiles where tenant_id=a.tenant_id and account_id=p_account),false),'grants',coalesce(jsonb_agg(to_jsonb(x)-'tenant_id'-'account_id'),'[]'::jsonb)) into prior from public.business_access_grants x where tenant_id=a.tenant_id and account_id=p_account;
 delete from public.business_access_grants where tenant_id=a.tenant_id and account_id=p_account;
 for g in select value from jsonb_array_elements(p_grants) loop
  perform public.business_assert_kind(a.tenant_id,g->>'kind');
  if coalesce(jsonb_typeof(g->'actions'),'')<>'array' or coalesce(jsonb_typeof(g->'project_ids'),'')<>'array' or g->>'scope' is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
  for project in select value::uuid from jsonb_array_elements_text(g->'project_ids') loop if not exists(select 1 from public.business_projects where tenant_id=a.tenant_id and id=project) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;end loop;
  insert into public.business_access_grants(tenant_id,account_id,kind,actions,scope,project_ids,department) values(a.tenant_id,p_account,g->>'kind',array(select jsonb_array_elements_text(g->'actions')),g->>'scope',array(select value::uuid from jsonb_array_elements_text(g->'project_ids')),coalesce(g->>'department',''));
 end loop;
 insert into public.business_access_profiles values(a.tenant_id,p_account,p_custom,1) on conflict(tenant_id,account_id) do update set custom_access=excluded.custom_access,row_version=business_access_profiles.row_version+1 returning row_version into version;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'access.updated','accounts',p_account,jsonb_build_object('before',prior,'after',jsonb_build_object('customAccess',p_custom,'grants',p_grants),'version',version));
 r:=jsonb_build_object('accountId',p_account,'rowVersion',version);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'access.update',p_payload_hash,r);return r;
end $$;
revoke all on function public.business_access_snapshot(text,text),public.business_access_update(text,text,uuid,integer,boolean,jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_access_snapshot(text,text),public.business_access_update(text,text,uuid,integer,boolean,jsonb,uuid,text) to service_role;

do $$ declare body text;begin
 select pg_get_functiondef('public.business_session_workspace(text,text)'::regprocedure) into body;
 if strpos(body,'''isDemo'',t.is_demo')=0 then raise exception 'Review workspace access metadata before upgrading';end if;
 execute replace(body,'''isDemo'',t.is_demo','''isDemo'',t.is_demo,''customAccess'',coalesce((select custom_access from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id),false),''grants'',coalesce((select jsonb_agg(to_jsonb(g)-''tenant_id''-''account_id'') from public.business_access_grants g where g.tenant_id=a.tenant_id and g.account_id=a.id),''[]''::jsonb)');
end $$;
