-- Functional completion: sensitive HR files, attendance/shift audit, project tree,
-- accounting/payroll/payslips and scoped realtime messaging.

alter table public.employees add column if not exists probation_end_date date;
do $$ begin
  alter table public.employees add constraint employees_probation_dates_check
    check (probation_end_date is null or probation_start_date is null or probation_end_date >= probation_start_date);
exception when duplicate_object then null; end $$;

alter table public.employee_contracts add column if not exists signed_date date;
alter table public.employee_contracts add column if not exists effective_date date;
alter table public.employee_contracts add column if not exists archived_at timestamptz;
alter table public.employee_contracts add column if not exists archived_by uuid references public.app_accounts(id);
alter table public.employee_contracts add column if not exists row_version integer not null default 1;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'employee-private','employee-private',false,15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.attendance_event_adjustments (
  id uuid primary key default gen_random_uuid(),
  attendance_event_id uuid not null references public.attendance_events(id) on delete restrict,
  old_value jsonb not null,
  new_value jsonb not null,
  reason text not null check(length(trim(reason)) >= 3),
  changed_by uuid not null references public.app_accounts(id),
  changed_at timestamptz not null default now()
);
create index if not exists attendance_event_adjustments_event_idx
  on public.attendance_event_adjustments(attendance_event_id,changed_at desc);

create table if not exists public.shift_versions (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete restrict,
  version integer not null check(version > 0),
  code text not null,
  name text not null,
  start_time time not null,
  end_time time not null,
  break_minutes integer not null,
  late_grace_minutes integer not null,
  early_leave_grace_minutes integer not null,
  cross_midnight boolean not null default false,
  effective_from date not null,
  effective_to date,
  changed_by uuid references public.app_accounts(id),
  reason text not null,
  created_at timestamptz not null default now(),
  unique(shift_id,version),
  check(effective_to is null or effective_to >= effective_from)
);
create index if not exists shift_versions_effective_idx on public.shift_versions(shift_id,effective_from desc);

create or replace function public.update_shift_with_version(
  p_shift_id uuid,p_values jsonb,p_effective_from date,p_reason text,p_actor uuid
) returns public.shifts language plpgsql security definer set search_path=public as $$
declare v_before public.shifts;v_result public.shifts;v_latest public.shift_versions;v_next integer;v_previous date;
begin
  select * into v_before from public.shifts where id=p_shift_id for update;
  if not found then raise exception 'SHIFT_NOT_FOUND';end if;
  select * into v_latest from public.shift_versions where shift_id=p_shift_id order by version desc limit 1;
  v_previous:=p_effective_from-1;v_next:=coalesce(v_latest.version,1)+1;
  if v_latest.id is null then
    insert into public.shift_versions(shift_id,version,code,name,start_time,end_time,break_minutes,late_grace_minutes,early_leave_grace_minutes,cross_midnight,effective_from,effective_to,changed_by,reason)
    values(p_shift_id,1,v_before.code,v_before.name,v_before.start_time,v_before.end_time,v_before.break_minutes,v_before.late_grace_minutes,v_before.early_leave_grace_minutes,v_before.cross_midnight,'1970-01-01',v_previous,p_actor,'Phiên bản ban đầu');
  else
    if p_effective_from<=v_latest.effective_from then raise exception 'SHIFT_EFFECTIVE_DATE_CONFLICT';end if;
    update public.shift_versions set effective_to=v_previous where id=v_latest.id;
  end if;
  update public.shifts set code=p_values->>'code',name=p_values->>'name',start_time=(p_values->>'start_time')::time,end_time=(p_values->>'end_time')::time,break_minutes=(p_values->>'break_minutes')::integer,late_grace_minutes=(p_values->>'late_grace_minutes')::integer,early_leave_grace_minutes=(p_values->>'early_leave_grace_minutes')::integer,check_in_earliest_minutes=(p_values->>'check_in_earliest_minutes')::integer,check_in_latest_minutes=(p_values->>'check_in_latest_minutes')::integer,check_out_earliest_minutes=(p_values->>'check_out_earliest_minutes')::integer,check_out_latest_minutes=(p_values->>'check_out_latest_minutes')::integer,cross_midnight=(p_values->>'cross_midnight')::boolean,active=(p_values->>'active')::boolean where id=p_shift_id returning * into v_result;
  insert into public.shift_versions(shift_id,version,code,name,start_time,end_time,break_minutes,late_grace_minutes,early_leave_grace_minutes,cross_midnight,effective_from,changed_by,reason)
  values(p_shift_id,v_next,v_result.code,v_result.name,v_result.start_time,v_result.end_time,v_result.break_minutes,v_result.late_grace_minutes,v_result.early_leave_grace_minutes,v_result.cross_midnight,p_effective_from,p_actor,p_reason);
  return v_result;
