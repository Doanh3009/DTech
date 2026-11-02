create table public.business_project_task_updates(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 task_id uuid not null,
 actor_id uuid not null,
 event_type text not null check(event_type in ('comment','daily_log')),
 body text not null check(char_length(body) between 1 and 2000),
 work_date date,
 shift text check(shift in ('day','night')),
 hours numeric(6,2) check(hours between 0 and 24),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,task_id) references public.business_project_tasks(tenant_id,id),
 foreign key(tenant_id,actor_id) references public.business_accounts(tenant_id,id),
 check((event_type='comment' and work_date is null and shift is null and hours is null) or (event_type='daily_log' and work_date is not null and shift is not null and hours is not null))
);
create index business_project_task_updates_task_idx on public.business_project_task_updates(tenant_id,task_id,created_at desc,id desc);
alter table public.business_project_task_updates enable row level security;
revoke all on public.business_project_task_updates from public,anon,authenticated,service_role;

create function public.business_project_task_updates_workspace(p_hash text,p_slug text,p_task_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;task public.business_project_tasks%rowtype;rows jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 select t.* into task from public.business_project_tasks t where t.tenant_id=a.tenant_id and t.id=p_task_id and t.status='active';
 if not found or not public.business_access_allowed(a.id,'project_tasks','read',to_jsonb(task)) then raise exception 'BUSINESS_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'type',u.event_type,'body',u.body,'workDate',u.work_date,'shift',u.shift,'hours',u.hours,'actor',u.actor,'createdAt',u.created_at) order by u.created_at desc,u.id desc),'[]'::jsonb) into rows
 from (select e.id,e.event_type,e.body,e.work_date,e.shift,e.hours,a2.display_name actor,e.created_at from public.business_project_task_updates e join public.business_accounts a2 on a2.tenant_id=e.tenant_id and a2.id=e.actor_id where e.tenant_id=a.tenant_id and e.task_id=p_task_id order by e.created_at desc,e.id desc limit 500) u;
 return jsonb_build_object('updates',rows);
end $$;

create function public.business_project_task_update_add(p_hash text,p_slug text,p_request_id uuid,p_task_id uuid,p_event_type text,p_body text,p_work_date date,p_shift text,p_hours numeric,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;task public.business_project_tasks%rowtype;r jsonb;update_id uuid;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'project.task.update_event',p_payload_hash);if r is not null then return r;end if;
 if p_request_id is null or p_task_id is null or p_event_type not in ('comment','daily_log') or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 or p_event_type='comment' and (p_work_date is not null or p_shift is not null or p_hours is not null) or p_event_type='daily_log' and (p_work_date is null or p_shift not in ('day','night') or p_hours is null or p_hours not between 0 and 24) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select t.* into task from public.business_project_tasks t where t.tenant_id=a.tenant_id and t.id=p_task_id and t.status='active';
 if not found or not public.business_access_allowed(a.id,'project_tasks','update',to_jsonb(task)) then raise exception 'BUSINESS_FORBIDDEN';end if;
 insert into public.business_project_task_updates(tenant_id,task_id,actor_id,event_type,body,work_date,shift,hours) values(a.tenant_id,p_task_id,a.id,p_event_type,btrim(p_body),p_work_date,p_shift,p_hours) returning id into update_id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'project.task.'||p_event_type,'project_tasks',p_task_id,jsonb_build_object('updateId',update_id,'workDate',p_work_date,'shift',p_shift,'hours',p_hours));
 r:=jsonb_build_object('id',update_id);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'project.task.update_event',p_payload_hash,r);return r;
end $$;

revoke all on function public.business_project_task_updates_workspace(text,text,uuid),public.business_project_task_update_add(text,text,uuid,uuid,text,text,date,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.business_project_task_updates_workspace(text,text,uuid),public.business_project_task_update_add(text,text,uuid,uuid,text,text,date,text,numeric,text) to service_role;
