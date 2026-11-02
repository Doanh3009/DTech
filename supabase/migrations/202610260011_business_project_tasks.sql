insert into public.business_entity_definitions(kind,definition) values('project_tasks','{"label":"Công việc công trình","feature":"projects","mode":"master","operationDomain":true,"misaDomain":true,"fields":{"project_id":{"label":"Công trình","type":"ref","ref":"projects","required":true},"wbs_id":{"label":"Hạng mục","type":"ref","ref":"project_wbs"},"assigned_staff_id":{"label":"Người phụ trách","type":"ref","ref":"staff","required":true},"planned_start_on":{"label":"Bắt đầu","type":"date","required":true},"due_on":{"label":"Hạn hoàn thành","type":"date","required":true},"priority":{"label":"Ưu tiên","type":"enum","values":{"low":"Thấp","normal":"Bình thường","high":"Cao","urgent":"Khẩn cấp"},"default":"normal"},"task_state":{"label":"Trạng thái","type":"enum","values":{"pending":"Chờ","in_progress":"Đang làm","awaiting_acceptance":"Chờ nghiệm thu","completed":"Hoàn thành","cancelled":"Đã hủy"},"default":"pending"},"progress_percent":{"label":"Tiến độ (%)","type":"number","min":0,"max":100,"integer":true,"default":0}}}'::jsonb);

create table public.business_project_tasks(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),
 name text not null check(char_length(name) between 2 and 180),
 notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),
 row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 project_id uuid not null,
 wbs_id uuid,
 assigned_staff_id uuid not null,
 planned_start_on date not null,
 due_on date not null,
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 task_state text not null default 'pending' check(task_state in ('pending','in_progress','awaiting_acceptance','completed','cancelled')),
 progress_percent smallint not null default 0 check(progress_percent between 0 and 100),
 checklist jsonb not null default '[]'::jsonb check(jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=100),
 check(due_on>=planned_start_on),
 foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id),
 foreign key(tenant_id,wbs_id) references public.business_project_wbs(tenant_id,id),
 foreign key(tenant_id,assigned_staff_id) references public.business_staff(tenant_id,id)
);
create unique index business_project_tasks_code_idx on public.business_project_tasks(tenant_id,lower(code));
create index business_project_tasks_project_idx on public.business_project_tasks(tenant_id,project_id,planned_start_on,due_on,id);
create index business_project_tasks_assignee_idx on public.business_project_tasks(tenant_id,assigned_staff_id,task_state,due_on);
alter table public.business_project_tasks enable row level security;
revoke all on public.business_project_tasks from public,anon,authenticated,service_role;

create table public.business_project_task_dependencies(
 tenant_id uuid not null,
 task_id uuid not null,
 predecessor_id uuid not null,
 required_for_completion boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(tenant_id,task_id,predecessor_id),
 check(task_id<>predecessor_id),
 foreign key(tenant_id,task_id) references public.business_project_tasks(tenant_id,id) on delete cascade,
 foreign key(tenant_id,predecessor_id) references public.business_project_tasks(tenant_id,id)
);
create index business_project_task_dependencies_predecessor_idx on public.business_project_task_dependencies(tenant_id,predecessor_id);
alter table public.business_project_task_dependencies enable row level security;
revoke all on public.business_project_task_dependencies from public,anon,authenticated,service_role;

