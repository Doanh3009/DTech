insert into public.business_entity_definitions(kind,definition) values ('document_signing_requests','{"label":"Yêu cầu ký văn bản","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"source_kind":{"label":"Loại hồ sơ nguồn","type":"text","required":true,"max":80},"source_record_id":{"label":"Mã hồ sơ nguồn","type":"text","required":true,"max":36},"source_version":{"label":"Phiên bản hồ sơ","type":"number","required":true,"min":1},"source_attachment_id":{"label":"Tệp cần ký","type":"text","required":true,"max":36},"provider_key":{"label":"Nhà cung cấp ký","type":"text","required":true,"max":50},"idempotency_key":{"label":"Mã yêu cầu duy nhất","type":"text","required":true,"max":100},"signer_staff_id":{"label":"Người ký","type":"ref","ref":"staff","requiresFeature":"people","required":true},"signer_email":{"label":"Email người ký","type":"text","max":254,"readRoles":["owner","editor"]},"requested_on":{"label":"Ngày gửi ký","type":"date","required":true},"expires_on":{"label":"Hạn ký","type":"date"},"document_date":{"label":"Ngày chứng từ","type":"date","required":true}}}'::jsonb);

create table public.business_document_signing_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 source_kind text not null references public.business_entity_definitions(kind),source_record_id uuid not null,source_version integer not null check(source_version>0),source_attachment_id uuid not null,source_sha256 text,
 provider_key text not null check(provider_key ~ '^[a-z][a-z0-9._-]{1,49}$'),idempotency_key text not null check(char_length(idempotency_key) between 8 and 100),signer_staff_id uuid not null,signer_email text,requested_on date not null,expires_on date,document_date date not null,
 signing_state text not null default 'draft' check(signing_state in ('draft','queued','sending','retry','sent','signed','rejected','expired','failed')),
 attempt_count integer not null default 0 check(attempt_count>=0),next_attempt_at timestamptz,last_error text,external_request_id text,submitted_at timestamptz,completed_at timestamptz,
 signed_attachment_id uuid,signed_sha256 text,last_provider_event_id text,
 unique(tenant_id,id),unique(tenant_id,code),unique(tenant_id,idempotency_key),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,signer_staff_id) references public.business_staff(tenant_id,id),foreign key(tenant_id,source_attachment_id) references public.business_attachments(tenant_id,id),foreign key(tenant_id,signed_attachment_id) references public.business_attachments(tenant_id,id),check(expires_on is null or expires_on>=requested_on),check((signing_state<>'signed') or (signed_attachment_id is not null and signed_sha256~'^[a-f0-9]{64}$' and completed_at is not null))
);
create index business_document_signing_outbox_idx on public.business_document_signing_requests(tenant_id,next_attempt_at,created_at) where status='posted' and signing_state in ('queued','retry');
create unique index business_document_signing_external_ref_idx on public.business_document_signing_requests(tenant_id,provider_key,external_request_id) where external_request_id is not null;
alter table public.business_document_signing_requests enable row level security;
revoke all on public.business_document_signing_requests from public,anon,authenticated,service_role;

create table public.business_document_signing_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),request_id uuid not null,provider_key text not null,provider_event_id text not null check(char_length(provider_event_id) between 1 and 180),event_type text not null check(event_type in ('signed','rejected','expired','failed')),payload_sha256 text not null check(payload_sha256~'^[a-f0-9]{64}$'),signature_verified boolean not null,provider_request_id text,signed_attachment_id uuid,occurred_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,provider_key,provider_event_id),foreign key(tenant_id,request_id) references public.business_document_signing_requests(tenant_id,id),foreign key(tenant_id,signed_attachment_id) references public.business_attachments(tenant_id,id)
);
create index business_document_signing_events_request_idx on public.business_document_signing_events(tenant_id,request_id,occurred_at);
alter table public.business_document_signing_events enable row level security;
revoke all on public.business_document_signing_events from public,anon,authenticated,service_role;

