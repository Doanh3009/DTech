-- Keep leave commands atomic and preserve the shared approval platform triggers.
-- Existing requests, approvals and ledger entries are not rewritten.

create or replace function public.leave_actor_can(p_actor_id uuid,p_permissions text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from app_accounts a join account_roles ar on ar.account_id=a.id
    join role_permissions rp on rp.role_id=ar.role_id
    where a.id=p_actor_id and a.status='active' and rp.permission_key=any(p_permissions)
  )
$$;

-- A reason is enforced by the selected leave type, rather than unconditionally.
do $$ declare v_constraint text; begin
  for v_constraint in select conname from pg_constraint
    where conrelid='public.leave_requests'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%reason%'
      and pg_get_constraintdef(oid) like '%>= 2%'
  loop execute format('alter table public.leave_requests drop constraint %I',v_constraint); end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.leave_requests'::regclass and conname='leave_requests_reason_length_check') then
    alter table public.leave_requests add constraint leave_requests_reason_length_check check(length(reason)<=3000);
  end if;
end $$;

create or replace function public.save_leave_workflow_command(
  p_workflow_id uuid,p_code text,p_name text,p_active boolean,p_steps jsonb,p_actor_id uuid,p_expected_version integer default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_step jsonb;v_order integer:=0;v_source text;v_account_id uuid;v_role_code text;v_shared approval_workflows%rowtype;v_version integer;v_version_id uuid;
begin
  if not leave_actor_can(p_actor_id,array['leave.workflow.manage']) then raise exception 'LEAVE_ACTOR_DENIED';end if;
  if p_code !~ '^[A-Z][A-Z0-9_]{1,29}$' or length(trim(p_name)) not between 2 and 100
    or p_steps is null or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps) not between 1 and 10 then
    raise exception 'LEAVE_WORKFLOW_INVALID';
  end if;
  if p_workflow_id is null then
    insert into leave_workflows(code,name,active,created_by) values(p_code,trim(p_name),p_active,p_actor_id) returning id into v_id;
  else
    select id into v_id from leave_workflows where id=p_workflow_id for update;
    if not found then raise exception 'LEAVE_WORKFLOW_NOT_FOUND';end if;
    update leave_workflows set code=p_code,name=trim(p_name),active=p_active where id=v_id;
    delete from leave_workflow_steps where workflow_id=v_id;
  end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_order:=v_order+1;v_source:=v_step->>'approverSource';v_account_id:=null;v_role_code:=null;
    if coalesce(v_source,'') not in ('direct_manager','department_manager','specific_user','specific_role','hr_role') then raise exception 'LEAVE_WORKFLOW_INVALID';end if;
    if v_source='specific_user' then
      v_account_id:=nullif(v_step->>'specificAccountId','')::uuid;
      if v_account_id is null or not leave_actor_can(v_account_id,array['leave.approve','leave.approve_all']) then raise exception 'LEAVE_TARGET_INVALID';end if;
    elsif v_source='specific_role' then
      v_role_code:=nullif(trim(v_step->>'specificRoleCode'),'');
      if v_role_code is null or not exists(select 1 from roles r join role_permissions rp on rp.role_id=r.id where r.code=v_role_code and rp.permission_key in ('leave.approve','leave.approve_all')) then raise exception 'LEAVE_TARGET_INVALID';end if;
    end if;
    insert into leave_workflow_steps(workflow_id,step_order,approver_source,specific_account_id,specific_role_code)
    values(v_id,v_order,v_source::leave_approver_source,v_account_id,v_role_code);
  end loop;
  -- Leave settings edit the same published workflow consumed by submission.
  -- Retire versions without changing request approval snapshots already taken.
  perform pg_advisory_xact_lock(hashtextextended('approval-workflow:'||p_code,0));
  select * into v_shared from approval_workflows where id=v_id for update;
  if found then
    if v_shared.domain_type<>'LEAVE' then raise exception 'LEAVE_WORKFLOW_INVALID';end if;
    if p_expected_version is not null and v_shared.published_version<>p_expected_version then raise exception 'LEAVE_VERSION_CONFLICT';end if;
    v_version:=v_shared.published_version+1;
  else
    insert into approval_workflows(id,code,name,domain_type,active,published_version,created_by)
    values(v_id,p_code,trim(p_name),'LEAVE',p_active,0,p_actor_id);v_version:=1;
  end if;
  insert into approval_workflow_versions(workflow_id,version,status,published_by) values(v_id,v_version,'draft',p_actor_id) returning id into v_version_id;
  v_order:=0;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_order:=v_order+1;v_source:=v_step->>'approverSource';
    insert into approval_workflow_steps(workflow_version_id,step_order,step_name,approver_source,resolver_config)
    values(v_version_id,v_order,'Bước '||v_order,case when v_source='hr_role' then 'hr_resolver' else v_source end,
      case when v_source='specific_user' then jsonb_build_object('accountId',v_step->>'specificAccountId') when v_source='specific_role' then jsonb_build_object('roleCode',v_step->>'specificRoleCode') else '{}'::jsonb end);
  end loop;
  update approval_workflow_versions set status='retired' where workflow_id=v_id and status='published';
  update approval_workflow_versions set status='published',published_at=now() where id=v_version_id;
  update approval_workflows set code=p_code,name=trim(p_name),active=p_active,published_version=v_version where id=v_id;
  return v_id;