end;$$;
revoke all on function public.update_shift_with_version(uuid,jsonb,date,text,uuid) from public;
grant execute on function public.update_shift_with_version(uuid,jsonb,date,text,uuid) to service_role;

do $$ begin create type public.project_progress_node_type as enum ('phase','work_item','task','milestone','acceptance'); exception when duplicate_object then null; end $$;
create table if not exists public.project_progress_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.project_progress_nodes(id) on delete cascade,
  node_type public.project_progress_node_type not null,
  name text not null,
  status text not null default 'not_started' check(status in ('not_started','in_progress','blocked','completed','cancelled')),
  completion_percent integer not null default 0 check(completion_percent between 0 and 100),
  deadline date,
  assignee_employee_id uuid references public.employees(id) on delete set null,
  sort_order integer not null default 0,
  row_version integer not null default 1,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_progress_nodes_tree_idx on public.project_progress_nodes(project_id,parent_id,sort_order);

do $$ begin create type public.payroll_status as enum ('draft','calculated','reviewed','locked','published'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payslip_status as enum ('draft','published','revoked'); exception when duplicate_object then null; end $$;

create table if not exists public.employee_salary_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  base_salary numeric(18,2) not null check(base_salary >= 0),
  allowance numeric(18,2) not null default 0 check(allowance >= 0),
  bonus numeric(18,2) not null default 0 check(bonus >= 0),
  deduction numeric(18,2) not null default 0 check(deduction >= 0),
  effective_date date not null,
  note text,
  reason text not null check(length(trim(reason)) >= 3),
  changed_by uuid not null references public.app_accounts(id),
  changed_at timestamptz not null default now()
);
create index if not exists employee_salary_history_employee_idx on public.employee_salary_history(employee_id,effective_date desc,changed_at desc);

create table if not exists public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique check(extract(day from period_month)=1),
  timesheet_period_id uuid references public.timesheet_periods(id) on delete restrict,
  status public.payroll_status not null default 'draft',
  row_version integer not null default 1,
  calculated_at timestamptz,
  calculated_by uuid references public.app_accounts(id),
  reviewed_at timestamptz,
  reviewed_by uuid references public.app_accounts(id),
  locked_at timestamptz,
  locked_by uuid references public.app_accounts(id),
  note text,
  created_by uuid not null references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payroll_periods_status_idx on public.payroll_periods(status,period_month desc);

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  work_days numeric(8,2) not null default 0,
  base_salary numeric(18,2) not null default 0,
  allowance numeric(18,2) not null default 0,
  bonus numeric(18,2) not null default 0,
  deduction numeric(18,2) not null default 0,
  net_salary numeric(18,2) generated always as (base_salary + allowance + bonus - deduction) stored,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  row_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payroll_period_id,employee_id)
);
create index if not exists payroll_lines_employee_idx on public.payroll_lines(employee_id,payroll_period_id);

create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_line_id uuid not null references public.payroll_lines(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  version integer not null check(version > 0),
  status public.payslip_status not null default 'draft',
  snapshot jsonb not null,
  file_id uuid references public.file_assets(id) on delete restrict,
  published_at timestamptz,
  published_by uuid references public.app_accounts(id),
  viewed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.app_accounts(id),
  revoke_reason text,
  created_at timestamptz not null default now(),
  unique(payroll_line_id,version),
  check((status='published')=(published_at is not null) or status='revoked')
);
create index if not exists payslips_employee_status_idx on public.payslips(employee_id,status,published_at desc);

create or replace function public.publish_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare
  v_period public.payroll_periods%rowtype;
  v_now timestamptz := now();
  v_version integer;
