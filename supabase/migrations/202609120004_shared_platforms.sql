create extension if not exists pgcrypto;

create table if not exists public.approval_workflows (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  domain_type text not null, active boolean not null default true, published_version integer not null default 0,
  expected_processing_hours integer check(expected_processing_hours is null or expected_processing_hours > 0),
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.approval_workflow_versions (
  id uuid primary key default gen_random_uuid(), workflow_id uuid not null references public.approval_workflows(id) on delete restrict,
  version integer not null check(version > 0), status text not null check(status in ('draft','published','retired')),
  published_at timestamptz, published_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  unique(workflow_id,version)
);
create table if not exists public.approval_workflow_steps (
  id uuid primary key default gen_random_uuid(), workflow_version_id uuid not null references public.approval_workflow_versions(id) on delete cascade,
  step_order integer not null check(step_order > 0), step_name text not null,
  approver_source text not null check(approver_source in ('direct_manager','department_manager','project_manager','specific_role','specific_user','hr_resolver','warehouse_manager','domain_resolver')),
  resolver_config jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(workflow_version_id,step_order)
);
create table if not exists public.approval_cases (
  id uuid primary key default gen_random_uuid(), domain_type text not null, domain_id text not null, reference_number text not null,
  requester_account_id uuid references public.app_accounts(id), requester_employee_id uuid references public.employees(id),
  requester_name text not null, organization_name text, summary text not null, domain_link text not null,
  workflow_id uuid references public.approval_workflows(id), workflow_version integer not null default 1,
  status text not null check(status in ('pending','approved','rejected','cancelled','withdrawn')),
  current_step integer, metadata_summary jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(), completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(domain_type,domain_id)
);
create table if not exists public.approval_steps (
  id uuid primary key default gen_random_uuid(), approval_case_id uuid not null references public.approval_cases(id) on delete restrict,
  source_step_id text, step_order integer not null check(step_order > 0), step_name text not null, approver_source text not null,
  resolved_approver_account_id uuid references public.app_accounts(id), resolved_approver_name text,
  status text not null check(status in ('pending','approved','rejected','skipped','cancelled')),
  acted_by_account_id uuid references public.app_accounts(id), acted_at timestamptz, comment text,
  delegated_from_account_id uuid references public.app_accounts(id), created_at timestamptz not null default now(),
  unique(approval_case_id,step_order), unique(source_step_id)
);
create table if not exists public.approval_reassignments (
  id uuid primary key default gen_random_uuid(), approval_step_id uuid not null references public.approval_steps(id) on delete restrict,
  from_account_id uuid references public.app_accounts(id), to_account_id uuid not null references public.app_accounts(id),
  reason text not null check(length(trim(reason)) >= 3), reassigned_by uuid not null references public.app_accounts(id), created_at timestamptz not null default now()
);
create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(), from_account_id uuid not null references public.app_accounts(id), to_account_id uuid not null references public.app_accounts(id),
  start_at timestamptz not null, end_at timestamptz not null, scope text not null default 'ALL_APPROVALS',
  status text not null default 'active' check(status in ('active','inactive','expired','revoked')),
  reason text not null check(length(trim(reason)) >= 3), created_by uuid not null references public.app_accounts(id), created_at timestamptz not null default now(),
  check(from_account_id <> to_account_id), check(end_at > start_at)
);
create index if not exists approval_cases_status_idx on public.approval_cases(status,submitted_at desc);
create index if not exists approval_steps_assignee_idx on public.approval_steps(resolved_approver_account_id,status,created_at);
create index if not exists approval_delegations_window_idx on public.approval_delegations(from_account_id,status,start_at,end_at);

