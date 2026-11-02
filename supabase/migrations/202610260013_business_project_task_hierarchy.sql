alter table public.business_project_tasks add column parent_task_id uuid;
alter table public.business_project_tasks add constraint business_project_tasks_parent_fk foreign key(tenant_id,parent_task_id) references public.business_project_tasks(tenant_id,id);
create index business_project_tasks_parent_idx on public.business_project_tasks(tenant_id,parent_task_id) where parent_task_id is not null;

update public.business_entity_definitions
set definition=jsonb_set(definition,'{fields,parent_task_id}','{"label":"Công việc cha","type":"ref","ref":"project_tasks"}'::jsonb,true)
where kind='project_tasks';

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
 if new.task_state='completed' and (new.progress_percent<>100 or exists(select 1 from jsonb_array_elements(new.checklist) as elem(item) where item->>'required'='true' and item->>'done'<>'true')) then raise exception 'BUSINESS_TASK_CHECKLIST_REQUIRED';end if;
 if new.task_state='completed' and (tg_op='INSERT' or old.task_state<>'completed') and current_setting('app.project_task_acceptance',true) is distinct from 'approved' then raise exception 'BUSINESS_TASK_ACCEPTANCE_REQUIRED';end if;
 if new.task_state='completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks p on p.tenant_id=d.tenant_id and p.id=d.predecessor_id where d.tenant_id=new.tenant_id and d.task_id=new.id and d.required_for_completion and p.task_state<>'completed') then raise exception 'BUSINESS_TASK_PREREQUISITE_REQUIRED';end if;
 if tg_op='UPDATE' then
  if new.project_id<>old.project_id and exists(select 1 from public.business_project_task_dependencies d where d.tenant_id=old.tenant_id and (d.task_id=old.id or d.predecessor_id=old.id)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if new.project_id<>old.project_id and exists(select 1 from public.business_project_tasks child where child.tenant_id=old.tenant_id and child.parent_task_id=old.id) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if old.task_state='completed' and new.task_state<>'completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks dependent on dependent.tenant_id=d.tenant_id and dependent.id=d.task_id where d.tenant_id=old.tenant_id and d.predecessor_id=old.id and d.required_for_completion and dependent.task_state='completed') then raise exception 'BUSINESS_TASK_DEPENDENT_COMPLETED';end if;
  if old.task_state='completed' and new.task_state<>'completed' and exists(select 1 from public.business_project_tasks child where child.tenant_id=old.tenant_id and child.parent_task_id=old.id and child.task_state='completed') then raise exception 'BUSINESS_TASK_DEPENDENT_COMPLETED';end if;
 end if;
 return new;
end $$;

alter function public.business_project_task_save(text,text,uuid,uuid,integer,jsonb,text) rename to business_project_task_save_core;

create function public.business_project_task_save(p_hash text,p_slug text,p_request_id uuid,p_task_id uuid,p_expected_version integer,p_data jsonb,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.business_accounts%rowtype;v_result jsonb;v_project_id uuid;v_parent_id uuid;v_task_id uuid;v_task public.business_project_tasks%rowtype;v_has_cycle boolean;
begin
 v_actor:=public.business_assert_session(p_hash,p_slug,true);
 v_result:=public.business_command_replay(p_request_id,v_actor.tenant_id,v_actor.id,'project.task',p_payload_hash);if v_result is not null then return v_result;end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 v_project_id:=nullif(p_data->>'project_id','')::uuid;v_parent_id:=nullif(p_data->>'parent_task_id','')::uuid;
 if v_project_id is not null then perform pg_advisory_xact_lock(hashtextextended(v_actor.tenant_id::text||':'||v_project_id::text,0));end if;
 v_result:=public.business_project_task_save_core(p_hash,p_slug,p_request_id,p_task_id,p_expected_version,p_data,p_payload_hash);v_task_id:=(v_result->>'id')::uuid;
 select t.* into v_task from public.business_project_tasks t where t.tenant_id=v_actor.tenant_id and t.id=v_task_id for update;
 if v_task.parent_task_id is not distinct from v_parent_id then return v_result;end if;
 if v_parent_id is not null then
  if v_parent_id=v_task_id or not exists(select 1 from public.business_project_tasks p where p.tenant_id=v_actor.tenant_id and p.id=v_parent_id and p.project_id=v_task.project_id and p.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  with recursive ancestors(id,parent_task_id) as(select p.id,p.parent_task_id from public.business_project_tasks p where p.tenant_id=v_actor.tenant_id and p.id=v_parent_id union select p.id,p.parent_task_id from public.business_project_tasks p join ancestors a on a.parent_task_id=p.id where p.tenant_id=v_actor.tenant_id) select exists(select 1 from ancestors where id=v_task_id) into v_has_cycle;
  if v_has_cycle then raise exception 'BUSINESS_TASK_HIERARCHY_CYCLE';end if;
 end if;
 update public.business_project_tasks t set parent_task_id=v_parent_id,row_version=t.row_version+1,updated_at=now() where t.tenant_id=v_actor.tenant_id and t.id=v_task_id returning t.* into v_task;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(v_actor.tenant_id,v_actor.id,'project.task.parent_set','project_tasks',v_task_id,jsonb_build_object('parentTaskId',v_parent_id));
 v_result:=jsonb_set(v_result,'{rowVersion}',to_jsonb(v_task.row_version),true);
 update public.business_commands c set receipt=v_result where c.request_id=p_request_id and c.tenant_id=v_actor.tenant_id and c.actor_id=v_actor.id and c.kind='project.task';
 return v_result;
end $$;

revoke all on function public.business_project_task_save_core(text,text,uuid,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.business_project_task_save(text,text,uuid,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.business_project_task_save(text,text,uuid,uuid,integer,jsonb,text) to service_role;