end $$;

create or replace function public.submit_leave_request_command(
  p_request_id uuid,p_actor_id uuid,p_expected_version integer,p_workflow_snapshot jsonb,p_request_snapshot jsonb,p_steps jsonb
) returns text language plpgsql security definer set search_path=public as $$
declare v_request leave_requests%rowtype;v_type leave_types%rowtype;v_policy leave_policies%rowtype;
  v_step jsonb;v_status leave_request_status;v_step_status leave_approval_status;v_actual_days numeric;v_working_dates jsonb;v_balance numeric;v_pending numeric;v_missing boolean:=false;v_workflow_version integer;
begin
  select * into v_request from leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_NOT_FOUND';end if;
  if not leave_actor_can(p_actor_id,array['leave.self.create']) or not exists(select 1 from app_accounts where id=p_actor_id and employee_id=v_request.employee_id and status='active') then raise exception 'LEAVE_ACTOR_DENIED';end if;
  if v_request.version<>p_expected_version then raise exception 'LEAVE_VERSION_CONFLICT';end if;
  if v_request.status<>'draft' then raise exception 'LEAVE_STATUS_CONFLICT';end if;
  perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||v_request.employee_id::text,0));
  select * into v_type from leave_types where id=v_request.leave_type_id and active for share;
  if not found then raise exception 'LEAVE_TARGET_INVALID';end if;
  select * into v_policy from leave_policies where active;
  if not found then raise exception 'LEAVE_POLICY_NOT_FOUND';end if;
  if v_type.requires_reason and length(trim(v_request.reason))<2 then raise exception 'LEAVE_REASON_REQUIRED';end if;
  if v_type.requires_attachment and not exists(select 1 from leave_request_attachments where request_id=p_request_id) then raise exception 'LEAVE_ATTACHMENT_REQUIRED';end if;
  if not v_type.allows_multi_day and v_request.start_date<>v_request.end_date then raise exception 'LEAVE_MULTIDAY_DISABLED';end if;
  if not v_type.allows_half_day and (v_request.start_day_part<>'full_day' or v_request.end_day_part<>'full_day') then raise exception 'LEAVE_HALFDAY_DISABLED';end if;
  if v_request.start_date=v_request.end_date and v_request.start_day_part<>v_request.end_day_part then raise exception 'LEAVE_DAYPART_INVALID';end if;
  if v_type.deducts_balance and extract(year from v_request.start_date)<>extract(year from v_request.end_date) then raise exception 'LEAVE_CROSS_YEAR';end if;
  select count(*),coalesce(jsonb_agg(to_char(d,'YYYY-MM-DD') order by d),'[]'::jsonb) into v_actual_days,v_working_dates from generate_series(v_request.start_date::timestamp,v_request.end_date::timestamp,interval '1 day') d
  where not (extract(dow from d)::int=any(v_policy.weekend_days)) and not exists(select 1 from work_calendar_holidays h where h.holiday_date=d::date and h.active);
  if v_actual_days>0 and v_request.start_day_part<>'full_day' and not (extract(dow from v_request.start_date)::int=any(v_policy.weekend_days)) and not exists(select 1 from work_calendar_holidays where holiday_date=v_request.start_date and active) then v_actual_days:=v_actual_days-0.5;end if;
  if v_actual_days>0 and v_request.end_date<>v_request.start_date and v_request.end_day_part<>'full_day' and not (extract(dow from v_request.end_date)::int=any(v_policy.weekend_days)) and not exists(select 1 from work_calendar_holidays where holiday_date=v_request.end_date and active) then v_actual_days:=v_actual_days-0.5;end if;
  if v_actual_days<=0 or v_actual_days<>v_request.calculated_days then raise exception 'LEAVE_CALENDAR_CHANGED';end if;
  if exists(select 1 from leave_requests where employee_id=v_request.employee_id and id<>p_request_id and status in ('submitted','pending_approval','approved') and start_date<=v_request.end_date and end_date>=v_request.start_date) then raise exception 'LEAVE_OVERLAP';end if;
  if v_type.deducts_balance and not v_policy.allow_negative_balance then
    select coalesce(sum(amount),0) into v_balance from leave_ledger where employee_id=v_request.employee_id and leave_year=extract(year from v_request.start_date)::int and leave_type_id=v_request.leave_type_id;
    select coalesce(sum(calculated_days),0) into v_pending from leave_requests where employee_id=v_request.employee_id and leave_type_id=v_request.leave_type_id and status in ('submitted','pending_approval') and extract(year from start_date)=extract(year from v_request.start_date) and id<>p_request_id;
    if v_balance-v_pending<v_request.calculated_days then raise exception 'LEAVE_BALANCE_INSUFFICIENT';end if;
  end if;
  if p_steps is null or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps) not between 1 and 12
    or p_workflow_snapshot is null or p_workflow_snapshot->>'id' is distinct from v_type.workflow_id::text
    or not exists(select 1 from jsonb_array_elements(p_steps) step where coalesce(step->>'status','pending')='pending')
    or exists(select 1 from leave_request_approval_steps where request_id=p_request_id) then raise exception 'LEAVE_WORKFLOW_INVALID';end if;
  if exists(select 1 from approval_workflows where id=v_type.workflow_id) then
    select published_version into v_workflow_version from approval_workflows where id=v_type.workflow_id and active and domain_type='LEAVE' for share;
    if not found then raise exception 'LEAVE_WORKFLOW_INVALID';end if;
    if v_workflow_version is distinct from (p_workflow_snapshot->>'version')::int then raise exception 'LEAVE_VERSION_CONFLICT';end if;
  else
    perform 1 from leave_workflows where id=v_type.workflow_id and active for share;
    if not found then raise exception 'LEAVE_WORKFLOW_INVALID';end if;
  end if;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    if coalesce(v_step->>'status','pending') not in ('pending','skipped') then raise exception 'LEAVE_WORKFLOW_INVALID';end if;
    if coalesce(v_step->>'status','pending')='pending' and nullif(v_step->>'resolved_approver_account_id','') is null then v_missing:=true;end if;
    if nullif(v_step->>'resolved_approver_account_id','') is not null and not leave_actor_can((v_step->>'resolved_approver_account_id')::uuid,array['leave.approve','leave.approve_all']) then raise exception 'LEAVE_TARGET_INVALID';end if;
  end loop;
  v_status:=case when v_missing then 'submitted'::leave_request_status else 'pending_approval'::leave_request_status end;
  update leave_requests set status=v_status,submitted_at=now(),workflow_snapshot=p_workflow_snapshot,
    request_snapshot=coalesce(p_request_snapshot,'{}'::jsonb)||jsonb_build_object('leaveTypeSnapshot',jsonb_build_object('id',v_type.id,'name',v_type.name,'deductsBalance',v_type.deducts_balance,'requiresReason',v_type.requires_reason,'requiresAttachment',v_type.requires_attachment),
    'calendarSnapshot',jsonb_build_object('weekendDays',to_jsonb(v_policy.weekend_days),'holidays',(select coalesce(jsonb_agg(holiday_date order by holiday_date),'[]'::jsonb) from work_calendar_holidays where active and holiday_date between v_request.start_date and v_request.end_date),'workingDates',v_working_dates)) where id=p_request_id;
  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_step_status:=coalesce(v_step->>'status','pending')::leave_approval_status;
    insert into leave_request_approval_steps(request_id,step_order,approver_source,resolved_approver_account_id,resolved_approver_name,status,snapshot)
    values(p_request_id,(v_step->>'step_order')::int,(v_step->>'approver_source')::leave_approver_source,nullif(v_step->>'resolved_approver_account_id','')::uuid,nullif(v_step->>'resolved_approver_name',''),v_step_status,coalesce(v_step->'snapshot','{}'::jsonb));
  end loop;
  insert into leave_domain_events(event_type,aggregate_id,payload) values
    ('leave.submitted',p_request_id,jsonb_build_object('actorId',p_actor_id)),
    (case when v_missing then 'leave.approver_missing' else 'leave.approval_required' end,p_request_id,'{}'::jsonb);
  return v_status::text;
