create table public.business_form_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),kind text not null references public.business_entity_definitions(kind),
 version integer not null,name text not null,active boolean not null,fields jsonb not null,reason text not null,created_by uuid not null,created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,kind,version),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id)
);
create unique index business_active_form on public.business_form_versions(tenant_id,kind) where active;
create table public.business_form_records(
 tenant_id uuid not null,kind text not null references public.business_entity_definitions(kind),record_id uuid not null,form_id uuid not null,data jsonb not null,
 row_version integer not null default 1,updated_by uuid not null,updated_at timestamptz not null default now(),primary key(tenant_id,kind,record_id),
 foreign key(tenant_id,form_id) references public.business_form_versions(tenant_id,id),foreign key(tenant_id,updated_by) references public.business_accounts(tenant_id,id)
);
alter table public.business_form_versions enable row level security;alter table public.business_form_records enable row level security;
revoke all on public.business_form_versions,public.business_form_records from public,anon,authenticated,service_role;

create function public.business_form_validate(p_fields jsonb,p_data jsonb) returns void language plpgsql immutable set search_path='' as $$
declare f jsonb;value jsonb;k text;s text;n numeric;
begin
 if coalesce(jsonb_typeof(p_data),'')<>'object' or octet_length(p_data::text)>80000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for k in select jsonb_object_keys(p_data) loop if not exists(select 1 from jsonb_array_elements(p_fields) where value->>'key'=k) then raise exception 'BUSINESS_INVALID_INPUT';end if;end loop;
 for f in select jsonb_array_elements(p_fields) loop
  value:=p_data->(f->>'key');
  if value is null or value='null'::jsonb or value='""'::jsonb then if (f->>'required')::boolean then raise exception 'BUSINESS_FORM_REQUIRED';end if;continue;end if;
  if f->>'type'='boolean' then if jsonb_typeof(value)<>'boolean' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  elsif f->>'type'='number' then
   if jsonb_typeof(value)<>'number' then raise exception 'BUSINESS_INVALID_INPUT';end if;n:=(value#>>'{}')::numeric;
   if n<coalesce((f->>'min')::numeric,-1e15) or n>coalesce((f->>'max')::numeric,1e15) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  else
   if jsonb_typeof(value)<>'string' then raise exception 'BUSINESS_INVALID_INPUT';end if;s:=value#>>'{}';
   if char_length(s)>coalesce((f->>'maxLength')::integer,2000) or (f->>'required')::boolean and char_length(btrim(s))=0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='date' and (s!~ '^\d{4}-\d{2}-\d{2}$' or to_char(to_date(s,'YYYY-MM-DD'),'YYYY-MM-DD')<>s) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='choice' and not(f->'options' ? s) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  end if;
 end loop;
exception when invalid_datetime_format or datetime_field_overflow then raise exception 'BUSINESS_INVALID_INPUT';
end $$;
revoke all on function public.business_form_validate(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_form_version_save(p_hash text,p_slug text,p_request_id uuid,p_expected_version integer,p_data jsonb,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;f jsonb;seen text[]:='{}';version integer;form uuid;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'form.version',p_payload_hash);if r is not null then return r;end if;
 d:=public.business_assert_kind(a.tenant_id,p_data->>'kind');
 if d->>'mode'='master' or coalesce(char_length(btrim(p_data->>'name')),0) not between 2 and 120 or coalesce(char_length(btrim(p_data->>'reason')),0) not between 3 and 500 or coalesce(jsonb_typeof(p_data->'active'),'')<>'boolean' or coalesce(jsonb_typeof(p_data->'fields'),'')<>'array' or jsonb_array_length(p_data->'fields')>32 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for f in select jsonb_array_elements(p_data->'fields') loop
  if coalesce(f->>'key','')!~ '^[a-z][a-z0-9_]{0,39}$' or f->>'key'=any(seen) or coalesce(char_length(btrim(f->>'label')),0) not between 1 and 120 or coalesce(f->>'type','') not in ('text','number','date','choice','boolean') or coalesce(jsonb_typeof(f->'required'),'')<>'boolean' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  seen:=array_append(seen,f->>'key');
  if coalesce((f->>'maxLength')::integer,2000) not between 1 and 2000 or coalesce((f->>'min')::numeric,-1e15)< -1e15 or coalesce((f->>'max')::numeric,1e15)>1e15 or coalesce((f->>'min')::numeric,-1e15)>coalesce((f->>'max')::numeric,1e15) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f->>'type'='choice' and (coalesce(jsonb_typeof(f->'options'),'')<>'array' or jsonb_array_length(f->'options') not between 1 and 20 or exists(select 1 from jsonb_array_elements(f->'options') where jsonb_typeof(value)<>'string' or char_length(value#>>'{}') not between 1 and 120) or (select count(distinct value) from jsonb_array_elements(f->'options'))<>jsonb_array_length(f->'options')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 end loop;
 select coalesce(max(v.version),0) into version from public.business_form_versions v where tenant_id=a.tenant_id and kind=p_data->>'kind';
 if p_expected_version is null or version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 update public.business_form_versions set active=false where tenant_id=a.tenant_id and kind=p_data->>'kind' and active;
 insert into public.business_form_versions(tenant_id,kind,version,name,active,fields,reason,created_by) values(a.tenant_id,p_data->>'kind',version+1,btrim(p_data->>'name'),(p_data->>'active')::boolean,p_data->'fields',btrim(p_data->>'reason'),a.id) returning id into form;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'form.version',p_data->>'kind',form,p_data);
 r:=jsonb_build_object('formId',form,'version',version+1);insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'form.version',p_payload_hash,r);return r;
end $$;

create function public.business_form_assert(p_tenant uuid,p_kind text,p_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare f public.business_form_versions%rowtype;data jsonb;
begin
 select v.*,r.data into f.id,f.tenant_id,f.kind,f.version,f.name,f.active,f.fields,f.reason,f.created_by,f.created_at,data from public.business_form_records r join public.business_form_versions v on v.tenant_id=r.tenant_id and v.id=r.form_id where r.tenant_id=p_tenant and r.kind=p_kind and r.record_id=p_id;
 if not found then select * into f from public.business_form_versions where tenant_id=p_tenant and kind=p_kind and active;data:='{}';end if;
 if f.id is not null then perform public.business_form_validate(f.fields,data);end if;
end $$;
revoke all on function public.business_form_assert(uuid,text,uuid) from public,anon,authenticated,service_role;

create function public.business_form_snapshot(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;form public.business_form_versions%rowtype;data public.business_form_records%rowtype;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',v);
 select * into data from public.business_form_records where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id;
 if found then select * into form from public.business_form_versions where tenant_id=a.tenant_id and id=data.form_id;else select * into form from public.business_form_versions where tenant_id=a.tenant_id and kind=p_kind and active;end if;
 return jsonb_build_object('form',case when form.id is null then null else to_jsonb(form)-'tenant_id'-'created_by'-'reason' end,'data',coalesce(data.data,'{}'),'rowVersion',coalesce(data.row_version,0),'parentVersion',v->'row_version');
end $$;

create function public.business_form_record_save(p_hash text,p_slug text,p_request_id uuid,p_kind text,p_id uuid,p_expected_version integer,p_parent_version integer,p_form_id uuid,p_data jsonb,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;prior public.business_form_records%rowtype;form public.business_form_versions%rowtype;version integer;review_sql text:='';snapshot_sql text:='';r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_kind(a.tenant_id,p_kind);
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'form.data',p_payload_hash);if r is not null then return r;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'update',v);
 if v->>'status'<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if (v->>'row_version')::integer is distinct from p_parent_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into prior from public.business_form_records where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id for update;
 if coalesce(prior.row_version,0) is distinct from p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into form from public.business_form_versions where tenant_id=a.tenant_id and id=p_form_id and kind=p_kind;
 if not found or prior.form_id is not null and prior.form_id<>p_form_id or prior.form_id is null and not form.active then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 perform public.business_form_validate(form.fields,p_data);
 insert into public.business_form_records(tenant_id,kind,record_id,form_id,data,updated_by) values(a.tenant_id,p_kind,p_id,p_form_id,p_data,a.id) on conflict(tenant_id,kind,record_id) do update set data=excluded.data,updated_by=excluded.updated_by,updated_at=now(),row_version=business_form_records.row_version+1 returning row_version into version;
 if exists(select 1 from pg_catalog.pg_attribute where attrelid=('public.'||public.business_entity_table(p_kind))::regclass and attname='reviewed_by' and not attisdropped) then review_sql:=',reviewed_by=null';end if;
 if exists(select 1 from pg_catalog.pg_attribute where attrelid=('public.'||public.business_entity_table(p_kind))::regclass and attname='calculation_snapshot' and not attisdropped) then snapshot_sql:=',calculation_snapshot=null';end if;
 execute format('update public.%I set row_version=row_version+1,updated_at=now()%s%s where tenant_id=$1 and id=$2',public.business_entity_table(p_kind),review_sql,snapshot_sql) using a.tenant_id,p_id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'form.data_updated',p_kind,p_id,jsonb_build_object('before',prior.data,'after',p_data,'formVersion',form.version));
 r:=jsonb_build_object('rowVersion',version,'parentVersion',p_parent_version+1);insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'form.data',p_payload_hash,r);return r;
end $$;

do $$ declare body text;begin
 select pg_get_functiondef('public.business_approval_settings(text,text)'::regprocedure) into body;
 execute replace(body,'''delegations'',delegations','''delegations'',delegations,''forms'',coalesce((select jsonb_agg(to_jsonb(f)) from (select distinct on(kind) * from public.business_form_versions where tenant_id=a.tenant_id order by kind,version desc)f),''[]''::jsonb)');
end $$;
revoke all on function public.business_form_version_save(text,text,uuid,integer,jsonb,text),public.business_form_snapshot(text,text,text,uuid),public.business_form_record_save(text,text,uuid,text,uuid,integer,integer,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.business_form_version_save(text,text,uuid,integer,jsonb,text),public.business_form_snapshot(text,text,text,uuid),public.business_form_record_save(text,text,uuid,text,uuid,integer,integer,uuid,jsonb,text) to service_role;
