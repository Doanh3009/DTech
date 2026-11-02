do $$ begin if to_regclass('storage.buckets') is not null then execute $q$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('business-private','business-private',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types$q$;end if;end $$;

create table public.business_attachments(
 tenant_id uuid not null references public.business_tenants(id),id uuid not null,request_id uuid not null,kind text not null references public.business_entity_definitions(kind),record_id uuid not null,
 file_name text not null,mime_type text not null,byte_size integer not null,sha256 text not null,storage_path text not null,uploaded_by uuid not null,ready boolean not null default false,created_at timestamptz not null default now(),
 primary key(tenant_id,id),unique(tenant_id,request_id),unique(storage_path),foreign key(tenant_id,uploaded_by) references public.business_accounts(tenant_id,id),
 check(byte_size between 1 and 15728640),check(sha256~'^[a-f0-9]{64}$'),check(char_length(file_name) between 1 and 160)
);
create index business_attachments_record on public.business_attachments(tenant_id,kind,record_id,created_at desc) where ready;
alter table public.business_attachments enable row level security;
revoke all on public.business_attachments from public,anon,authenticated,service_role;

create function public.business_attachment_begin(p_hash text,p_slug text,p_request_id uuid,p_kind text,p_record_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;r jsonb;file_id uuid:=p_request_id;path text;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_record_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'update',v);
 if v->>'status'<>'draft' or coalesce(p_size,0) not between 1 and 15728640 or coalesce(p_mime,'') not in ('image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv') or coalesce(char_length(p_name),0) not between 1 and 160 or position('/' in p_name)>0 or position(chr(92) in p_name)>0 or p_name~'[[:cntrl:]]' or coalesce(p_sha256,'')!~'^[a-f0-9]{64}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'attachment.begin',p_payload_hash);if r is not null then return r;end if;
 if exists(select 1 from public.business_attachments where tenant_id=a.tenant_id and request_id=p_request_id) then raise exception 'BUSINESS_IDEMPOTENCY_CONFLICT';end if;
 path:=a.tenant_id::text||'/'||p_kind||'/'||p_record_id::text||'/'||file_id::text;
 insert into public.business_attachments(tenant_id,id,request_id,kind,record_id,file_name,mime_type,byte_size,sha256,storage_path,uploaded_by) values(a.tenant_id,file_id,p_request_id,p_kind,p_record_id,p_name,p_mime,p_size,p_sha256,path,a.id);
 r:=jsonb_build_object('id',file_id,'objectPath',path);insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'attachment.begin',p_payload_hash,r);return r;
end $$;

create function public.business_attachment_complete(p_hash text,p_slug text,p_file_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;f public.business_attachments%rowtype;v jsonb;parent_version integer;review_sql text:='';snapshot_sql text:='';
begin
 a:=public.business_assert_session(p_hash,p_slug,true);
 select * into f from public.business_attachments where tenant_id=a.tenant_id and id=p_file_id for update;if not found or f.uploaded_by<>a.id then raise exception 'BUSINESS_NOT_FOUND';end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(f.kind)) into v using a.tenant_id,f.record_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,f.kind,'update',v);if v->>'status'<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if f.ready then parent_version:=(v->>'row_version')::integer;return jsonb_build_object('id',f.id,'parentVersion',parent_version);end if;
 update public.business_attachments set ready=true where tenant_id=a.tenant_id and id=f.id;
 if exists(select 1 from pg_catalog.pg_attribute where attrelid=('public.'||public.business_entity_table(f.kind))::regclass and attname='reviewed_by' and not attisdropped) then review_sql:=',reviewed_by=null';end if;
 if exists(select 1 from pg_catalog.pg_attribute where attrelid=('public.'||public.business_entity_table(f.kind))::regclass and attname='calculation_snapshot' and not attisdropped) then snapshot_sql:=',calculation_snapshot=null';end if;
 execute format('update public.%I set row_version=row_version+1,updated_at=now()%s%s where tenant_id=$1 and id=$2 returning row_version',public.business_entity_table(f.kind),review_sql,snapshot_sql) into parent_version using a.tenant_id,f.record_id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'attachment.added',f.kind,f.record_id,jsonb_build_object('fileId',f.id,'name',f.file_name,'mimeType',f.mime_type,'sha256',f.sha256));
 return jsonb_build_object('id',f.id,'parentVersion',parent_version);
end $$;

create function public.business_attachments_snapshot(p_hash text,p_slug text,p_kind text,p_record_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;files jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_record_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',v);
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.file_name,'mimeType',f.mime_type,'size',f.byte_size,'sha256',f.sha256,'uploadedAt',f.created_at) order by f.created_at desc,f.id),'[]'::jsonb) into files from public.business_attachments f where f.tenant_id=a.tenant_id and f.kind=p_kind and f.record_id=p_record_id and f.ready;
 return jsonb_build_object('files',files,'parentVersion',v->'row_version');
end $$;

create function public.business_attachment_download(p_hash text,p_slug text,p_kind text,p_record_id uuid,p_file_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;f public.business_attachments%rowtype;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_record_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',v);
 select * into f from public.business_attachments where tenant_id=a.tenant_id and kind=p_kind and record_id=p_record_id and id=p_file_id and ready;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 return jsonb_build_object('objectPath',f.storage_path,'name',f.file_name,'mimeType',f.mime_type,'size',f.byte_size,'sha256',f.sha256);
end $$;

do $$ declare t text;begin foreach t in array array['business_attachment_begin(text,text,uuid,text,uuid,text,text,integer,text,text)','business_attachment_complete(text,text,uuid)','business_attachments_snapshot(text,text,text,uuid)','business_attachment_download(text,text,text,uuid,uuid)'] loop execute format('revoke all on function public.%s from public,anon,authenticated,service_role',t);execute format('grant execute on function public.%s to service_role',t);end loop;end $$;

create or replace function public.business_approval_fingerprint(p_tenant uuid,p_kind text,v jsonb) returns text language plpgsql stable security definer set search_path='' as $$
declare d jsonb;child_kind text;child_field text;children jsonb:='[]';form jsonb;attachments jsonb:='[]';
begin
 select definition into d from public.business_entity_definitions where kind=p_kind;
 child_kind:=coalesce(d->>'lineKind',case p_kind when 'journal_entries' then 'journal_lines' when 'salary_runs' then 'salary_lines' end);
 child_field:=case p_kind when 'journal_entries' then 'journal_id' when 'salary_runs' then 'salary_run_id' else (select definition->>'parentField' from public.business_entity_definitions where kind=child_kind) end;
 if child_kind is not null and child_field is not null then execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]'') from public.%I x where tenant_id=$1 and %I=$2 and status=''active''',public.business_entity_table(child_kind),child_field) into children using p_tenant,(v->>'id')::uuid;end if;
 select jsonb_build_object('formId',form_id,'data',data,'version',row_version) into form from public.business_form_records where tenant_id=p_tenant and kind=p_kind and record_id=(v->>'id')::uuid;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'sha256',sha256,'name',file_name) order by id),'[]'::jsonb) into attachments from public.business_attachments where tenant_id=p_tenant and kind=p_kind and record_id=(v->>'id')::uuid and ready;
 return encode(sha256(convert_to(jsonb_build_object('document',v-array['row_version','reviewed_by','updated_at','references','approval','workflowRequired'],'lines',children,'form',form,'attachments',attachments)::text,'UTF8')),'hex');
end $$;
revoke all on function public.business_approval_fingerprint(uuid,text,jsonb) from public,anon,authenticated,service_role;