end $$;

-- The approval check follows the submitted type snapshot. The employee lock
-- serializes approvals of separate requests against the same entitlement.
create or replace function public.validate_leave_approval_balance()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_deducts boolean;v_allow_negative boolean;v_balance numeric;
begin
  if new.status='approved' and old.status is distinct from 'approved' then
    perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||new.employee_id::text,0));
    select coalesce((new.request_snapshot->'leaveTypeSnapshot'->>'deductsBalance')::boolean,deducts_balance) into v_deducts from leave_types where id=new.leave_type_id;
    select allow_negative_balance into v_allow_negative from leave_policies where active limit 1;
    if coalesce(v_deducts,false) then
      if extract(year from new.start_date)<>extract(year from new.end_date) then raise exception 'LEAVE_CROSS_YEAR';end if;
      if not coalesce(v_allow_negative,false) then
        select coalesce(sum(amount),0) into v_balance from leave_ledger where employee_id=new.employee_id and leave_year=extract(year from new.start_date)::int and leave_type_id=new.leave_type_id;
        if v_balance<new.calculated_days then raise exception 'LEAVE_BALANCE_INSUFFICIENT';end if;
      end if;
    end if;
  end if;
  return new;
end $$;

create or replace function public.process_leave_approval_command(
  p_request_id uuid,p_actor_id uuid,p_action text,p_comment text,p_expected_version integer,p_expected_step_id uuid,
  p_override_assignee boolean default false,p_allow_delegation boolean default false
) returns text language plpgsql security definer set search_path=public as $$
declare v_request leave_requests%rowtype;v_step leave_request_approval_steps%rowtype;v_next leave_request_approval_steps%rowtype;v_result text;v_deducts boolean;v_previous_actor uuid;
begin
  select * into v_request from leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_NOT_FOUND';end if;
  if v_request.status not in ('submitted','pending_approval') then raise exception 'LEAVE_STATUS_CONFLICT';end if;
  if p_expected_version is not null and v_request.version<>p_expected_version then raise exception 'LEAVE_VERSION_CONFLICT';end if;
  if not leave_actor_can(p_actor_id,array['leave.approve','leave.approve_all','approval.act']) then raise exception 'LEAVE_ACTOR_DENIED';end if;
  if p_action is null or p_action not in ('approve','reject') then raise exception 'LEAVE_ACTION_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||v_request.employee_id::text,0));
  select * into v_step from leave_request_approval_steps where request_id=p_request_id and status='pending' order by step_order limit 1 for update;
  if not found then raise exception 'LEAVE_STEP_CONFLICT';end if;
  if p_expected_step_id is not null and v_step.id<>p_expected_step_id then raise exception 'LEAVE_STEP_CONFLICT';end if;
  if v_step.resolved_approver_account_id is distinct from p_actor_id then
    v_previous_actor:=v_step.resolved_approver_account_id;
    if p_override_assignee and leave_actor_can(p_actor_id,array['leave.approve_all']) then
      update leave_request_approval_steps set resolved_approver_account_id=p_actor_id,resolved_approver_name=(select display_name from app_accounts where id=p_actor_id),snapshot=snapshot||jsonb_build_object('reassignedByAllScope',true,'previousApproverId',v_previous_actor) where id=v_step.id;
    elsif p_allow_delegation and leave_actor_can(p_actor_id,array['approval.act']) and exists(select 1 from approval_delegations where from_account_id=v_previous_actor and to_account_id=p_actor_id and status='active' and start_at<=now() and end_at>=now() and scope in ('ALL_APPROVALS','LEAVE')) then
      update approval_steps set delegated_from_account_id=v_previous_actor where source_step_id=v_step.id::text;
      update leave_request_approval_steps set resolved_approver_account_id=p_actor_id,resolved_approver_name=(select display_name from app_accounts where id=p_actor_id),snapshot=snapshot||jsonb_build_object('delegatedFromAccountId',v_previous_actor) where id=v_step.id;
    else raise exception 'LEAVE_APPROVER_MISMATCH';end if;
  end if;
  if p_action='reject' then
    if length(trim(coalesce(p_comment,'')))<3 then raise exception 'LEAVE_REJECT_REASON_REQUIRED';end if;
    update leave_request_approval_steps set status='rejected',acted_at=now(),comment=p_comment where id=v_step.id;
    update leave_request_approval_steps set status='cancelled' where request_id=p_request_id and status='pending';
    update leave_requests set status='rejected',rejected_at=now() where id=p_request_id;
    insert into leave_domain_events(event_type,aggregate_id,payload) values('leave.rejected',p_request_id,jsonb_build_object('actorId',p_actor_id));
    return 'rejected';
  end if;
  if p_action<>'approve' then raise exception 'LEAVE_ACTION_INVALID';end if;
  perform 1 from timesheet_periods p where p.start_date<=v_request.end_date and p.end_date>=v_request.start_date
    and (exists(select 1 from daily_timesheets d where d.period_id=p.id and d.employee_id=v_request.employee_id) or exists(select 1 from timesheet_period_summaries s where s.period_id=p.id and s.employee_id=v_request.employee_id)) for share;
  if exists(select 1 from timesheet_periods p where p.status='locked' and p.start_date<=v_request.end_date and p.end_date>=v_request.start_date
    and (exists(select 1 from daily_timesheets d where d.period_id=p.id and d.employee_id=v_request.employee_id) or exists(select 1 from timesheet_period_summaries s where s.period_id=p.id and s.employee_id=v_request.employee_id))) then raise exception 'LEAVE_TIMESHEET_LOCKED';end if;
  update leave_request_approval_steps set status='approved',acted_at=now(),comment=p_comment where id=v_step.id;
  select * into v_next from leave_request_approval_steps where request_id=p_request_id and status='pending' order by step_order limit 1;
  if found then
    v_result:=case when v_next.resolved_approver_account_id is null then 'submitted' else 'pending_approval' end;
    update leave_requests set status=v_result::leave_request_status where id=p_request_id;
    insert into leave_domain_events(event_type,aggregate_id,payload) values('leave.step_approved',p_request_id,jsonb_build_object('actorId',p_actor_id,'stepId',v_step.id));
  else
    update leave_requests set status='approved',approved_at=now(),approved_snapshot=jsonb_build_object('request',coalesce(v_request.request_snapshot,'{}'::jsonb),'employee',v_request.employee_snapshot,'workflow',v_request.workflow_snapshot,'approvedAt',now()) where id=p_request_id;
    select coalesce((v_request.request_snapshot->'leaveTypeSnapshot'->>'deductsBalance')::boolean,deducts_balance) into v_deducts from leave_types where id=v_request.leave_type_id;
    if coalesce(v_deducts,false) then
      insert into leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason,created_by)
      values(v_request.employee_id,extract(year from v_request.start_date)::int,v_request.leave_type_id,'leave_usage',-v_request.calculated_days,'leave_request',v_request.id::text,v_request.start_date,'Đơn '||v_request.request_number,p_actor_id)
      on conflict(reference_type,reference_id,transaction_type,leave_type_id) do nothing;
    end if;
    insert into leave_attendance_conflicts(request_id,employee_id,conflict_date,source_type,source_id)
      select v_request.id,v_request.employee_id,a.attendance_date,'self_attendance',a.id from attendance_events a where a.employee_id=v_request.employee_id and a.attendance_date between v_request.start_date and v_request.end_date on conflict do nothing;
    insert into leave_domain_events(event_type,aggregate_id,payload) values('leave.approved',p_request_id,jsonb_build_object('actorId',p_actor_id));v_result:='approved';
  end if;
  return v_result;