begin
  select * into v_period from public.payroll_periods where id=p_period_id and row_version=p_row_version for update;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  if v_period.status<>'locked' then raise exception 'PAYROLL_NOT_LOCKED'; end if;
  if not exists(select 1 from public.payroll_lines where payroll_period_id=p_period_id) then raise exception 'PAYROLL_EMPTY'; end if;
  insert into public.payslips(payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
  select l.id,l.employee_id,coalesce((select max(p.version) from public.payslips p where p.payroll_line_id=l.id),0)+1,
    'published',jsonb_build_object('periodMonth',v_period.period_month)||to_jsonb(l),v_now,p_actor_id
  from public.payroll_lines l where l.payroll_period_id=p_period_id;
  update public.payroll_periods set status='published',row_version=row_version+1,updated_at=v_now where id=p_period_id;
  select max(p.version) into v_version from public.payslips p join public.payroll_lines l on l.id=p.payroll_line_id where l.payroll_period_id=p_period_id;
  return v_version;
end $$;

create or replace function public.reopen_payroll_period(p_period_id uuid,p_row_version integer,p_actor_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path=public as $$
declare
  v_period public.payroll_periods%rowtype;
  v_now timestamptz := now();
begin
  if length(trim(p_reason))<3 then raise exception 'REASON_REQUIRED'; end if;
  select * into v_period from public.payroll_periods where id=p_period_id and row_version=p_row_version for update;
  if not found then raise exception 'VERSION_CONFLICT'; end if;
  if v_period.status not in ('locked','published') then raise exception 'PAYROLL_NOT_LOCKED'; end if;
  update public.payslips p set status='revoked',revoked_at=v_now,revoked_by=p_actor_id,revoke_reason=p_reason
  from public.payroll_lines l where p.payroll_line_id=l.id and l.payroll_period_id=p_period_id and p.status='published';
  update public.payroll_periods set status='calculated',row_version=row_version+1,updated_at=v_now where id=p_period_id;
end $$;

revoke all on function public.publish_payroll_period(uuid,integer,uuid) from public;
revoke all on function public.reopen_payroll_period(uuid,integer,uuid,text) from public;
grant execute on function public.publish_payroll_period(uuid,integer,uuid),public.reopen_payroll_period(uuid,integer,uuid,text) to service_role;

do $$ begin create type public.conversation_type as enum ('direct','group'); exception when duplicate_object then null; end $$;
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  title text,
  direct_key text unique,
  entity_type text,
  entity_id text,
  created_by uuid not null references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((type='direct' and direct_key is not null) or (type='group' and length(trim(title)) >= 2))
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_read_at timestamptz,
  primary key(conversation_id,account_id)
);
create index if not exists conversation_members_account_idx on public.conversation_members(account_id,left_at,joined_at desc);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_account_id uuid not null references public.app_accounts(id) on delete restrict,
  body text not null check(length(trim(body)) between 1 and 8000),
  reply_to_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_page_idx on public.messages(conversation_id,created_at desc,id desc) where deleted_at is null;
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(message_id,account_id)
);
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  file_id uuid not null references public.file_assets(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(message_id,file_id)
);
create index if not exists message_attachments_conversation_idx on public.message_attachments(conversation_id,created_at);

create or replace function public.list_conversation_summaries(p_account_id uuid)
returns table(conversation_id uuid,conversation_type public.conversation_type,conversation_title text,conversation_updated_at timestamptz,last_body text,last_sender_name text,last_created_at timestamptz,unread_count bigint)
language sql stable security invoker set search_path=public as $$
  select c.id,c.type,c.title,c.updated_at,last_message.body,sender.display_name,last_message.created_at,
    (select count(*) from public.messages unread where unread.conversation_id=c.id and unread.deleted_at is null and unread.sender_account_id<>p_account_id and unread.created_at>coalesce(cm.last_read_at,'epoch'::timestamptz))
  from public.conversation_members cm
  join public.conversations c on c.id=cm.conversation_id
  left join lateral(select m.body,m.sender_account_id,m.created_at from public.messages m where m.conversation_id=c.id and m.deleted_at is null order by m.created_at desc,m.id desc limit 1) last_message on true
  left join public.app_accounts sender on sender.id=last_message.sender_account_id
  where cm.account_id=p_account_id and cm.left_at is null
  order by coalesce(last_message.created_at,c.updated_at) desc;
$$;
revoke all on function public.list_conversation_summaries(uuid) from public;
grant execute on function public.list_conversation_summaries(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('message-attachments','message-attachments',false,15728640,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payslip-private','payslip-private',false,5242880,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.notification_templates(event_key,title_template,message_template,allowed_placeholders,mandatory)
values('payslip.published','Phiếu lương mới','Phiếu lương tháng {{period_month}} đã được phát hành.',array['period_month'],true)
on conflict(event_key) do nothing;

alter table public.attendance_event_adjustments enable row level security;
alter table public.shift_versions enable row level security;
alter table public.project_progress_nodes enable row level security;
alter table public.employee_salary_history enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_lines enable row level security;
alter table public.payslips enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.message_attachments enable row level security;

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.conversation_members
    where conversation_id=p_conversation_id
      and account_id=public.current_app_account_id()
      and left_at is null
  );
$$;
revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated,service_role;

create policy "members read conversations" on public.conversations for select to authenticated
using(public.is_conversation_member(id));
create policy "members read memberships" on public.conversation_members for select to authenticated
using(public.is_conversation_member(conversation_id));
create policy "members read messages" on public.messages for select to authenticated
using(public.is_conversation_member(conversation_id));
create policy "members send messages" on public.messages for insert to authenticated
with check(sender_account_id=public.current_app_account_id() and public.is_conversation_member(conversation_id));
create policy "members read message reads" on public.message_reads for select to authenticated
using(exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id)));
create policy "members record reads" on public.message_reads for insert to authenticated
with check(account_id=public.current_app_account_id() and exists(select 1 from public.messages m where m.id=message_id and public.is_conversation_member(m.conversation_id)));
create policy "members read attachments" on public.message_attachments for select to authenticated
using(public.is_conversation_member(conversation_id));