create function public.business_project_task_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.business_projects p where p.tenant_id=new.tenant_id and p.id=new.project_id and p.status='active') or not exists(select 1 from public.business_staff s where s.tenant_id=new.tenant_id and s.id=new.assigned_staff_id and s.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if new.wbs_id is not null and not exists(select 1 from public.business_project_wbs w where w.tenant_id=new.tenant_id and w.id=new.wbs_id and w.project_id=new.project_id and w.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if new.task_state='completed' and (new.progress_percent<>100 or exists(select 1 from jsonb_array_elements(new.checklist) as elem(item) where item->>'required'='true' and item->>'done'<>'true')) then raise exception 'BUSINESS_TASK_CHECKLIST_REQUIRED';end if;
 if new.task_state='completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks p on p.tenant_id=d.tenant_id and p.id=d.predecessor_id where d.tenant_id=new.tenant_id and d.task_id=new.id and d.required_for_completion and p.task_state<>'completed') then raise exception 'BUSINESS_TASK_PREREQUISITE_REQUIRED';end if;
 if tg_op='UPDATE' then
  if new.project_id<>old.project_id and exists(select 1 from public.business_project_task_dependencies d where d.tenant_id=old.tenant_id and (d.task_id=old.id or d.predecessor_id=old.id)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if old.task_state='completed' and new.task_state<>'completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks dependent on dependent.tenant_id=d.tenant_id and dependent.id=d.task_id where d.tenant_id=old.tenant_id and d.predecessor_id=old.id and d.required_for_completion and dependent.task_state='completed') then raise exception 'BUSINESS_TASK_DEPENDENT_COMPLETED';end if;
 end if;
 return new;
end $$;
create trigger business_project_task_guard before insert or update on public.business_project_tasks for each row execute function public.business_project_task_guard();

create function public.business_project_task_workspace(p_hash text,p_slug text,p_project_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;projects jsonb;tasks jsonb;staff jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if p_project_id is not null then
  if not exists(select 1 from public.business_projects p where p.tenant_id=a.tenant_id and p.id=p_project_id and public.business_access_allowed(a.id,'project_tasks','read',to_jsonb(p)||jsonb_build_object('project_id',p.id))) then raise exception 'BUSINESS_FORBIDDEN';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'name',p.name) order by p.code),'[]'::jsonb) into projects
 from public.business_projects p where p.tenant_id=a.tenant_id and p.status='active' and public.business_access_allowed(a.id,'project_tasks','read',to_jsonb(p)||jsonb_build_object('project_id',p.id));
 select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('project_name',p.name,'assignee_name',s.name,'dependencies',coalesce(d.ids,'[]'::jsonb)) order by t.due_on,t.priority desc,t.code),'[]'::jsonb) into tasks
 from public.business_project_tasks t join public.business_projects p on p.tenant_id=t.tenant_id and p.id=t.project_id join public.business_staff s on s.tenant_id=t.tenant_id and s.id=t.assigned_staff_id
 left join lateral(select jsonb_agg(jsonb_build_object('id',x.predecessor_id,'required',x.required_for_completion) order by x.predecessor_id) ids from public.business_project_task_dependencies x where x.tenant_id=t.tenant_id and x.task_id=t.id) d on true
 where t.tenant_id=a.tenant_id and t.status='active' and (p_project_id is null or t.project_id=p_project_id) and public.business_access_allowed(a.id,'project_tasks','read',to_jsonb(t));
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'code',s.code,'name',s.name,'department',s.department) order by s.name,s.id),'[]'::jsonb) into staff
 from public.business_staff s where s.tenant_id=a.tenant_id and s.status='active' and public.business_access_allowed(a.id,'staff','read',to_jsonb(s));
 return jsonb_build_object('projects',projects,'tasks',tasks,'staff',staff);
end $$;