end $$;

-- Retain the existing RPC signature for clients that already use the platform.
create or replace function public.process_leave_approval(p_request_id uuid,p_actor_id uuid,p_action text,p_comment text default null)
returns text language sql security definer set search_path=public as $$
  select process_leave_approval_command(p_request_id,p_actor_id,p_action,p_comment,null,null,false,false)
$$;

create or replace function public.withdraw_leave_request_command(p_request_id uuid,p_actor_id uuid,p_expected_version integer)
returns text language plpgsql security definer set search_path=public as $$
declare v_request leave_requests%rowtype;
begin
  select * into v_request from leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_NOT_FOUND';end if;
  if not leave_actor_can(p_actor_id,array['leave.self.withdraw']) or not exists(select 1 from app_accounts where id=p_actor_id and employee_id=v_request.employee_id and status='active') then raise exception 'LEAVE_ACTOR_DENIED';end if;
  if v_request.version<>p_expected_version then raise exception 'LEAVE_VERSION_CONFLICT';end if;
  if v_request.status not in ('submitted','pending_approval') then raise exception 'LEAVE_STATUS_CONFLICT';end if;
  if not exists(select 1 from leave_policies where active and allow_withdraw_pending) then raise exception 'LEAVE_WITHDRAW_DISABLED';end if;
  update leave_requests set status='withdrawn',withdrawn_at=now() where id=p_request_id;
  update leave_request_approval_steps set status='cancelled' where request_id=p_request_id and status='pending';
  insert into leave_domain_events(event_type,aggregate_id,payload) values('leave.withdrawn',p_request_id,jsonb_build_object('actorId',p_actor_id));return 'withdrawn';