create table if not exists public.domain_events (
  id uuid primary key default gen_random_uuid(), event_key text not null, aggregate_type text not null, aggregate_id text not null,
  actor_account_id uuid references public.app_accounts(id), correlation_id uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), processed_at timestamptz,
  idempotency_key text not null unique
);
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(), event_key text not null unique, title_template text not null, message_template text not null,
  allowed_placeholders text[] not null default '{}', mandatory boolean not null default false, active boolean not null default true,
  version integer not null default 1, updated_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(title_template !~* '<[^>]+>' and message_template !~* '<[^>]+>')
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_account_id uuid not null references public.app_accounts(id) on delete cascade,
  event_id uuid references public.domain_events(id), event_key text not null, type text not null, title text not null, message text not null,
  entity_type text, entity_id text, deep_link text, priority text not null default 'normal' check(priority in ('normal','important','critical')),
  channel text not null default 'in_app' check(channel in ('in_app','email','zalo','slack','push')),
  template_version integer, read_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now(),
  delivery_key text not null unique, check(title !~* '<[^>]+>' and message !~* '<[^>]+>')
);
create table if not exists public.notification_preferences (
  account_id uuid not null references public.app_accounts(id) on delete cascade, category text not null,
  in_app_enabled boolean not null default true, email_enabled boolean not null default false, updated_at timestamptz not null default now(),
  primary key(account_id,category)
);
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_account_id,created_at desc) where read_at is null;
create index if not exists domain_events_pending_idx on public.domain_events(processed_at,occurred_at);

create table if not exists public.document_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, active boolean not null default true,
  sort_order integer not null default 100, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), title text not null, document_type_id uuid not null references public.document_types(id),
  current_file_id uuid not null references public.file_assets(id) on delete restrict, owner_entity_type text not null, owner_entity_id text not null,
  owner_reference text, visibility_scope text not null check(visibility_scope in ('domain_private','project','company_wide')),
  status text not null default 'active' check(status in ('active','archived','replaced','deleted_pending_retention')),
  current_version integer not null default 1, expiry_date date, uploaded_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(current_file_id)
);
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete restrict,
  version_number integer not null check(version_number > 0), file_id uuid not null references public.file_assets(id) on delete restrict,
  uploaded_by uuid references public.app_accounts(id), uploaded_at timestamptz not null default now(), change_note text,
  unique(document_id,version_number), unique(file_id)
);
create table if not exists public.document_links (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade,
  entity_type text not null, entity_id text not null, relation_type text not null, created_at timestamptz not null default now(),
  unique(document_id,entity_type,entity_id,relation_type)
);
create index if not exists documents_search_idx on public.documents(status,visibility_scope,updated_at desc);
create index if not exists document_links_entity_idx on public.document_links(entity_type,entity_id);

create table if not exists public.system_notices (
  id uuid primary key default gen_random_uuid(), title text not null, message text not null, start_at timestamptz not null, end_at timestamptz not null,
  audience_type text not null check(audience_type in ('all_users','specific_roles','specific_departments')), audience_ids uuid[] not null default '{}',
  priority text not null default 'normal' check(priority in ('normal','important','critical')), status text not null default 'active' check(status in ('draft','active','inactive')),
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_at > start_at)
);
create table if not exists public.business_configuration_catalog (
  key text primary key, group_key text not null, label text not null, route text not null, permission_key text not null,
  status text not null default 'active' check(status in ('active','inactive')), effective_from date, effective_to date,
  sort_order integer not null default 100, check(effective_to is null or effective_from is null or effective_to >= effective_from)
);

alter table public.audit_logs add column if not exists actor_employee_id uuid references public.employees(id);
alter table public.audit_logs add column if not exists entity_reference text;
alter table public.audit_logs add column if not exists module text;
alter table public.audit_logs add column if not exists source text not null default 'web';
alter table public.audit_logs add column if not exists ip_address inet;
alter table public.audit_logs add column if not exists user_agent_summary text;
alter table public.audit_logs add column if not exists correlation_id uuid;
alter table public.audit_logs add column if not exists severity text not null default 'normal' check(severity in ('normal','security','sensitive'));
create index if not exists audit_logs_filter_idx on public.audit_logs(happened_at desc,module,action);
create index if not exists audit_logs_correlation_idx on public.audit_logs(correlation_id) where correlation_id is not null;
create or replace function public.protect_audit_log() returns trigger language plpgsql as $$ begin raise exception 'AUDIT_LOG_APPEND_ONLY'; end $$;
drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only before update or delete on public.audit_logs for each row execute function public.protect_audit_log();

