create extension if not exists pgcrypto;

do $$ begin create type public.leave_request_status as enum ('draft','submitted','pending_approval','approved','rejected','withdrawn','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.leave_day_part as enum ('full_day','morning','afternoon'); exception when duplicate_object then null; end $$;
do $$ begin create type public.leave_approval_status as enum ('pending','approved','rejected','skipped','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.leave_approver_source as enum ('direct_manager','department_manager','specific_role','specific_user','hr_role'); exception when duplicate_object then null; end $$;
do $$ begin create type public.leave_ledger_transaction_type as enum ('grant','carryover','adjustment_add','adjustment_subtract','leave_usage','leave_reversal','expiry'); exception when duplicate_object then null; end $$;

create sequence if not exists public.leave_request_number_seq;
create or replace function public.generate_leave_request_number() returns text language sql volatile as $$
  select 'LV-' || extract(year from current_date)::int::text || '-' || lpad(nextval('public.leave_request_number_seq')::text,6,'0')
$$;

create table if not exists public.leave_workflows (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
  active boolean not null default true, created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.leave_workflow_steps (
  id uuid primary key default gen_random_uuid(), workflow_id uuid not null references public.leave_workflows(id) on delete cascade,
  step_order integer not null check (step_order > 0), approver_source public.leave_approver_source not null,
  specific_role_code text, specific_account_id uuid references public.app_accounts(id), required boolean not null default true,
  approval_mode text not null default 'single' check (approval_mode in ('single','all')),
  created_at timestamptz not null default now(), unique (workflow_id, step_order)
);

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, tone text not null default 'info' check (tone in ('neutral','info','success','warning')),
  deducts_balance boolean not null default false, requires_reason boolean not null default true, requires_attachment boolean not null default false,
  allows_half_day boolean not null default true, allows_multi_day boolean not null default true,
  workflow_id uuid not null references public.leave_workflows(id), active boolean not null default true,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.leave_policies (
  id uuid primary key default gen_random_uuid(), name text not null, active boolean not null default true,
  weekend_days integer[] not null default array[0,6], allow_negative_balance boolean not null default false,
  allow_withdraw_pending boolean not null default true, cancellation_requires_approval boolean not null default false,
  carryover_enabled boolean not null default false, carryover_max_days numeric(6,2) not null default 0,
  carryover_expiry_month integer check (carryover_expiry_month between 1 and 12), carryover_expiry_day integer check (carryover_expiry_day between 1 and 31),
  updated_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists leave_policies_one_active_idx on public.leave_policies(active) where active;

create table if not exists public.work_calendar_holidays (
  holiday_date date primary key, name text not null, active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(), request_number text not null unique default public.generate_leave_request_number(),
  employee_id uuid not null references public.employees(id) on delete restrict, leave_type_id uuid not null references public.leave_types(id),
  start_date date not null, end_date date not null, start_day_part public.leave_day_part not null default 'full_day', end_day_part public.leave_day_part not null default 'full_day',
  calculated_days numeric(7,2) not null check (calculated_days > 0), reason text not null,
  status public.leave_request_status not null default 'draft', submitted_at timestamptz, approved_at timestamptz, rejected_at timestamptz, withdrawn_at timestamptz, cancelled_at timestamptz,
  workflow_snapshot jsonb, employee_snapshot jsonb not null, request_snapshot jsonb, approved_snapshot jsonb,
  version integer not null default 1 check (version > 0), created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (end_date >= start_date), check (length(trim(reason)) >= 2)
);
create index if not exists leave_requests_employee_dates_idx on public.leave_requests(employee_id,start_date,end_date,status);
create index if not exists leave_requests_status_submitted_idx on public.leave_requests(status,submitted_at desc);

create table if not exists public.leave_request_approval_steps (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.leave_requests(id) on delete restrict,
  step_order integer not null, approver_source public.leave_approver_source not null,
  resolved_approver_account_id uuid references public.app_accounts(id), resolved_approver_name text,
  status public.leave_approval_status not null default 'pending', acted_at timestamptz, comment text, snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(request_id,step_order)
);
create index if not exists leave_approval_steps_assignee_idx on public.leave_request_approval_steps(resolved_approver_account_id,status,created_at);

create table if not exists public.leave_ledger (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200), leave_type_id uuid not null references public.leave_types(id),
  transaction_type public.leave_ledger_transaction_type not null, amount numeric(7,2) not null check (amount <> 0),
  reference_type text not null, reference_id text not null, effective_date date not null, reason text not null,
  idempotency_key uuid, created_by uuid references public.app_accounts(id), created_at timestamptz not null default now()
);
create index if not exists leave_ledger_balance_idx on public.leave_ledger(employee_id,leave_year,leave_type_id,effective_date);
create unique index if not exists leave_ledger_reference_unique_idx on public.leave_ledger(reference_type,reference_id,transaction_type,leave_type_id);
create unique index if not exists leave_ledger_idempotency_idx on public.leave_ledger(idempotency_key,employee_id,leave_type_id) where idempotency_key is not null;

create table if not exists public.leave_request_attachments (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.leave_requests(id) on delete restrict,
  file_id uuid not null references public.file_assets(id) on delete restrict, file_name text not null, created_at timestamptz not null default now()
);

create table if not exists public.leave_attendance_conflicts (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.leave_requests(id) on delete restrict,
  employee_id uuid not null references public.employees(id), conflict_date date not null, source_type text not null,
  source_id uuid not null, status text not null default 'open' check(status in ('open','resolved','ignored')),
  created_at timestamptz not null default now(), unique(request_id,source_type,source_id)
);

create table if not exists public.leave_domain_events (
  id uuid primary key default gen_random_uuid(), event_type text not null, aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), processed_at timestamptz
);
create index if not exists leave_domain_events_pending_idx on public.leave_domain_events(processed_at,created_at);

create or replace function public.touch_leave_request_version() returns trigger language plpgsql as $$ begin new.updated_at=now(); new.version=old.version+1; return new; end; $$;
drop trigger if exists leave_requests_touch_version on public.leave_requests;
create trigger leave_requests_touch_version before update on public.leave_requests for each row execute function public.touch_leave_request_version();
drop trigger if exists leave_workflows_touch_updated_at on public.leave_workflows;
create trigger leave_workflows_touch_updated_at before update on public.leave_workflows for each row execute function public.touch_updated_at();
drop trigger if exists leave_types_touch_updated_at on public.leave_types;
create trigger leave_types_touch_updated_at before update on public.leave_types for each row execute function public.touch_updated_at();
drop trigger if exists leave_policies_touch_updated_at on public.leave_policies;
create trigger leave_policies_touch_updated_at before update on public.leave_policies for each row execute function public.touch_updated_at();

create or replace function public.process_leave_approval(p_request_id uuid,p_actor_id uuid,p_action text,p_comment text default null)
returns text language plpgsql security definer set search_path=public as $$
declare v_request public.leave_requests%rowtype; v_step public.leave_request_approval_steps%rowtype; v_next boolean; v_result text;
begin
  select * into v_request from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_NOT_FOUND'; end if;
  select * into v_step from public.leave_request_approval_steps where request_id=p_request_id and status='pending' order by step_order limit 1 for update;
  if not found then return v_request.status::text; end if;
  if v_step.resolved_approver_account_id is distinct from p_actor_id then raise exception 'LEAVE_APPROVER_MISMATCH'; end if;
  if p_action='reject' then
    if length(trim(coalesce(p_comment,'')))<3 then raise exception 'LEAVE_REJECT_REASON_REQUIRED'; end if;
    update public.leave_request_approval_steps set status='rejected',acted_at=now(),comment=p_comment where id=v_step.id and status='pending';
    update public.leave_request_approval_steps set status='cancelled' where request_id=p_request_id and status='pending';
    update public.leave_requests set status='rejected',rejected_at=now() where id=p_request_id;
    insert into public.leave_domain_events(event_type,aggregate_id,payload) values('leave.rejected',p_request_id,jsonb_build_object('actorId',p_actor_id));
    return 'rejected';
  end if;
  if p_action<>'approve' then raise exception 'LEAVE_ACTION_INVALID'; end if;
  update public.leave_request_approval_steps set status='approved',acted_at=now(),comment=p_comment where id=v_step.id and status='pending';
  select exists(select 1 from public.leave_request_approval_steps where request_id=p_request_id and status='pending') into v_next;
  if v_next then v_result:='pending_approval';
  else
    update public.leave_requests set status='approved',approved_at=now(),approved_snapshot=jsonb_build_object('request',coalesce(v_request.request_snapshot,'{}'::jsonb),'employee',v_request.employee_snapshot,'workflow',v_request.workflow_snapshot,'approvedAt',now()) where id=p_request_id;
    insert into public.leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason,created_by)
      select v_request.employee_id,extract(year from v_request.start_date)::int,v_request.leave_type_id,'leave_usage',-v_request.calculated_days,'leave_request',v_request.id::text,v_request.start_date,'Đơn '||v_request.request_number,p_actor_id
      from public.leave_types where id=v_request.leave_type_id and deducts_balance
      on conflict(reference_type,reference_id,transaction_type,leave_type_id) do nothing;
    insert into public.leave_attendance_conflicts(request_id,employee_id,conflict_date,source_type,source_id)
      select v_request.id,v_request.employee_id,a.attendance_date,'self_attendance',a.id from public.attendance_events a
      where a.employee_id=v_request.employee_id and a.attendance_date between v_request.start_date and v_request.end_date
      on conflict do nothing;
    insert into public.leave_domain_events(event_type,aggregate_id,payload) values('leave.approved',p_request_id,jsonb_build_object('actorId',p_actor_id));
    v_result:='approved';
  end if;
  return v_result;
end; $$;

create or replace function public.cancel_approved_leave(p_request_id uuid,p_actor_id uuid,p_reason text)
returns text language plpgsql security definer set search_path=public as $$
declare v_request public.leave_requests%rowtype;
begin
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'LEAVE_CANCEL_REASON_REQUIRED'; end if;
  select * into v_request from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_NOT_FOUND'; end if;
  if v_request.status='cancelled' then return 'cancelled'; end if;
  if v_request.status<>'approved' then raise exception 'LEAVE_NOT_APPROVED'; end if;
  insert into public.leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason,created_by)
    select v_request.employee_id,extract(year from v_request.start_date)::int,v_request.leave_type_id,'leave_reversal',v_request.calculated_days,'leave_request',v_request.id::text,current_date,p_reason,p_actor_id
    from public.leave_types where id=v_request.leave_type_id and deducts_balance
    on conflict(reference_type,reference_id,transaction_type,leave_type_id) do nothing;
  update public.leave_requests set status='cancelled',cancelled_at=now() where id=p_request_id;
  update public.leave_attendance_conflicts set status='resolved' where request_id=p_request_id and status='open';
  insert into public.leave_domain_events(event_type,aggregate_id,payload) values('leave.cancelled',p_request_id,jsonb_build_object('actorId',p_actor_id,'reason',p_reason));
  return 'cancelled';