create function public.business_document_signing_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare source jsonb;attachment public.business_attachments%rowtype;signer public.business_staff%rowtype;signed_file public.business_attachments%rowtype;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.source_kind,new.source_record_id,new.source_version,new.source_attachment_id,new.provider_key,new.idempotency_key,new.signer_staff_id,new.signer_email,new.requested_on,new.expires_on,new.document_date,new.name,new.notes) is distinct from (old.source_kind,old.source_record_id,old.source_version,old.source_attachment_id,old.provider_key,old.idempotency_key,old.signer_staff_id,old.signer_email,old.requested_on,old.expires_on,old.document_date,old.name,old.notes) then raise exception 'BUSINESS_SIGNING_REQUEST_LOCKED';end if;
 if tg_op='UPDATE' and old.signing_state in ('signed','rejected','expired','failed') and new.signing_state is distinct from old.signing_state then raise exception 'BUSINESS_SIGNING_TERMINAL';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  if new.requested_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date or (new.expires_on is not null and new.expires_on<(now() at time zone 'Asia/Ho_Chi_Minh')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
  if not exists(select 1 from public.business_entity_definitions where kind=new.source_kind and definition->>'mode'='document') then raise exception 'BUSINESS_INVALID_SIGNING_SOURCE';end if;
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(new.source_kind)) into source using new.tenant_id,new.source_record_id;
  if source is null or source->>'status'<>'posted' or (source->>'row_version')::integer<>new.source_version then raise exception 'BUSINESS_SIGNING_SOURCE_VERSION_MISMATCH';end if;
  select * into attachment from public.business_attachments where tenant_id=new.tenant_id and id=new.source_attachment_id and kind=new.source_kind and record_id=new.source_record_id and ready;
  if not found then raise exception 'BUSINESS_SIGNING_ATTACHMENT_REQUIRED';end if;
  select * into signer from public.business_staff where tenant_id=new.tenant_id and id=new.signer_staff_id and status='active';if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  new.source_sha256:=attachment.sha256;new.signing_state:='queued';new.next_attempt_at:=now();new.attempt_count:=0;new.last_error:=null;
 end if;
 if new.signing_state='signed' and new.status='posted' then
  select * into signed_file from public.business_attachments where tenant_id=new.tenant_id and id=new.signed_attachment_id and kind='document_signing_requests' and record_id=new.id and ready;
  if not found or new.signed_sha256 is distinct from signed_file.sha256 or new.completed_at is null then raise exception 'BUSINESS_SIGNED_FILE_INVALID';end if;
 end if;
 return new;
end $$;
revoke all on function public.business_document_signing_guard() from public,anon,authenticated,service_role;
create trigger business_document_signing_guard before insert or update on public.business_document_signing_requests for each row execute function public.business_document_signing_guard();

create function public.business_document_signing_claim(p_tenant uuid,p_limit integer default 10) returns setof jsonb language plpgsql security definer set search_path='' as $$
declare n integer:=greatest(1,least(coalesce(p_limit,10),100));
begin
 return query with picked as (select id from public.business_document_signing_requests where tenant_id=p_tenant and status='posted' and signing_state in ('queued','retry') and coalesce(next_attempt_at,now())<=now() order by coalesce(next_attempt_at,created_at),created_at for update skip locked limit n),changed as (update public.business_document_signing_requests r set signing_state='sending',attempt_count=r.attempt_count+1,next_attempt_at=null,updated_at=now() from picked p where r.tenant_id=p_tenant and r.id=p.id returning to_jsonb(r) as request_data) select request_data from changed;