insert into public.permissions(key,module,description) values
  ('employee.identity_document.view','human_resources','Xem ảnh giấy tờ định danh nhân viên'),
  ('employee.identity_document.edit','human_resources','Cập nhật ảnh giấy tờ định danh nhân viên'),
  ('contract.view','human_resources','Xem hợp đồng lao động'),
  ('contract.edit','human_resources','Cập nhật hợp đồng lao động'),
  ('contract.file.view','human_resources','Xem file hợp đồng lao động'),
  ('contract.file.upload','human_resources','Tải lên file hợp đồng lao động'),
  ('accounting.access','accounting','Truy cập ứng dụng kế toán'),
  ('salary.view','accounting','Xem dữ liệu lương'),
  ('salary.edit','accounting','Điều chỉnh dữ liệu lương'),
  ('salary.history.view','accounting','Xem lịch sử lương'),
  ('payroll.view','accounting','Xem bảng lương'),
  ('payroll.create','accounting','Tạo và tính bảng lương'),
  ('payroll.edit','accounting','Chỉnh sửa bảng lương chưa khóa'),
  ('payroll.lock','accounting','Kiểm tra và khóa bảng lương'),
  ('payslip.create','accounting','Tạo phiếu lương'),
  ('payslip.publish','accounting','Phát hành phiếu lương'),
  ('payslip.revoke','accounting','Thu hồi phiếu lương'),
  ('payslip.self.view','accounting','Xem phiếu lương của bản thân'),
  ('bonus.manage','accounting','Quản lý thưởng'),
  ('allowance.manage','accounting','Quản lý phụ cấp'),
  ('deduction.manage','accounting','Quản lý khấu trừ'),
  ('attendance.self','attendance','Chấm công cá nhân'),
  ('attendance.manage','attendance','Quản trị chấm công'),
  ('attendance.log.view','attendance','Xem nhật ký chấm công'),
  ('shift.edit','attendance','Chỉnh sửa và tạo phiên bản ca làm'),
  ('chat.access','messaging','Truy cập tin nhắn'),
  ('chat.group.create','messaging','Tạo nhóm trò chuyện')
on conflict(key) do update set module=excluded.module,description=excluded.description;

insert into public.roles(code,name,description,is_system)
values('accountant','Kế toán','Quản lý lương, bảng lương và phiếu lương theo phân quyền.',true)
on conflict(code) do update set name=excluded.name,description=excluded.description,is_system=excluded.is_system;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in (
  'employee.identity_document.view','employee.identity_document.edit','contract.view','contract.edit','contract.file.view','contract.file.upload',
  'accounting.access','salary.view','salary.edit','salary.history.view','payroll.view','payroll.create','payroll.edit','payroll.lock',
  'payslip.create','payslip.publish','payslip.revoke','payslip.self.view','bonus.manage','allowance.manage','deduction.manage',
  'attendance.self','attendance.manage','attendance.log.view','shift.edit','chat.access','chat.group.create'
) where r.code='admin'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in (
  'dashboard.view','accounting.access','salary.view','salary.edit','salary.history.view','payroll.view','payroll.create',
  'payroll.edit','payroll.lock','payslip.create','payslip.publish','payslip.revoke','payslip.self.view','bonus.manage','allowance.manage',
  'deduction.manage','notification.view','file.read','chat.access'
) where r.code='accountant'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in (
  'employee.identity_document.view','employee.identity_document.edit','contract.view','contract.edit',
  'contract.file.view','contract.file.upload','attendance.manage','attendance.view_all','attendance.adjust',
  'attendance.log.view','shift.edit','chat.access','chat.group.create'
) where r.code='hr'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in ('attendance.self','payslip.self.view','chat.access')
where r.code='employee'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key='chat.access'
where r.code='supervisor'
on conflict do nothing;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.message_reads;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.message_attachments;
exception when duplicate_object then null; when undefined_object then null; end $$;