end $$;

create or replace function public.cancel_approved_leave_command(p_request_id uuid,p_actor_id uuid,p_reason text,p_expected_version integer)
returns text language plpgsql security definer set search_path=public as $$
declare v_request leave_requests%rowtype;v_owner boolean;
begin
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'LEAVE_CANCEL_REASON_REQUIRED';end if;
  select * into v_request from leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_NOT_FOUND';end if;
  select exists(select 1 from app_accounts where id=p_actor_id and employee_id=v_request.employee_id and status='active') into v_owner;
  if not v_owner and not leave_actor_can(p_actor_id,array['leave.view_all','leave.approve_all']) then raise exception 'LEAVE_ACTOR_DENIED';end if;
  if p_expected_version is not null and v_request.version<>p_expected_version then raise exception 'LEAVE_VERSION_CONFLICT';end if;
  if v_request.status<>'approved' then raise exception 'LEAVE_STATUS_CONFLICT';end if;
  if exists(select 1 from leave_policies where active and cancellation_requires_approval) and not leave_actor_can(p_actor_id,array['leave.approve_all']) then raise exception 'LEAVE_CANCEL_APPROVAL_REQUIRED';end if;
  perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||v_request.employee_id::text,0));
  perform 1 from timesheet_periods p where p.start_date<=v_request.end_date and p.end_date>=v_request.start_date
    and (exists(select 1 from daily_timesheets d where d.period_id=p.id and d.employee_id=v_request.employee_id) or exists(select 1 from timesheet_period_summaries s where s.period_id=p.id and s.employee_id=v_request.employee_id)) for share;
  if exists(select 1 from timesheet_periods p where p.status='locked' and p.start_date<=v_request.end_date and p.end_date>=v_request.start_date
    and (exists(select 1 from daily_timesheets d where d.period_id=p.id and d.employee_id=v_request.employee_id) or exists(select 1 from timesheet_period_summaries s where s.period_id=p.id and s.employee_id=v_request.employee_id))) then raise exception 'LEAVE_TIMESHEET_LOCKED';end if;
  -- Refund the entries actually charged, even when the type is subsequently
  -- renamed, disabled or configured not to deduct entitlement.
  insert into leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason,created_by)
    select employee_id,leave_year,leave_type_id,'leave_reversal',-amount,'leave_request',v_request.id::text,(now() at time zone 'Asia/Ho_Chi_Minh')::date,p_reason,p_actor_id
    from leave_ledger where employee_id=v_request.employee_id and reference_type='leave_request' and reference_id=v_request.id::text and transaction_type='leave_usage' and amount<0
    on conflict(reference_type,reference_id,transaction_type,leave_type_id) do nothing;
  update leave_requests set status='cancelled',cancelled_at=now() where id=p_request_id;
  update leave_attendance_conflicts set status='resolved' where request_id=p_request_id and status='open';
  insert into leave_domain_events(event_type,aggregate_id,payload) values('leave.cancelled',p_request_id,jsonb_build_object('actorId',p_actor_id,'reason',p_reason));return 'cancelled';
