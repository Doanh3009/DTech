-- Bulk entry retains the same tenant, permissions, CAS, invariants and audit as manual saves.
create table public.business_catalog_imports (
 request_id uuid primary key,
 tenant_id uuid not null references public.business_tenants(id),
 actor_id uuid not null,
 kind text not null check(kind in ('items','partners','warehouses')),
 file_name text not null check(char_length(file_name) between 1 and 180),
 file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,actor_id) references public.business_accounts(tenant_id,id)
);
create index business_catalog_imports_tenant_kind_date_idx on public.business_catalog_imports(tenant_id,kind,created_at desc);
alter table public.business_catalog_imports enable row level security;
revoke all on public.business_catalog_imports from public,anon,authenticated,service_role;

create function public.business_assert_catalog_import(p_actor uuid,p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;
begin
 select * into a from public.business_accounts where id=p_actor and status='active';
 if a.id is null or a.role='viewer' or p_kind is null or p_kind not in ('items','partners','warehouses') then raise exception 'BUSINESS_FORBIDDEN';end if;
 perform public.business_assert_kind(a.tenant_id,p_kind);
 perform public.business_assert_access(a.id,p_kind,'read');
 if not(public.business_access_allowed(a.id,p_kind,'create') or public.business_access_allowed(a.id,p_kind,'update')) then raise exception 'BUSINESS_FORBIDDEN';end if;
 if a.role<>'owner' and exists(select 1 from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id and custom_access)
 and not exists(select 1 from public.business_access_grants where tenant_id=a.tenant_id and account_id=a.id and kind=p_kind and scope='tenant') then raise exception 'BUSINESS_SCOPED_IMPORT';end if;
end $$;

create function public.business_catalog_import_matches(p_hash text,p_slug text,p_kind text,p_codes jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;result jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_catalog_import(a.id,p_kind);
 if coalesce(jsonb_typeof(p_codes),'')<>'array' or jsonb_array_length(p_codes)>200 or exists(select 1 from jsonb_array_elements(p_codes) value where jsonb_typeof(value)<>'string' or char_length(value#>>'{}')>50) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select coalesce(jsonb_agg(jsonb_build_object(''code'',t.code,''recordId'',t.id,''rowVersion'',t.row_version,''status'',t.status,''data'',(select jsonb_object_agg(k,to_jsonb(t)->k) from jsonb_object_keys(to_jsonb(t)) k where k=any($3)))),''[]''::jsonb) from public.%I t where t.tenant_id=$1 and lower(t.code) in (select lower(value) from jsonb_array_elements_text($2))',public.business_entity_table(p_kind))
 into result using a.tenant_id,p_codes,array['code','name','notes']||(select array_agg(key) from jsonb_object_keys((select definition->'fields' from public.business_entity_definitions where kind=p_kind)) key);
 return result;
end $$;

create function public.business_catalog_import_commit(p_hash text,p_slug text,p_kind text,p_request_id uuid,p_file_name text,p_file_hash text,p_rows jsonb,p_payload_hash text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;replayed jsonb;row_input jsonb;old jsonb;result jsonb;results jsonb:='[]';created integer:=0;updated integer:=0;failed integer:=0;error_code text;record_id uuid;expected integer;operation text;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_catalog_import(a.id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 replayed:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'import:'||p_kind,p_payload_hash);if replayed is not null then return replayed;end if;
 if p_file_name is null or char_length(btrim(p_file_name)) not between 1 and 180 or p_file_hash is null or p_file_hash !~ '^[a-f0-9]{64}$'
 or coalesce(jsonb_typeof(p_rows),'')<>'array' or jsonb_array_length(p_rows) not between 1 and 200 or octet_length(p_rows::text)>1000000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) x where coalesce(jsonb_typeof(x),'')<>'object' or not(x ?& array['rowNumber','action','recordId','rowVersion','data']) or coalesce(jsonb_typeof(x->'rowNumber'),'')<>'number' or coalesce(jsonb_typeof(x->'rowVersion'),'')<>'number' or coalesce(jsonb_typeof(x->'recordId'),'')<>'string' or coalesce(x->>'action','') not in ('create','update') or coalesce(jsonb_typeof(x->'data'),'')<>'object' or coalesce(jsonb_typeof(x->'data'->'code'),'')<>'string' or coalesce(char_length(x->'data'->>'code'),0) not between 1 and 50)
 or (select count(distinct lower(x->'data'->>'code')) from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows)
 or (select count(distinct x->>'rowNumber') from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 -- Permission changes fail the whole request; business conflicts are reported per row.
 for row_input in select value from jsonb_array_elements(p_rows) loop
  perform public.business_assert_access(a.id,p_kind,row_input->>'action');
  if (row_input->>'rowNumber')::integer not between 2 and 201 or (row_input->>'recordId')::uuid is null
  or (row_input->>'rowVersion')::integer is null or (row_input->>'rowVersion')::integer<0
  or (row_input->>'action'='create' and (row_input->>'rowVersion')::integer<>0)
  or (row_input->>'action'='update' and (row_input->>'rowVersion')::integer<1) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 end loop;
 for row_input in select value from jsonb_array_elements(p_rows) loop
  record_id:=(row_input->>'recordId')::uuid;expected:=(row_input->>'rowVersion')::integer;operation:=row_input->>'action';
  begin
   if operation='update' then
    execute format('select to_jsonb(t) from public.%I t where tenant_id=$1 and id=$2 and lower(code)=lower($3) for update',public.business_entity_table(p_kind)) into old using a.tenant_id,record_id,row_input->'data'->>'code';
    if old is null or (old->>'row_version')::integer<>expected then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
   end if;
   result:=public.business_save_record(p_hash,p_slug,p_kind,record_id,expected,row_input->'data',gen_random_uuid(),p_payload_hash);
   results:=results||jsonb_build_array(jsonb_build_object('rowNumber',row_input->'rowNumber','code',row_input->'data'->>'code','action',operation,'status',case operation when 'create' then 'created' else 'updated' end,'recordId',result->'recordId','rowVersion',result->'rowVersion'));
   if operation='create' then created:=created+1;else updated:=updated+1;end if;
  exception when others then
   error_code:=sqlerrm;
   if error_code not in ('BUSINESS_VERSION_CONFLICT','BUSINESS_DUPLICATE','BUSINESS_ITEM_UNIT_LOCKED','BUSINESS_RECORD_LOCKED','BUSINESS_INVALID_INPUT') then raise;end if;
   failed:=failed+1;results:=results||jsonb_build_array(jsonb_build_object('rowNumber',row_input->'rowNumber','code',row_input->'data'->>'code','action',operation,'status','failed','errorCode',error_code));
  end;
 end loop;
 result:=jsonb_build_object('requestId',p_request_id,'created',created,'updated',updated,'failed',failed,'results',results);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'import:'||p_kind,p_payload_hash,result);
 insert into public.business_catalog_imports(request_id,tenant_id,actor_id,kind,file_name,file_hash,receipt) values(p_request_id,a.tenant_id,a.id,p_kind,btrim(p_file_name),p_file_hash,result);
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'catalog.imported',p_kind,p_request_id,jsonb_build_object('created',created,'updated',updated,'failed',failed,'fileHash',p_file_hash));
 return result;
end $$;

create function public.business_catalog_import_history(p_hash text,p_slug text,p_kind text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;result jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_catalog_import(a.id,p_kind);
 select coalesce(jsonb_agg(jsonb_build_object('requestId',request_id,'fileName',file_name,'createdAt',created_at,'created',receipt->'created','updated',receipt->'updated','failed',receipt->'failed') order by created_at desc),'[]'::jsonb) into result
 from (select * from public.business_catalog_imports where tenant_id=a.tenant_id and kind=p_kind and (actor_id=a.id or a.role='owner') order by created_at desc,request_id limit 20) recent;
 return result;
end $$;
revoke all on function public.business_assert_catalog_import(uuid,text),public.business_catalog_import_matches(text,text,text,jsonb),public.business_catalog_import_commit(text,text,text,uuid,text,text,jsonb,text),public.business_catalog_import_history(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_catalog_import_matches(text,text,text,jsonb),public.business_catalog_import_commit(text,text,text,uuid,text,text,jsonb,text),public.business_catalog_import_history(text,text,text) to service_role;
notify pgrst,'reload schema';
