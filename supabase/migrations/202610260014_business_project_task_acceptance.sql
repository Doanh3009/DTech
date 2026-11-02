create or replace function public.business_project_task_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare has_cycle boolean;
begin
 if not exists(select 1 from public.business_projects p where p.tenant_id=new.tenant_id and p.id=new.project_id and p.status='active') or not exists(select 1 from public.business_staff s where s.tenant_id=new.tenant_id and s.id=new.assigned_staff_id and s.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if new.wbs_id is not null and not exists(select 1 from public.business_project_wbs w where w.tenant_id=new.tenant_id and w.id=new.wbs_id and w.project_id=new.project_id and w.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if new.parent_task_id is not null then
  if new.parent_task_id=new.id or not exists(select 1 from public.business_project_tasks p where p.tenant_id=new.tenant_id and p.id=new.parent_task_id and p.project_id=new.project_id and p.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':'||new.project_id::text,0));
  with recursive ancestors(id,parent_task_id) as(select p.id,p.parent_task_id from public.business_project_tasks p where p.tenant_id=new.tenant_id and p.id=new.parent_task_id union select p.id,p.parent_task_id from public.business_project_tasks p join ancestors a on a.parent_task_id=p.id where p.tenant_id=new.tenant_id) select exists(select 1 from ancestors where id=new.id) into has_cycle;
  if has_cycle then raise exception 'BUSINESS_TASK_HIERARCHY_CYCLE';end if;
 end if;
 if new.task_state in ('awaiting_acceptance','completed') and (new.progress_percent<>100 or exists(select 1 from jsonb_array_elements(new.checklist) as elem(item) where item->>'required'='true' and item->>'done'<>'true')) then raise exception 'BUSINESS_TASK_CHECKLIST_REQUIRED';end if;
 if new.task_state='completed' and (tg_op='INSERT' or old.task_state<>'completed') and current_setting('app.project_task_acceptance',true) is distinct from 'approved' then raise exception 'BUSINESS_TASK_ACCEPTANCE_REQUIRED';end if;
 if new.task_state='completed' and exists(select 1 from public.business_project_tasks child where child.tenant_id=new.tenant_id and child.parent_task_id=new.id and child.task_state<>'completed') then raise exception 'BUSINESS_TASK_CHILDREN_REQUIRED';end if;
 if new.task_state='completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks p on p.tenant_id=d.tenant_id and p.id=d.predecessor_id where d.tenant_id=new.tenant_id and d.task_id=new.id and d.required_for_completion and p.task_state<>'completed') then raise exception 'BUSINESS_TASK_PREREQUISITE_REQUIRED';end if;
 if tg_op='UPDATE' then
  if new.project_id<>old.project_id and exists(select 1 from public.business_project_task_dependencies d where d.tenant_id=old.tenant_id and (d.task_id=old.id or d.predecessor_id=old.id)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if new.project_id<>old.project_id and exists(select 1 from public.business_project_tasks child where child.tenant_id=old.tenant_id and child.parent_task_id=old.id) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if old.task_state='completed' and new.task_state<>'completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks dependent on dependent.tenant_id=d.tenant_id and dependent.id=d.task_id where d.tenant_id=old.tenant_id and d.predecessor_id=old.id and d.required_for_completion and dependent.task_state='completed') then raise exception 'BUSINESS_TASK_DEPENDENT_COMPLETED';end if;
  if old.task_state='completed' and new.task_state<>'completed' and exists(select 1 from public.business_project_tasks child where child.tenant_id=old.tenant_id and child.parent_task_id=old.id and child.task_state='completed') then raise exception 'BUSINESS_TASK_DEPENDENT_COMPLETED';end if;
 end if;
 return new;
end $$;

create function public.business_project_task_acceptance(p_hash text,p_slug text,p_task_id uuid,p_expected_version integer,p_decision text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_project_tasks%rowtype;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);
 select * into t from public.business_project_tasks where tenant_id=a.tenant_id and id=p_task_id and status='active' for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 if p_decision not in ('approve','return') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 perform public.business_assert_access(a.id,'project_tasks','approve',to_jsonb(t));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'project.task.acceptance',p_payload_hash);if r is not null then return r;end if;
 if t.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if t.task_state<>'awaiting_acceptance' then raise exception 'BUSINESS_TASK_ACCEPTANCE_REQUIRED';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_decision='approve' then perform set_config('app.project_task_acceptance','approved',true);end if;
 update public.business_project_tasks set task_state=case when p_decision='approve' then 'completed' else 'in_progress' end,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=p_task_id returning * into t;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'project.task.'||p_decision,'project_tasks',p_task_id,jsonb_build_object('reason',btrim(p_reason),'rowVersion',t.row_version));
 r:=jsonb_build_object('id',t.id,'taskState',t.task_state,'rowVersion',t.row_version);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'project.task.acceptance',p_payload_hash,r);
 return r;
end $$;

revoke all on function public.business_project_task_acceptance(text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_project_task_acceptance(text,text,uuid,integer,text,text,uuid,text) to service_role;