end; $$;

alter table public.leave_workflows enable row level security;
alter table public.leave_workflow_steps enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_policies enable row level security;
alter table public.work_calendar_holidays enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_request_approval_steps enable row level security;
alter table public.leave_ledger enable row level security;
alter table public.leave_request_attachments enable row level security;
alter table public.leave_attendance_conflicts enable row level security;
alter table public.leave_domain_events enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('leave-attachments','leave-attachments',false,5242880,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.permissions(key,module,description) values
('leave.self.view','leave','Xem đơn của mình'),('leave.self.create','leave','Tạo đơn của mình'),('leave.self.withdraw','leave','Thu hồi đơn của mình'),
('leave.approve','leave','Duyệt đơn được giao'),('leave.approve_all','leave','Duyệt mọi đơn'),('leave.view_team','leave','Xem đơn của nhóm'),('leave.view_all','leave','Xem mọi đơn'),
('leave.balance.view_self','leave','Xem phép của mình'),('leave.balance.view_all','leave','Xem mọi số dư phép'),('leave.balance.adjust','leave','Điều chỉnh phép'),
('leave.type.manage','leave','Quản lý loại nghỉ'),('leave.workflow.manage','leave','Quản lý quy trình nghỉ'),('leave.policy.manage','leave','Quản lý chính sách nghỉ'),
('leave.pdf.export_self','leave','Xuất PDF đơn của mình'),('leave.pdf.export_all','leave','Xuất PDF mọi đơn')
on conflict(key) do update set module=excluded.module,description=excluded.description;

insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r cross join public.permissions p where r.code='admin' and p.module='leave' on conflict do nothing;
insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r join public.permissions p on p.key=any(array['leave.view','leave.self.view','leave.self.create','leave.self.withdraw','leave.balance.view_self','leave.pdf.export_self']) where r.code in ('employee','supervisor') on conflict do nothing;
insert into public.role_permissions(role_id,permission_key) select r.id,p.key from public.roles r join public.permissions p on p.key=any(array['leave.view','leave.self.view','leave.self.create','leave.self.withdraw','leave.approve','leave.view_team','leave.view_all','leave.balance.view_self','leave.balance.view_all','leave.balance.adjust','leave.pdf.export_self','leave.pdf.export_all']) where r.code='hr' on conflict do nothing;

insert into public.leave_workflows(id,code,name) values('c0000000-0000-4000-8000-000000000001','DEFAULT_LEAVE','Duyệt đơn nghỉ mặc định') on conflict(code) do nothing;
insert into public.leave_workflow_steps(workflow_id,step_order,approver_source,specific_role_code)
values('c0000000-0000-4000-8000-000000000001',1,'specific_role','admin') on conflict(workflow_id,step_order) do nothing;
insert into public.leave_types(id,code,name,tone,deducts_balance,requires_reason,requires_attachment,allows_half_day,allows_multi_day,workflow_id) values
('c1000000-0000-4000-8000-000000000001','ANNUAL','Nghỉ phép năm','success',true,true,false,true,true,'c0000000-0000-4000-8000-000000000001'),
('c1000000-0000-4000-8000-000000000002','UNPAID','Nghỉ không lương','warning',false,true,false,true,true,'c0000000-0000-4000-8000-000000000001'),
('c1000000-0000-4000-8000-000000000003','SICK','Nghỉ bệnh','info',false,true,false,true,true,'c0000000-0000-4000-8000-000000000001'),
('c1000000-0000-4000-8000-000000000004','OTHER','Nghỉ khác','neutral',false,true,false,true,true,'c0000000-0000-4000-8000-000000000001')
on conflict(code) do nothing;
insert into public.leave_policies(name) select 'Chính sách nghỉ mặc định' where not exists(select 1 from public.leave_policies where active);

insert into public.leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason)
select e.id,2026,t.id,'grant',12,'opening_grant','2026:'||e.id::text,'2026-01-01','Cấp phép năm 2026'
from public.employees e cross join public.leave_types t where lower(e.employee_code)='hr002' and t.code='ANNUAL'
on conflict(reference_type,reference_id,transaction_type,leave_type_id) do nothing;