end $$;
revoke all on function public.business_document_signing_claim(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_document_signing_claim(uuid,integer) to service_role;

create function public.business_document_signing_dispatch_result(p_tenant uuid,p_request uuid,p_external_request_id text,p_error text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.business_document_signing_requests%rowtype;
begin
 select * into r from public.business_document_signing_requests where tenant_id=p_tenant and id=p_request for update;if not found or r.status<>'posted' or r.signing_state<>'sending' then raise exception 'BUSINESS_SIGNING_STATE_CONFLICT';end if;
 if p_error is null then if nullif(btrim(p_external_request_id),'') is null then raise exception 'BUSINESS_PROVIDER_REFERENCE_REQUIRED';end if;update public.business_document_signing_requests set signing_state='sent',external_request_id=btrim(p_external_request_id),submitted_at=now(),last_error=null,updated_at=now() where tenant_id=p_tenant and id=p_request;return jsonb_build_object('status','sent','attempt',r.attempt_count);
 else update public.business_document_signing_requests set signing_state=case when attempt_count>=5 then 'failed' else 'retry' end,last_error=left(btrim(p_error),500),next_attempt_at=case when attempt_count>=5 then null else now()+make_interval(secs=>least(3600,30*(2^least(attempt_count,7)))::double precision) end,updated_at=now() where tenant_id=p_tenant and id=p_request;return jsonb_build_object('status',case when r.attempt_count>=5 then 'failed' else 'retry' end,'attempt',r.attempt_count);
 end if;
end $$;
revoke all on function public.business_document_signing_dispatch_result(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_document_signing_dispatch_result(uuid,uuid,text,text) to service_role;

create function public.business_document_signing_apply_event(p_tenant uuid,p_request uuid,p_provider_event_id text,p_event_type text,p_external_request_id text,p_payload_sha256 text,p_signature_verified boolean,p_signed_attachment_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.business_document_signing_requests%rowtype;existing public.business_document_signing_events%rowtype;file public.business_attachments%rowtype;next_state text;file_hash text;
begin
 if coalesce(current_setting('role',true),'')<>'service_role' or p_signature_verified is distinct from true then raise exception 'BUSINESS_PROVIDER_SIGNATURE_INVALID';end if;
 if p_event_type not in ('signed','rejected','expired','failed') or nullif(btrim(p_provider_event_id),'') is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'BUSINESS_INVALID_PROVIDER_EVENT';end if;
 select * into r from public.business_document_signing_requests where tenant_id=p_tenant and id=p_request for update;if not found or r.status<>'posted' then raise exception 'BUSINESS_SIGNING_REQUEST_NOT_FOUND';end if;
 select * into existing from public.business_document_signing_events where tenant_id=p_tenant and provider_key=r.provider_key and provider_event_id=p_provider_event_id;if found then if existing.payload_sha256<>p_payload_sha256 or existing.request_id<>p_request then raise exception 'BUSINESS_PROVIDER_EVENT_CONFLICT';end if;return jsonb_build_object('duplicate',true,'status',r.signing_state);end if;
 if r.signing_state not in ('sent','sending','retry') then raise exception 'BUSINESS_SIGNING_STATE_CONFLICT';end if;if r.external_request_id is not null and p_external_request_id is distinct from r.external_request_id then raise exception 'BUSINESS_PROVIDER_REFERENCE_MISMATCH';end if;
 next_state:=p_event_type;
 if p_event_type='signed' then select * into file from public.business_attachments where tenant_id=p_tenant and id=p_signed_attachment_id and kind='document_signing_requests' and record_id=p_request and ready;if not found then raise exception 'BUSINESS_SIGNED_FILE_INVALID';end if;file_hash:=file.sha256;
 elsif p_signed_attachment_id is not null then raise exception 'BUSINESS_SIGNED_FILE_INVALID';end if;
 insert into public.business_document_signing_events(tenant_id,request_id,provider_key,provider_event_id,event_type,payload_sha256,signature_verified,provider_request_id,signed_attachment_id) values(p_tenant,p_request,r.provider_key,p_provider_event_id,p_event_type,p_payload_sha256,true,p_external_request_id,p_signed_attachment_id);
 update public.business_document_signing_requests set signing_state=next_state,external_request_id=coalesce(external_request_id,p_external_request_id),signed_attachment_id=p_signed_attachment_id,signed_sha256=file_hash,completed_at=now(),last_provider_event_id=p_provider_event_id,last_error=case when p_event_type='failed' then 'Provider reported signing failure' else null end,next_attempt_at=null,updated_at=now() where tenant_id=p_tenant and id=p_request;
 return jsonb_build_object('duplicate',false,'status',next_state,'signedSha256',file_hash);
end $$;
revoke all on function public.business_document_signing_apply_event(uuid,uuid,text,text,text,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_document_signing_apply_event(uuid,uuid,text,text,text,text,boolean,uuid) to service_role;

do $$
declare body text;anchor text;replacement text;
begin select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;anchor:='elsif p_kind in (''performance_cycles'',''performance_goals'',''performance_goal_checkins'',''performance_goal_changes'',''performance_reviews'',''performance_review_acknowledgements'') then return jsonb_build_object(''lines'',''[]''::jsonb);';replacement:=anchor||E'\n'||' elsif p_kind=''document_signing_requests'' then return jsonb_build_object(''lines'',''[]''::jsonb);';if strpos(body,anchor)=0 then raise exception 'Review MISA dispatch before adding document signing requests';end if;execute replace(body,anchor,replacement);end $$;