end $$;

create or replace function public.cancel_approved_leave(p_request_id uuid,p_actor_id uuid,p_reason text)
returns text language sql security definer set search_path=public as $$
  select cancel_approved_leave_command(p_request_id,p_actor_id,p_reason,null)
$$;

create or replace function public.post_leave_ledger_command(
  p_employee_ids uuid[],p_year integer,p_leave_type_id uuid,p_transaction_type text,p_amount numeric,p_reason text,p_effective_date date,p_idempotency_key uuid,p_actor_id uuid
) returns void language plpgsql security definer set search_path=public as $$
declare v_employee_id uuid;v_existing leave_ledger%rowtype;v_balance numeric;v_pending numeric;v_allow_negative boolean;v_reference_type text;v_reference_id text;
begin
  if not leave_actor_can(p_actor_id,array['leave.balance.adjust']) then raise exception 'LEAVE_ACTOR_DENIED';end if;
  if p_employee_ids is null or coalesce(array_length(p_employee_ids,1),0) not between 1 and 1000
    or p_year is null or p_year not between 2000 and 2200 or p_effective_date is null or extract(year from p_effective_date)::int<>p_year
    or p_transaction_type is null or p_transaction_type not in ('grant','adjustment_add','adjustment_subtract')
    or p_amount is null or p_amount=0 or abs(p_amount)>365 or p_amount<>round(p_amount,2)
    or (p_transaction_type in ('grant','adjustment_add') and p_amount<0) or (p_transaction_type='adjustment_subtract' and p_amount>0)
    or p_idempotency_key is null or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'LEAVE_LEDGER_INPUT_INVALID';end if;
  perform 1 from leave_types where id=p_leave_type_id and active and deducts_balance for share;
  if not found then raise exception 'LEAVE_TARGET_INVALID';end if;
  select allow_negative_balance into v_allow_negative from leave_policies where active for share;
  if not found then raise exception 'LEAVE_POLICY_NOT_FOUND';end if;
  -- Sort the employee locks to keep concurrent grant batches in one order.
  for v_employee_id in select distinct unnest(p_employee_ids) order by 1 loop
    perform 1 from employees where id=v_employee_id and employment_status in ('active','probation','pending_onboarding','on_leave') for share;
    if not found then raise exception 'LEAVE_TARGET_INVALID';end if;
    perform pg_advisory_xact_lock(hashtextextended('leave-balance:'||v_employee_id::text,0));
    v_reference_type:=case when p_transaction_type='grant' then 'grant_batch' else 'hr_adjustment' end;
    v_reference_id:=case when p_transaction_type='grant' then p_idempotency_key::text||':'||v_employee_id::text else p_idempotency_key::text end;
    select * into v_existing from leave_ledger where idempotency_key=p_idempotency_key and employee_id=v_employee_id and leave_type_id=p_leave_type_id;
    if found then
      if v_existing.leave_year<>p_year or v_existing.transaction_type::text<>p_transaction_type or v_existing.amount<>p_amount or v_existing.reason<>p_reason or v_existing.effective_date<>p_effective_date or v_existing.reference_type<>v_reference_type or v_existing.reference_id<>v_reference_id then raise exception 'LEAVE_LEDGER_REPLAY_CONFLICT';end if;
      continue;
    end if;
    if p_transaction_type='adjustment_subtract' and not v_allow_negative then
      select coalesce(sum(amount),0) into v_balance from leave_ledger where employee_id=v_employee_id and leave_year=p_year and leave_type_id=p_leave_type_id;
      select coalesce(sum(calculated_days),0) into v_pending from leave_requests where employee_id=v_employee_id and leave_type_id=p_leave_type_id and status in ('submitted','pending_approval') and extract(year from start_date)::int=p_year;
      if v_balance+p_amount-v_pending<0 then raise exception 'LEAVE_BALANCE_INSUFFICIENT';end if;
    end if;
    insert into leave_ledger(employee_id,leave_year,leave_type_id,transaction_type,amount,reference_type,reference_id,effective_date,reason,idempotency_key,created_by)
    values(v_employee_id,p_year,p_leave_type_id,p_transaction_type::leave_ledger_transaction_type,p_amount,v_reference_type,v_reference_id,p_effective_date,p_reason,p_idempotency_key,p_actor_id);
  end loop;