create or replace function public.touch_shared_platform_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger approval_workflows_touch before update on public.approval_workflows for each row execute function public.touch_shared_platform_updated_at();
create trigger approval_cases_touch before update on public.approval_cases for each row execute function public.touch_shared_platform_updated_at();
create trigger notification_templates_touch before update on public.notification_templates for each row execute function public.touch_shared_platform_updated_at();
create trigger document_types_touch before update on public.document_types for each row execute function public.touch_shared_platform_updated_at();
create trigger documents_touch before update on public.documents for each row execute function public.touch_shared_platform_updated_at();
create trigger system_notices_touch before update on public.system_notices for each row execute function public.touch_shared_platform_updated_at();

create or replace function public.process_approval_case(p_case_id uuid,p_actor_id uuid,p_action text,p_comment text default null)
returns text language plpgsql security definer set search_path=public as $$
declare v_case approval_cases%rowtype; v_step approval_steps%rowtype; v_next approval_steps%rowtype;
begin
  select * into v_case from approval_cases where id=p_case_id for update;
  if not found then raise exception 'APPROVAL_NOT_FOUND'; end if;
  if v_case.status<>'pending' then raise exception 'APPROVAL_ALREADY_COMPLETED'; end if;
  select * into v_step from approval_steps where approval_case_id=p_case_id and status='pending' order by step_order limit 1 for update;
  if not found then raise exception 'APPROVAL_STEP_NOT_FOUND'; end if;
  if v_step.resolved_approver_account_id is distinct from p_actor_id then
    if not exists(select 1 from approval_delegations d where d.from_account_id=v_step.resolved_approver_account_id and d.to_account_id=p_actor_id and d.status='active' and now() between d.start_at and d.end_at and (d.scope='ALL_APPROVALS' or d.scope=v_case.domain_type)) then
      raise exception 'APPROVAL_ASSIGNEE_MISMATCH';
    end if;
    update approval_steps set delegated_from_account_id=v_step.resolved_approver_account_id where id=v_step.id;
  end if;
  if p_action='reject' then
    if length(trim(coalesce(p_comment,'')))<3 then raise exception 'APPROVAL_REJECT_REASON_REQUIRED'; end if;
    update approval_steps set status='rejected',acted_by_account_id=p_actor_id,acted_at=now(),comment=p_comment where id=v_step.id and status='pending';
    update approval_steps set status='cancelled' where approval_case_id=p_case_id and status='pending';
    update approval_cases set status='rejected',completed_at=now() where id=p_case_id;
  elsif p_action='approve' then
    update approval_steps set status='approved',acted_by_account_id=p_actor_id,acted_at=now(),comment=nullif(trim(coalesce(p_comment,'')),'') where id=v_step.id and status='pending';
    select * into v_next from approval_steps where approval_case_id=p_case_id and status='pending' order by step_order limit 1;
    if found then update approval_cases set current_step=v_next.step_order where id=p_case_id;
    else update approval_cases set status='approved',current_step=null,completed_at=now() where id=p_case_id; end if;
  else raise exception 'APPROVAL_ACTION_INVALID'; end if;
  return (select status from approval_cases where id=p_case_id);
end $$;