create function public.business_project_task_save(p_hash text,p_slug text,p_request_id uuid,p_task_id uuid,p_expected_version integer,p_data jsonb,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.business_accounts%rowtype;v_existing public.business_project_tasks%rowtype;v_project public.business_projects%rowtype;v_task_id uuid;v_project_id uuid;v_wbs_id uuid;v_staff_id uuid;v_code text;v_name text;v_notes text;v_starts date;v_due date;v_priority text;v_task_state text;v_progress integer;v_checklist jsonb;v_dependencies jsonb;v_result jsonb;v_dependency jsonb;v_dep_id uuid;v_dep_required boolean;v_has_cycle boolean;
begin
 v_actor:=public.business_assert_session(p_hash,p_slug,true);
 v_result:=public.business_command_replay(p_request_id,v_actor.tenant_id,v_actor.id,'project.task',p_payload_hash);if v_result is not null then return v_result;end if;
 if p_request_id is null or p_data is null or jsonb_typeof(p_data)<>'object' or p_expected_version is null or p_expected_version<0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 v_project_id:=(p_data->>'project_id')::uuid;v_staff_id:=(p_data->>'assigned_staff_id')::uuid;v_wbs_id:=nullif(p_data->>'wbs_id','')::uuid;
 v_code:=nullif(btrim(p_data->>'code'),'');v_name:=nullif(btrim(p_data->>'name'),'');v_notes:=coalesce(p_data->>'notes','');v_starts:=(p_data->>'planned_start_on')::date;v_due:=(p_data->>'due_on')::date;
 v_priority:=coalesce(p_data->>'priority','normal');v_task_state:=coalesce(p_data->>'task_state','pending');v_progress:=coalesce((p_data->>'progress_percent')::integer,0);v_checklist:=coalesce(p_data->'checklist','[]'::jsonb);v_dependencies:=coalesce(p_data->'dependencies','[]'::jsonb);
 if v_project_id is null or v_staff_id is null or v_code is null or char_length(v_code) not between 1 and 50 or v_name is null or char_length(v_name) not between 2 and 180 or char_length(v_notes)>2000 or v_starts is null or v_due<v_starts or v_priority not in ('low','normal','high','urgent') or v_task_state not in ('pending','in_progress','awaiting_acceptance','completed','cancelled') or v_progress not between 0 and 100 or jsonb_typeof(v_checklist)<>'array' or jsonb_array_length(v_checklist)>100 or jsonb_typeof(v_dependencies)<>'array' or jsonb_array_length(v_dependencies)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from jsonb_array_elements(v_checklist) as elem(item) where coalesce(item->>'id','') !~* '^[0-9a-f-]{36}$' or char_length(coalesce(item->>'label','')) not between 1 and 300 or coalesce(item->>'required','') not in ('true','false') or coalesce(item->>'done','') not in ('true','false')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select p.* into v_project from public.business_projects p where p.tenant_id=v_actor.tenant_id and p.id=v_project_id and p.status='active' for share;
 if not found or not public.business_access_allowed(v_actor.id,'project_tasks',case when p_task_id is null then 'create' else 'update' end,to_jsonb(v_project)||jsonb_build_object('project_id',v_project.id,'created_by',v_actor.id)) then raise exception 'BUSINESS_FORBIDDEN';end if;
 if not exists(select 1 from public.business_staff s where s.tenant_id=v_actor.tenant_id and s.id=v_staff_id and s.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if v_wbs_id is not null and not exists(select 1 from public.business_project_wbs w where w.tenant_id=v_actor.tenant_id and w.id=v_wbs_id and w.project_id=v_project_id) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if v_task_state='completed' and (v_progress<>100 or exists(select 1 from jsonb_array_elements(v_checklist) as elem(item) where item->>'required'='true' and item->>'done'<>'true')) then raise exception 'BUSINESS_TASK_CHECKLIST_REQUIRED';end if;
 if p_task_id is null then
  if p_expected_version<>0 then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  v_task_id:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  insert into public.business_project_tasks(id,tenant_id,code,name,notes,created_by,project_id,wbs_id,assigned_staff_id,planned_start_on,due_on,priority,task_state,progress_percent,checklist)
  values(v_task_id,v_actor.tenant_id,v_code,v_name,v_notes,v_actor.id,v_project_id,v_wbs_id,v_staff_id,v_starts,v_due,v_priority,v_task_state,v_progress,v_checklist);
 else
  select t.* into v_existing from public.business_project_tasks t where t.tenant_id=v_actor.tenant_id and t.id=p_task_id for update;
  if not found or v_existing.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  if v_existing.project_id<>v_project_id then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  v_task_id:=p_task_id;
  update public.business_project_tasks t set code=v_code,name=v_name,notes=v_notes,wbs_id=v_wbs_id,assigned_staff_id=v_staff_id,planned_start_on=v_starts,due_on=v_due,priority=v_priority,task_state=v_task_state,progress_percent=v_progress,checklist=v_checklist,row_version=t.row_version+1,updated_at=now() where t.tenant_id=v_actor.tenant_id and t.id=v_task_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(v_actor.tenant_id::text||':'||v_project_id::text,0));
 delete from public.business_project_task_dependencies d where d.tenant_id=v_actor.tenant_id and d.task_id=v_task_id;
 for v_dependency in select value from jsonb_array_elements(v_dependencies) loop
  v_dep_id:=(v_dependency->>'id')::uuid;v_dep_required:=coalesce((v_dependency->>'required')::boolean,true);
  if v_dep_id=v_task_id or not exists(select 1 from public.business_project_tasks t where t.tenant_id=v_actor.tenant_id and t.id=v_dep_id and t.project_id=v_project_id and t.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  with recursive chain(id) as(select v_dep_id union select d.predecessor_id from public.business_project_task_dependencies d join chain c on d.task_id=c.id where d.tenant_id=v_actor.tenant_id) select exists(select 1 from chain where id=v_task_id) into v_has_cycle;
  if v_has_cycle then raise exception 'BUSINESS_TASK_DEPENDENCY_CYCLE';end if;
  insert into public.business_project_task_dependencies(tenant_id,task_id,predecessor_id,required_for_completion) values(v_actor.tenant_id,v_task_id,v_dep_id,v_dep_required);
 end loop;
 if v_task_state='completed' and exists(select 1 from public.business_project_task_dependencies d join public.business_project_tasks p on p.tenant_id=d.tenant_id and p.id=d.predecessor_id where d.tenant_id=v_actor.tenant_id and d.task_id=v_task_id and d.required_for_completion and p.task_state<>'completed') then raise exception 'BUSINESS_TASK_PREREQUISITE_REQUIRED';end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(v_actor.tenant_id,v_actor.id,case when p_task_id is null then 'project.task.create' else 'project.task.update' end,'project_tasks',v_task_id,jsonb_build_object('projectId',v_project_id,'taskCode',v_code,'taskState',v_task_state,'progress',v_progress));
 v_result:=jsonb_build_object('id',v_task_id,'rowVersion',case when p_task_id is null then 1 else p_expected_version+1 end);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,v_actor.tenant_id,v_actor.id,'project.task',p_payload_hash,v_result);return v_result;
end $$;

revoke all on function public.business_project_task_workspace(text,text,uuid),public.business_project_task_save(text,text,uuid,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.business_project_task_workspace(text,text,uuid),public.business_project_task_save(text,text,uuid,uuid,integer,jsonb,text) to service_role;
