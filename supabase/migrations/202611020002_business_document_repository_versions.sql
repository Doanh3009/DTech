insert into public.business_entity_definitions(kind,definition) values
('document_repository','{"label":"Kho văn bản","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"document_type":{"label":"Loại văn bản","type":"enum","values":{"incoming":"Văn bản đến","outgoing":"Văn bản đi","contract":"Hợp đồng","drawing":"Bản vẽ","procedure":"Quy trình","other":"Khác"},"required":true},"document_number":{"label":"Số văn bản","type":"text","required":true,"max":80},"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"effective_on":{"label":"Ngày hiệu lực","type":"date","required":true},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"confidentiality":{"label":"Mức truy cập","type":"enum","values":{"internal":"Nội bộ","confidential":"Mật","restricted":"Hạn chế"},"default":"internal"},"retention_until":{"label":"Lưu đến ngày","type":"date"},"current_version_id":{"label":"Phiên bản hiện hành","type":"ref","ref":"document_versions","computed":true}}}'::jsonb),
('document_versions','{"label":"Phiên bản văn bản","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"parentKind":"document_repository","parentField":"document_id","fields":{"document_id":{"label":"Văn bản","type":"ref","ref":"document_repository","required":true},"version_number":{"label":"Lần phát hành","type":"number","required":true,"min":1,"integer":true},"change_reason":{"label":"Lý do thay đổi","type":"text","required":true,"max":1000},"effective_on":{"label":"Ngày hiệu lực","type":"date","required":true},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"source_attachment_id":{"label":"Tệp phiên bản","type":"text","computed":true},"source_sha256":{"label":"SHA-256","type":"text","computed":true}}}'::jsonb);

create table public.business_document_repository(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 document_type text not null check(document_type in ('incoming','outgoing','contract','drawing','procedure','other')),
 document_number text not null check(char_length(btrim(document_number)) between 1 and 80),project_id uuid,effective_on date not null,document_date date not null,
 confidentiality text not null default 'internal' check(confidentiality in ('internal','confidential','restricted')),
 retention_until date,current_version_id uuid,
 unique(tenant_id,id),unique(tenant_id,code),unique(tenant_id,document_number),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id),
 check(retention_until is null or retention_until>=effective_on)
);
create unique index business_document_repository_code_idx on public.business_document_repository(tenant_id,lower(code));
create index business_document_repository_project_idx on public.business_document_repository(tenant_id,project_id,effective_on desc);
create index business_document_repository_retention_idx on public.business_document_repository(tenant_id,retention_until) where status='posted' and retention_until is not null;
alter table public.business_document_repository enable row level security;
revoke all on public.business_document_repository from public,anon,authenticated,service_role;

create table public.business_document_versions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 document_id uuid not null,version_number integer not null check(version_number between 1 and 1000000),change_reason text not null check(char_length(btrim(change_reason)) between 1 and 1000),effective_on date not null,document_date date not null,
 source_attachment_id uuid,source_sha256 text,
 unique(tenant_id,id),unique(tenant_id,code),unique(tenant_id,document_id,version_number),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 foreign key(tenant_id,document_id) references public.business_document_repository(tenant_id,id),
 foreign key(tenant_id,source_attachment_id) references public.business_attachments(tenant_id,id),
 check((source_attachment_id is null and source_sha256 is null) or (source_attachment_id is not null and source_sha256~'^[a-f0-9]{64}$'))
);
create unique index business_document_versions_code_idx on public.business_document_versions(tenant_id,lower(code));
create index business_document_versions_history_idx on public.business_document_versions(tenant_id,document_id,version_number desc);
alter table public.business_document_versions enable row level security;
revoke all on public.business_document_versions from public,anon,authenticated,service_role;
alter table public.business_document_repository add constraint business_document_repository_current_version_fk foreign key(tenant_id,current_version_id) references public.business_document_versions(tenant_id,id);

create function public.business_document_repository_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.status='posted' and (new.code,new.name,new.notes,new.document_type,new.document_number,new.project_id,new.effective_on,new.document_date,new.confidentiality,new.retention_until) is distinct from (old.code,old.name,old.notes,old.document_type,old.document_number,old.project_id,old.effective_on,old.document_date,old.confidentiality,old.retention_until) then raise exception 'BUSINESS_DOCUMENT_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_document_repository_guard() from public,anon,authenticated,service_role;
create trigger business_document_repository_guard before update on public.business_document_repository for each row execute function public.business_document_repository_guard();

create function public.business_document_version_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.business_document_repository%rowtype;attachment public.business_attachments%rowtype;latest integer;
begin
 if tg_op='UPDATE' and old.status='posted' then raise exception 'BUSINESS_DOCUMENT_VERSION_LOCKED';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  select * into parent from public.business_document_repository where tenant_id=new.tenant_id and id=new.document_id for update;
  if not found or parent.status<>'posted' then raise exception 'BUSINESS_DOCUMENT_PARENT_NOT_PUBLISHED';end if;
  select coalesce(max(version_number),0) into latest from public.business_document_versions where tenant_id=new.tenant_id and document_id=new.document_id and status='posted' and id<>new.id;
  if new.version_number<>latest+1 then raise exception 'BUSINESS_DOCUMENT_VERSION_SEQUENCE';end if;
  if new.effective_on<parent.effective_on then raise exception 'BUSINESS_INVALID_DATE';end if;
  select * into attachment from public.business_attachments where tenant_id=new.tenant_id and kind='document_versions' and record_id=new.id and ready;
  if not found then raise exception 'BUSINESS_DOCUMENT_VERSION_FILE_REQUIRED';end if;
  new.source_attachment_id:=attachment.id;new.source_sha256:=attachment.sha256;
 end if;
 return new;
end $$;
revoke all on function public.business_document_version_guard() from public,anon,authenticated,service_role;
create trigger business_document_version_guard before insert or update on public.business_document_versions for each row execute function public.business_document_version_guard();

create function public.business_document_version_publish() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='posted' and old.status is distinct from new.status then
  update public.business_document_repository set current_version_id=new.id,updated_at=now() where tenant_id=new.tenant_id and id=new.document_id;
 end if;
 return new;
end $$;
revoke all on function public.business_document_version_publish() from public,anon,authenticated,service_role;
create trigger business_document_version_publish after update of status on public.business_document_versions for each row execute function public.business_document_version_publish();

do $$
declare body text;anchor text;replacement text;
begin
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 anchor:='elsif p_kind=''document_signing_requests'' then return jsonb_build_object(''lines'',''[]''::jsonb);';
 replacement:=anchor||E'\n'||' elsif p_kind in (''document_repository'',''document_versions'') then return jsonb_build_object(''lines'',''[]''::jsonb);';
 if strpos(body,anchor)=0 then raise exception 'Review MISA dispatch before adding document repository';end if;
 execute replace(body,anchor,replacement);
end $$;