create or replace function public.reassign_approval_step(p_case_id uuid,p_actor_id uuid,p_to_account_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_step approval_steps%rowtype; v_id uuid;
begin
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'REASSIGN_REASON_REQUIRED'; end if;
  if not exists(select 1 from app_accounts where id=p_to_account_id and status='active') then raise exception 'REASSIGN_TARGET_INVALID'; end if;
  select * into v_step from approval_steps where approval_case_id=p_case_id and status='pending' order by step_order limit 1 for update;
  if not found then raise exception 'APPROVAL_STEP_NOT_FOUND'; end if;
  insert into approval_reassignments(approval_step_id,from_account_id,to_account_id,reason,reassigned_by) values(v_step.id,v_step.resolved_approver_account_id,p_to_account_id,p_reason,p_actor_id) returning id into v_id;
  update approval_steps set resolved_approver_account_id=p_to_account_id,resolved_approver_name=(select display_name from app_accounts where id=p_to_account_id) where id=v_step.id;
  return v_id;
end $$;

revoke all on function public.process_approval_case(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.reassign_approval_step(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.process_approval_case(uuid,uuid,text,text),public.reassign_approval_step(uuid,uuid,uuid,text) to service_role;

insert into public.document_types(code,name,sort_order) values
 ('EMPLOYEE_CONTRACT','Hợp đồng lao động',10),('PROJECT_DOCUMENT','Tài liệu dự án',20),('DRAWING','Bản vẽ',30),('MINUTES','Biên bản',40),
 ('IMPORT_EXPORT','Chứng từ XNK',50),('WAREHOUSE','Phiếu kho',60),('PROCEDURE','Quy trình nội bộ',70),('FORM','Biểu mẫu',80),('OTHER','Khác',100)
on conflict(code) do update set name=excluded.name,sort_order=excluded.sort_order;

insert into public.notification_templates(event_key,title_template,message_template,allowed_placeholders,mandatory) values
 ('approval.required','Yêu cầu cần phê duyệt','{{reference_number}} đang chờ bạn xử lý.',array['reference_number'],true),
 ('approval.approved','Yêu cầu đã được duyệt','{{reference_number}} đã hoàn tất phê duyệt.',array['reference_number'],true),
 ('approval.rejected','Yêu cầu bị từ chối','{{reference_number}} đã bị từ chối.',array['reference_number'],true),
 ('shipment.eta.changed','ETA lô hàng thay đổi','{{shipment_number}} có ETA mới.',array['shipment_number'],false),
 ('document.expiring_soon','Tài liệu sắp hết hạn','{{document_title}} sắp hết hạn.',array['document_title'],false),
 ('document.replaced','Tài liệu có phiên bản mới','{{document_title}} vừa được thay thế.',array['document_title'],false),
 ('system.notice','{{notice_title}}','{{notice_message}}',array['notice_title','notice_message'],true)
on conflict(event_key) do nothing;

insert into public.approval_workflows(id,code,name,domain_type,active,published_version,created_by,created_at,updated_at)
select id,code,name,'LEAVE',active,1,created_by,created_at,updated_at from public.leave_workflows
on conflict(id) do update set code=excluded.code,name=excluded.name,active=excluded.active;
insert into public.approval_workflow_versions(workflow_id,version,status,published_at,published_by,created_at)
select id,1,'published',created_at,created_by,created_at from public.leave_workflows
on conflict(workflow_id,version) do nothing;
insert into public.approval_workflow_steps(workflow_version_id,step_order,step_name,approver_source,resolver_config,created_at)
select v.id,s.step_order,'Bước '||s.step_order,
  case s.approver_source::text when 'hr_role' then 'hr_resolver' else s.approver_source::text end,
  jsonb_strip_nulls(jsonb_build_object('accountId',s.specific_account_id,'roleCode',s.specific_role_code)),s.created_at
from public.leave_workflow_steps s join public.approval_workflow_versions v on v.workflow_id=s.workflow_id and v.version=1
on conflict(workflow_version_id,step_order) do nothing;

insert into public.business_configuration_catalog(key,group_key,label,route,permission_key,sort_order) values
 ('organization','organization','Tổ chức','/settings/organization','organization_settings.view',10),
 ('departments','human_resources','Phòng ban','/employees','department.manage',20),('positions','human_resources','Chức danh','/employees','position.manage',30),
 ('attendance','attendance','Chấm công','/settings/attendance','attendance.config.view',10),('shifts','attendance','Ca làm','/settings/attendance/shifts','shift.view',20),('locations','attendance','Địa điểm','/settings/attendance/locations','attendance.config.view',30),
 ('leave','approval','Nghỉ phép','/settings/leave','leave.policy.manage',10),('approval_workflows','approval','Quy trình duyệt','/settings/approval-workflows','approval.workflow.manage',20),('approval_delegations','approval','Ủy quyền duyệt','/settings/approval-delegations','approval.delegation.manage',30),
 ('projects','projects','Dự án','/projects','project.view',10),('warehouse','warehouse','Kho','/settings/warehouse','warehouse.master.manage',10),('import_export','import_export','Xuất nhập khẩu','/settings/import-export','module.manage',10),
 ('export_templates','reports','Mẫu xuất dữ liệu','/settings/export-templates','export_template.manage',10),('notifications','notifications','Thông báo','/settings/notifications','notification.preference.manage',10),
 ('integrations','integrations','Tích hợp','/settings/integrations','integration.view',10),('audit','security','Audit log','/system-admin/audit','audit.view',10)
on conflict(key) do update set group_key=excluded.group_key,label=excluded.label,route=excluded.route,permission_key=excluded.permission_key,sort_order=excluded.sort_order;

insert into public.permissions(key,module,description) values
 ('approval.inbox.view','approvals','Xem trung tâm phê duyệt'),('approval.view_assigned','approvals','Xem yêu cầu được giao'),('approval.view_all','approvals','Xem mọi yêu cầu phê duyệt'),
 ('approval.act','approvals','Thực hiện phê duyệt'),('approval.reassign','approvals','Chuyển người duyệt'),('approval.workflow.manage','approvals','Quản lý quy trình duyệt'),('approval.delegation.manage','approvals','Quản lý ủy quyền duyệt'),
 ('notification.self.view','notifications','Xem thông báo cá nhân'),('notification.preference.manage','notifications','Quản lý tùy chọn thông báo'),('notification.system_notice.manage','notifications','Quản lý thông báo hệ thống'),
 ('document.view','documents','Xem trung tâm tài liệu'),('document.upload','documents','Tải tài liệu'),('document.replace','documents','Thay phiên bản tài liệu'),('document.archive','documents','Lưu trữ tài liệu'),('document.company_manage','documents','Quản lý tài liệu nội bộ'),
 ('audit.view_sensitive','settings','Xem sự kiện audit nhạy cảm'),('settings.manage','settings','Quản lý cấu hình nghiệp vụ')
on conflict(key) do update set module=excluded.module,description=excluded.description;
insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r cross join public.permissions p where r.code='admin' and p.module in ('approvals','notifications','documents','settings') on conflict do nothing;

alter table public.approval_workflows enable row level security; alter table public.approval_workflow_versions enable row level security; alter table public.approval_workflow_steps enable row level security;
alter table public.approval_cases enable row level security; alter table public.approval_steps enable row level security; alter table public.approval_reassignments enable row level security; alter table public.approval_delegations enable row level security;
alter table public.domain_events enable row level security; alter table public.notification_templates enable row level security; alter table public.notifications enable row level security; alter table public.notification_preferences enable row level security;
alter table public.document_types enable row level security; alter table public.documents enable row level security; alter table public.document_versions enable row level security; alter table public.document_links enable row level security;
alter table public.system_notices enable row level security; alter table public.business_configuration_catalog enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-documents','company-documents',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.documents(id,title,document_type_id,current_file_id,owner_entity_type,owner_entity_id,visibility_scope,status,current_version,uploaded_by,created_at,updated_at)
select gen_random_uuid(),coalesce(nullif(f.metadata->>'originalName',''),nullif(f.metadata->>'fileName',''),'Tài liệu'),
  coalesce((select id from document_types where code=case when f.owner_entity_type='shipment_document' then 'IMPORT_EXPORT' when f.owner_entity_type='inventory_document' then 'WAREHOUSE' when f.owner_entity_type='project_update' then 'PROJECT_DOCUMENT' when f.owner_entity_type in ('employee','employee_document','leave_request') then 'EMPLOYEE_CONTRACT' else 'OTHER' end),(select id from document_types where code='OTHER')),
  f.id,f.owner_entity_type,f.owner_entity_id,case when f.visibility='internal' then 'company_wide' when f.owner_entity_type='project_update' then 'project' else 'domain_private' end,'active',1,f.created_by,f.created_at,f.created_at
from public.file_assets f on conflict(current_file_id) do nothing;
insert into public.document_versions(document_id,version_number,file_id,uploaded_by,uploaded_at)
select d.id,1,d.current_file_id,d.uploaded_by,d.created_at from public.documents d on conflict(file_id) do nothing;
insert into public.document_links(document_id,entity_type,entity_id,relation_type)
select d.id,d.owner_entity_type,d.owner_entity_id,upper(d.owner_entity_type)||'_ATTACHMENT' from public.documents d on conflict do nothing;

create or replace function public.index_domain_file_as_document() returns trigger language plpgsql security definer set search_path=public as $$
declare v_document_id uuid; v_type_code text;
begin
  if new.owner_entity_type='company_document' then return new; end if;
  v_type_code:=case when new.owner_entity_type='shipment_document' then 'IMPORT_EXPORT' when new.owner_entity_type='inventory_document' then 'WAREHOUSE' when new.owner_entity_type='project_update' then 'PROJECT_DOCUMENT' when new.owner_entity_type in ('employee','employee_document','leave_request') then 'EMPLOYEE_CONTRACT' else 'OTHER' end;
  insert into documents(title,document_type_id,current_file_id,owner_entity_type,owner_entity_id,visibility_scope,status,current_version,uploaded_by,created_at,updated_at)
  values(coalesce(nullif(new.metadata->>'originalName',''),nullif(new.metadata->>'fileName',''),'Tài liệu'),(select id from document_types where code=v_type_code),new.id,new.owner_entity_type,new.owner_entity_id,case when new.visibility='internal' then 'company_wide' when new.owner_entity_type='project_update' then 'project' else 'domain_private' end,'active',1,new.created_by,new.created_at,new.created_at)
  on conflict(current_file_id) do nothing returning id into v_document_id;
  if v_document_id is not null then
    insert into document_versions(document_id,version_number,file_id,uploaded_by,uploaded_at) values(v_document_id,1,new.id,new.created_by,new.created_at) on conflict(file_id) do nothing;
    insert into document_links(document_id,entity_type,entity_id,relation_type) values(v_document_id,new.owner_entity_type,new.owner_entity_id,upper(new.owner_entity_type)||'_ATTACHMENT') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger file_assets_document_index after insert on public.file_assets for each row execute function public.index_domain_file_as_document();

insert into public.approval_cases(domain_type,domain_id,reference_number,requester_account_id,requester_employee_id,requester_name,organization_name,summary,domain_link,workflow_version,status,current_step,metadata_summary,submitted_at,completed_at,created_at,updated_at)
select 'LEAVE',r.id::text,r.request_number,r.created_by,r.employee_id,coalesce(r.employee_snapshot->>'employeeName','—'),r.employee_snapshot->>'departmentName',
  concat(r.calculated_days,' ngày · ',coalesce(t.name,'Nghỉ phép')),'/leave/requests/'||r.id,
  coalesce((r.workflow_snapshot->>'version')::integer,1),case r.status::text when 'approved' then 'approved' when 'rejected' then 'rejected' when 'withdrawn' then 'withdrawn' when 'cancelled' then 'cancelled' else 'pending' end,
  (select min(s.step_order) from leave_request_approval_steps s where s.request_id=r.id and s.status='pending'),
  jsonb_build_object('leaveType',t.name,'days',r.calculated_days,'startDate',r.start_date,'endDate',r.end_date),coalesce(r.submitted_at,r.created_at),coalesce(r.approved_at,r.rejected_at,r.withdrawn_at,r.cancelled_at),r.created_at,r.updated_at
from public.leave_requests r join public.leave_types t on t.id=r.leave_type_id where r.status<>'draft' on conflict(domain_type,domain_id) do nothing;
insert into public.approval_steps(approval_case_id,source_step_id,step_order,step_name,approver_source,resolved_approver_account_id,resolved_approver_name,status,acted_at,comment,created_at)
select c.id,s.id::text,s.step_order,'Bước '||s.step_order,s.approver_source::text,s.resolved_approver_account_id,s.resolved_approver_name,s.status::text,s.acted_at,s.comment,s.created_at
from public.leave_request_approval_steps s join public.approval_cases c on c.domain_type='LEAVE' and c.domain_id=s.request_id::text on conflict(source_step_id) do nothing;

insert into public.approval_cases(domain_type,domain_id,reference_number,requester_account_id,requester_employee_id,requester_name,organization_name,summary,domain_link,workflow_version,status,current_step,metadata_summary,submitted_at,completed_at,created_at,updated_at)
select 'TIMESHEET_ADJUSTMENT',a.id::text,'ADJ-'||extract(year from a.work_date)::int||'-'||upper(substr(replace(a.id::text,'-',''),1,6)),a.created_by,a.employee_id,
  coalesce(e.full_name,'—'),d.name,concat('Điều chỉnh ',a.work_date,' · ',replace(a.adjustment_type::text,'_',' ')),
  '/timesheets/adjustments?periodId='||a.period_id||'&employeeId='||a.employee_id||'&date='||a.work_date,1,'approved',null,
  jsonb_build_object('workDate',a.work_date,'adjustmentType',a.adjustment_type,'reason',a.reason),a.created_at,a.created_at,a.created_at,a.created_at
from public.timesheet_adjustments a join public.employees e on e.id=a.employee_id left join public.departments d on d.id=e.department_id
on conflict(domain_type,domain_id) do nothing;
insert into public.approval_steps(approval_case_id,source_step_id,step_order,step_name,approver_source,resolved_approver_account_id,resolved_approver_name,status,acted_by_account_id,acted_at,comment,created_at)
select c.id,'timesheet:'||a.id,1,'Xác nhận HR','specific_user',a.created_by,coalesce(ac.display_name,'HR'),'approved',a.created_by,a.created_at,a.reason,a.created_at
from public.timesheet_adjustments a join public.approval_cases c on c.domain_type='TIMESHEET_ADJUSTMENT' and c.domain_id=a.id::text left join public.app_accounts ac on ac.id=a.created_by
on conflict(source_step_id) do nothing;

create or replace function public.sync_timesheet_adjustment_approval() returns trigger language plpgsql security definer set search_path=public as $$
declare v_case_id uuid; v_employee employees%rowtype; v_department text; v_actor_name text;
begin
  select * into v_employee from employees where id=new.employee_id;
  select name into v_department from departments where id=v_employee.department_id;
  select display_name into v_actor_name from app_accounts where id=new.created_by;
  insert into approval_cases(domain_type,domain_id,reference_number,requester_account_id,requester_employee_id,requester_name,organization_name,summary,domain_link,workflow_version,status,metadata_summary,submitted_at,completed_at,created_at,updated_at)
  values('TIMESHEET_ADJUSTMENT',new.id::text,'ADJ-'||extract(year from new.work_date)::int||'-'||upper(substr(replace(new.id::text,'-',''),1,6)),new.created_by,new.employee_id,coalesce(v_employee.full_name,'—'),v_department,concat('Điều chỉnh ',new.work_date,' · ',replace(new.adjustment_type::text,'_',' ')),'/timesheets/adjustments?periodId='||new.period_id||'&employeeId='||new.employee_id||'&date='||new.work_date,1,'approved',jsonb_build_object('workDate',new.work_date,'adjustmentType',new.adjustment_type,'reason',new.reason),new.created_at,new.created_at,new.created_at,new.created_at)
  on conflict(domain_type,domain_id) do update set summary=excluded.summary,metadata_summary=excluded.metadata_summary,updated_at=excluded.updated_at returning id into v_case_id;
  insert into approval_steps(approval_case_id,source_step_id,step_order,step_name,approver_source,resolved_approver_account_id,resolved_approver_name,status,acted_by_account_id,acted_at,comment,created_at)
  values(v_case_id,'timesheet:'||new.id,1,'Xác nhận HR','specific_user',new.created_by,coalesce(v_actor_name,'HR'),'approved',new.created_by,new.created_at,new.reason,new.created_at)
  on conflict(source_step_id) do nothing;
  return new;
end $$;
create trigger timesheet_adjustment_shared_approval after insert on public.timesheet_adjustments for each row execute function public.sync_timesheet_adjustment_approval();

create or replace function public.sync_leave_approval_platform() returns trigger language plpgsql security definer set search_path=public as $$
declare v_request leave_requests%rowtype; v_case_id uuid; v_type_name text;
begin
  if tg_table_name='leave_requests' then v_request:=new; else select * into v_request from leave_requests where id=new.request_id; end if;
  if v_request.status='draft' then return new; end if;
  select name into v_type_name from leave_types where id=v_request.leave_type_id;
  insert into approval_cases(domain_type,domain_id,reference_number,requester_account_id,requester_employee_id,requester_name,organization_name,summary,domain_link,workflow_version,status,current_step,metadata_summary,submitted_at,completed_at,created_at,updated_at)
  values('LEAVE',v_request.id::text,v_request.request_number,v_request.created_by,v_request.employee_id,coalesce(v_request.employee_snapshot->>'employeeName','—'),v_request.employee_snapshot->>'departmentName',concat(v_request.calculated_days,' ngày · ',coalesce(v_type_name,'Nghỉ phép')),'/leave/requests/'||v_request.id,coalesce((v_request.workflow_snapshot->>'version')::integer,1),case v_request.status::text when 'approved' then 'approved' when 'rejected' then 'rejected' when 'withdrawn' then 'withdrawn' when 'cancelled' then 'cancelled' else 'pending' end,null,jsonb_build_object('leaveType',v_type_name,'days',v_request.calculated_days,'startDate',v_request.start_date,'endDate',v_request.end_date),coalesce(v_request.submitted_at,v_request.created_at),coalesce(v_request.approved_at,v_request.rejected_at,v_request.withdrawn_at,v_request.cancelled_at),v_request.created_at,v_request.updated_at)
  on conflict(domain_type,domain_id) do update set status=excluded.status,summary=excluded.summary,metadata_summary=excluded.metadata_summary,completed_at=excluded.completed_at,updated_at=excluded.updated_at returning id into v_case_id;
  if tg_table_name='leave_request_approval_steps' then
    insert into approval_steps(approval_case_id,source_step_id,step_order,step_name,approver_source,resolved_approver_account_id,resolved_approver_name,status,acted_at,comment,created_at)
    values(v_case_id,new.id::text,new.step_order,'Bước '||new.step_order,new.approver_source::text,new.resolved_approver_account_id,new.resolved_approver_name,new.status::text,new.acted_at,new.comment,new.created_at)
    on conflict(source_step_id) do update set resolved_approver_account_id=excluded.resolved_approver_account_id,resolved_approver_name=excluded.resolved_approver_name,status=excluded.status,acted_at=excluded.acted_at,comment=excluded.comment;
  end if;
  update approval_cases set current_step=(select min(step_order) from approval_steps where approval_case_id=v_case_id and status='pending') where id=v_case_id;
  return new;
end $$;
create trigger leave_requests_shared_approval after insert or update on public.leave_requests for each row execute function public.sync_leave_approval_platform();
create trigger leave_steps_shared_approval after insert or update on public.leave_request_approval_steps for each row execute function public.sync_leave_approval_platform();

create or replace function public.bridge_shared_domain_event() returns trigger language plpgsql security definer set search_path=public as $$
declare v_aggregate_type text;
begin
  v_aggregate_type:=case tg_table_name when 'leave_domain_events' then 'leave_request' when 'project_domain_events' then 'project' when 'warehouse_domain_events' then 'warehouse_document' else tg_table_name end;
  insert into domain_events(event_key,aggregate_type,aggregate_id,correlation_id,payload,idempotency_key)
  values(new.event_type,v_aggregate_type,new.aggregate_id::text,gen_random_uuid(),coalesce(new.payload,'{}'::jsonb),tg_table_name||':'||new.id::text)
  on conflict(idempotency_key) do nothing;
  return new;
end $$;
insert into public.domain_events(event_key,aggregate_type,aggregate_id,payload,idempotency_key)
select event_type,'leave_request',aggregate_id::text,payload,'leave_domain_events:'||id::text from public.leave_domain_events on conflict(idempotency_key) do nothing;
insert into public.domain_events(event_key,aggregate_type,aggregate_id,payload,idempotency_key)
select event_type,'project',aggregate_id::text,payload,'project_domain_events:'||id::text from public.project_domain_events on conflict(idempotency_key) do nothing;
insert into public.domain_events(event_key,aggregate_type,aggregate_id,payload,idempotency_key)
select event_type,'warehouse_document',aggregate_id::text,payload,'warehouse_domain_events:'||id::text from public.warehouse_domain_events on conflict(idempotency_key) do nothing;
create trigger leave_events_shared_bus after insert on public.leave_domain_events for each row execute function public.bridge_shared_domain_event();
create trigger project_events_shared_bus after insert on public.project_domain_events for each row execute function public.bridge_shared_domain_event();
create trigger warehouse_events_shared_bus after insert on public.warehouse_domain_events for each row execute function public.bridge_shared_domain_event();

update public.system_settings set value=jsonb_set(value,'{itemOrder}',coalesce(value->'itemOrder','[]'::jsonb)||'["/documents"]'::jsonb) where group_key='navigation' and not (coalesce(value->'itemOrder','[]'::jsonb) ? '/documents');
