-- Make approval reassignment retries and workflow publication deterministic.
create or replace function public.reassign_approval_step(
  p_case_id uuid,
  p_actor_id uuid,
  p_to_account_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_step public.approval_steps%rowtype;
  v_id uuid;
begin
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception using errcode='P0001',message='REASSIGN_REASON_REQUIRED';
  end if;
  if not exists(select 1 from public.app_accounts where id=p_to_account_id and status='active') then
    raise exception using errcode='P0001',message='REASSIGN_TARGET_INVALID';
  end if;

  select * into v_step
  from public.approval_steps
  where approval_case_id=p_case_id and status='pending'
  order by step_order
  limit 1
  for update;
  if not found then
    raise exception using errcode='P0001',message='APPROVAL_STEP_NOT_FOUND';
  end if;

  if v_step.resolved_approver_account_id = p_to_account_id then
    select id into v_id
    from public.approval_reassignments
    where approval_step_id=v_step.id and to_account_id=p_to_account_id
    order by created_at desc,id desc
    limit 1;
    return coalesce(v_id,v_step.id);
  end if;

  insert into public.approval_reassignments(
    approval_step_id,from_account_id,to_account_id,reason,reassigned_by
  ) values (
    v_step.id,v_step.resolved_approver_account_id,p_to_account_id,trim(p_reason),p_actor_id
  ) returning id into v_id;

  update public.approval_steps
  set resolved_approver_account_id=p_to_account_id,
      resolved_approver_name=(select display_name from public.app_accounts where id=p_to_account_id)
  where id=v_step.id;
  update public.leave_request_approval_steps
  set resolved_approver_account_id=p_to_account_id,
      resolved_approver_name=(select display_name from public.app_accounts where id=p_to_account_id)
  where id::text=v_step.source_step_id
    and exists(
      select 1 from public.approval_cases
      where id=p_case_id and domain_type='LEAVE'
    );
  return v_id;
end
$$;

create or replace function public.publish_approval_workflow_command(
  p_code text,
  p_name text,
  p_domain_type text,
  p_expected_processing_hours integer,
  p_steps jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workflow_id uuid;
  v_workflow_version_id uuid;
  v_version integer;
  v_step jsonb;
  v_step_order integer := 0;
  v_source text;
begin
  if p_steps is null or jsonb_typeof(p_steps) <> 'array'
    or jsonb_array_length(p_steps) < 1 or jsonb_array_length(p_steps) > 12 then
    raise exception using errcode='P0001',message='WORKFLOW_STEPS_INVALID';
  end if;
  if p_expected_processing_hours is not null and p_expected_processing_hours <= 0 then
    raise exception using errcode='P0001',message='WORKFLOW_EXPECTED_HOURS_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('approval-workflow:' || p_code,0));
  insert into public.approval_workflows(
    code,name,domain_type,active,published_version,expected_processing_hours,created_by
  ) values (
    p_code,p_name,p_domain_type,true,0,p_expected_processing_hours,p_actor_id
  ) on conflict(code) do nothing;

  select id,published_version + 1 into v_workflow_id,v_version
  from public.approval_workflows
  where code=p_code
  for update;
  if not found then
    raise exception using errcode='P0001',message='WORKFLOW_NOT_FOUND';
  end if;

  insert into public.approval_workflow_versions(
    workflow_id,version,status,published_by
  ) values (
    v_workflow_id,v_version,'draft',p_actor_id
  ) returning id into v_workflow_version_id;

  for v_step in select value from jsonb_array_elements(p_steps) loop
    v_step_order := v_step_order + 1;
    v_source := v_step->>'approverSource';
    if length(trim(coalesce(v_step->>'stepName',''))) < 2
      or coalesce(v_source,'') not in (
        'direct_manager','department_manager','project_manager','specific_role',
        'specific_user','hr_resolver','warehouse_manager','domain_resolver'
      ) then
      raise exception using errcode='P0001',message='WORKFLOW_STEP_INVALID';
    end if;
    insert into public.approval_workflow_steps(
      workflow_version_id,step_order,step_name,approver_source,resolver_config
    ) values (
      v_workflow_version_id,v_step_order,trim(v_step->>'stepName'),v_source,
      coalesce(v_step->'resolverConfig','{}'::jsonb)
    );
  end loop;

  update public.approval_workflow_versions
  set status='retired'
  where workflow_id=v_workflow_id and status='published';
  update public.approval_workflow_versions
  set status='published',published_at=now()
  where id=v_workflow_version_id;
  update public.approval_workflows
  set name=p_name,domain_type=p_domain_type,
      expected_processing_hours=p_expected_processing_hours,
      published_version=v_version,active=true
  where id=v_workflow_id;

  return jsonb_build_object('workflow_id',v_workflow_id,'version',v_version);
end
$$;

drop trigger if exists approval_steps_realtime_invalidation on public.approval_steps;
create trigger approval_steps_realtime_invalidation
after insert or update on public.approval_steps
for each row execute function public.enqueue_realtime_invalidation('approvals','approval.inbox.view','resolved_approver_account_id');

drop trigger if exists approval_delegations_realtime_invalidation on public.approval_delegations;
create trigger approval_delegations_realtime_invalidation
after insert or update or delete on public.approval_delegations
for each row execute function public.enqueue_realtime_invalidation('approvals','approval.inbox.view','to_account_id');

drop trigger if exists approval_workflows_realtime_invalidation on public.approval_workflows;
create trigger approval_workflows_realtime_invalidation
after insert or update on public.approval_workflows
for each row execute function public.enqueue_realtime_invalidation('settings','approval.workflow.manage','');

revoke all on function public.reassign_approval_step(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.publish_approval_workflow_command(text,text,text,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.reassign_approval_step(uuid,uuid,uuid,text) to service_role;
grant execute on function public.publish_approval_workflow_command(text,text,text,integer,jsonb,uuid) to service_role;