end $$;

revoke all on function public.leave_actor_can(uuid,text[]) from public,anon,authenticated;
revoke all on function public.save_leave_workflow_command(uuid,text,text,boolean,jsonb,uuid,integer) from public,anon,authenticated;
revoke all on function public.submit_leave_request_command(uuid,uuid,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.process_leave_approval_command(uuid,uuid,text,text,integer,uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function public.process_leave_approval(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.withdraw_leave_request_command(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.cancel_approved_leave_command(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.cancel_approved_leave(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.post_leave_ledger_command(uuid[],integer,uuid,text,numeric,text,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.leave_actor_can(uuid,text[]) to service_role;
grant execute on function public.save_leave_workflow_command(uuid,text,text,boolean,jsonb,uuid,integer) to service_role;
grant execute on function public.submit_leave_request_command(uuid,uuid,integer,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.process_leave_approval_command(uuid,uuid,text,text,integer,uuid,boolean,boolean) to service_role;
grant execute on function public.process_leave_approval(uuid,uuid,text,text) to service_role;
grant execute on function public.withdraw_leave_request_command(uuid,uuid,integer) to service_role;
grant execute on function public.cancel_approved_leave_command(uuid,uuid,text,integer) to service_role;
grant execute on function public.cancel_approved_leave(uuid,uuid,text) to service_role;
grant execute on function public.post_leave_ledger_command(uuid[],integer,uuid,text,numeric,text,date,uuid,uuid) to service_role;
