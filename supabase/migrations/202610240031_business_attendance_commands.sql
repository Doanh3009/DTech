create function public.business_assert_attendance_open(p_tenant uuid,p_staff uuid,p_day date,p_project uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.business_attendance_locks l join public.business_staff s on s.tenant_id=l.tenant_id and s.id=p_staff where l.tenant_id=p_tenant and l.status='posted' and p_day between l.starts_on and l.ends_on and (coalesce(l.department,'')='' or l.department=s.department) and (l.project_id is null or l.project_id=p_project or p_project is null and exists(select 1 from public.business_shift_assignments where tenant_id=p_tenant and staff_id=p_staff and work_date=p_day and project_id=l.project_id and status='posted'))) then raise exception 'BUSINESS_ATTENDANCE_LOCKED';end if;
end $$;
revoke all on function public.business_assert_attendance_open(uuid,uuid,date,uuid) from public,anon,authenticated,service_role;

create function public.business_attendance_validate(p_tenant uuid,p_kind text,p_id uuid,v jsonb,old jsonb) returns void language plpgsql security definer set search_path='' as $$
declare minutes numeric;k text;parent public.business_leave_requests%rowtype;
begin
 if p_kind='shifts' then
  minutes:=extract(epoch from ((v->>'ends_time')::time-(v->>'starts_time')::time))/60+case v->>'cross_midnight' when 'yes' then 1440 else 0 end-(v->>'break_minutes')::numeric;
  if minutes<=0 or minutes>1440 then raise exception 'BUSINESS_INVALID_DATE';end if;
  if exists(select 1 from public.business_shift_assignments where tenant_id=p_tenant and shift_id=p_id and status='posted') then for k in select jsonb_object_keys(v) loop if k not in ('name','notes') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;end if;
 elsif p_kind='leave_entitlements' then
  if (v->>'starts_on')::date>(v->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if exists(select 1 from public.business_leave_entitlements where tenant_id=p_tenant and staff_id=(v->>'staff_id')::uuid and id<>p_id and status='active' and starts_on<=(v->>'ends_on')::date and ends_on>=(v->>'starts_on')::date) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
  if exists(select 1 from public.business_leave_requests where tenant_id=p_tenant and entitlement_id=p_id and status='posted') then for k in select jsonb_object_keys(v) loop if k not in ('name','notes') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;end if;
 elsif p_kind='leave_request_lines' then
  select * into parent from public.business_leave_requests where tenant_id=p_tenant and id=(v->>'request_id')::uuid and status='draft';if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  perform public.business_assert_attendance_open(p_tenant,parent.staff_id,(v->>'work_date')::date,null);
 end if;
end $$;
revoke all on function public.business_attendance_validate(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_attendance_store(p_tenant uuid,p_kind text,v jsonb,c jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind='shift_assignments' then update public.business_shift_assignments set work_date=(c->'context'->>'workDate')::date,starts_at=c->'context'->>'startsAt',ends_at=c->'context'->>'endsAt',regular_hours=(c->'context'->>'regularHours')::numeric where tenant_id=p_tenant and id=(v->>'id')::uuid;
 elsif p_kind='leave_requests' then update public.business_leave_requests set total_hours=(c->>'totalHours')::numeric where tenant_id=p_tenant and id=(v->>'id')::uuid;
 elsif p_kind='attendance_confirmations' then update public.business_attendance_confirmations set worked_hours=(c->'context'->>'regularHours')::numeric,overtime_hours=(c->'context'->>'overtimeHours')::numeric where tenant_id=p_tenant and id=(v->>'id')::uuid;
 end if;
end $$;
revoke all on function public.business_attendance_store(uuid,text,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_attendance_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare assignment public.business_shift_assignments%rowtype;person uuid;day_on date;card uuid;hours numeric;
begin
 if p_action='reverse' then
  case p_kind
  when 'shift_assignments' then
   if exists(select 1 from public.business_attendance_confirmations where tenant_id=p_tenant and assignment_id=(v->>'id')::uuid and status='posted') or exists(select 1 from public.business_overtime_requests where tenant_id=p_tenant and assignment_id=(v->>'id')::uuid and status='posted') or exists(select 1 from public.business_leave_request_lines l join public.business_leave_requests h on h.tenant_id=l.tenant_id and h.id=l.request_id and h.status='posted' where l.tenant_id=p_tenant and h.staff_id=(v->>'staff_id')::uuid and l.work_date=(v->>'work_date')::date and l.status='active') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   perform public.business_assert_attendance_open(p_tenant,(v->>'staff_id')::uuid,(v->>'work_date')::date,(v->>'project_id')::uuid);
  when 'overtime_requests' then
   select coalesce(sum(overtime_hours),0) into hours from public.business_attendance_confirmations where tenant_id=p_tenant and assignment_id=(v->>'assignment_id')::uuid and status='posted';
   if hours>(select coalesce(sum(r.hours),0) from public.business_overtime_requests r where r.tenant_id=p_tenant and r.assignment_id=(v->>'assignment_id')::uuid and r.status='posted' and r.id<>(v->>'id')::uuid) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'leave_requests' then
   for day_on in select work_date from public.business_leave_request_lines where tenant_id=p_tenant and request_id=(v->>'id')::uuid and status='active' loop
    perform public.business_assert_attendance_open(p_tenant,(v->>'staff_id')::uuid,day_on,null);
    if exists(select 1 from public.business_salary_runs r join public.business_salary_lines l on l.tenant_id=r.tenant_id and l.salary_run_id=r.id where r.tenant_id=p_tenant and r.status='posted' and l.staff_id=(v->>'staff_id')::uuid and day_on between r.starts_on and r.ends_on) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   end loop;
  when 'attendance_confirmations' then update public.business_timecards set status='cancelled',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and confirmation_id=(v->>'id')::uuid and status='posted';
  when 'attendance_locks' then
   if exists(select 1 from public.business_salary_runs where tenant_id=p_tenant and status='posted' and starts_on<=(v->>'ends_on')::date and ends_on>=(v->>'starts_on')::date) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  else raise exception 'BUSINESS_INVALID_INPUT';end case;return '{}';
 end if;
 if p_kind='attendance_confirmations' then
  select * into assignment from public.business_shift_assignments where tenant_id=p_tenant and id=(v->>'assignment_id')::uuid and status='posted';card:=gen_random_uuid();
  perform public.business_assert_attendance_open(p_tenant,assignment.staff_id,assignment.work_date,assignment.project_id);
  insert into public.business_timecards(id,tenant_id,code,name,created_by,status,staff_id,work_date,worked_hours,overtime_hours,project_id,confirmation_id) values(card,p_tenant,'CC-'||(v->>'id'),v->>'name',p_actor,'posted',assignment.staff_id,assignment.work_date,(v->'calculation_snapshot'->'context'->>'regularHours')::numeric,(v->'calculation_snapshot'->'context'->>'overtimeHours')::numeric,assignment.project_id,(v->>'id')::uuid);
  update public.business_attendance_confirmations set timecard_id=card where tenant_id=p_tenant and id=(v->>'id')::uuid;
  insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(p_tenant,p_actor,'attendance.timecard_generated','timecards',card,jsonb_build_object('confirmationId',v->>'id','assignmentId',assignment.id,'reviewedBy',v->>'reviewed_by'));
 elsif p_kind='shift_assignments' then perform public.business_assert_attendance_open(p_tenant,(v->>'staff_id')::uuid,(v->'calculation_snapshot'->'context'->>'workDate')::date,(v->>'project_id')::uuid);
 elsif p_kind not in ('leave_requests','overtime_requests','attendance_locks') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 return '{}';
end $$;
revoke all on function public.business_attendance_effect(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;

create function public.business_guard_attendance() returns trigger language plpgsql security definer set search_path='' as $$
declare used numeric;scheduled numeric;leave_hours numeric;person public.business_staff%rowtype;
begin
 if new.status<>'posted' and (tg_op='INSERT' or old.status<>'posted') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||new.tenant_id,0));
 perform public.business_assert_attendance_open(new.tenant_id,new.staff_id,new.work_date,new.project_id);
 if exists(select 1 from public.business_salary_runs r join public.business_salary_lines l on l.tenant_id=r.tenant_id and l.salary_run_id=r.id where r.tenant_id=new.tenant_id and r.status='posted' and l.staff_id=new.staff_id and new.work_date between r.starts_on and r.ends_on) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status<>'posted' then return new;end if;
 if new.overtime_hours>0 and new.confirmation_id is null then raise exception 'BUSINESS_OVERTIME_APPROVAL_REQUIRED';end if;
 select * into person from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id and status='active';if not found or new.work_date<person.joined_on then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 select coalesce(sum(worked_hours+overtime_hours),0) into used from public.business_timecards where tenant_id=new.tenant_id and staff_id=new.staff_id and work_date=new.work_date and status='posted' and id<>new.id;
 select coalesce(sum(l.hours),0) into leave_hours from public.business_leave_request_lines l join public.business_leave_requests h on h.tenant_id=l.tenant_id and h.id=l.request_id and h.status='posted' where l.tenant_id=new.tenant_id and h.staff_id=new.staff_id and l.work_date=new.work_date and l.status='active';
 if used+new.worked_hours+new.overtime_hours+leave_hours>24 then raise exception 'BUSINESS_ATTENDANCE_EXCEEDED';end if;
 select coalesce(sum(regular_hours),0) into scheduled from public.business_shift_assignments where tenant_id=new.tenant_id and staff_id=new.staff_id and work_date=new.work_date and status='posted';
 if scheduled>0 and leave_hours+new.worked_hours+(select coalesce(sum(worked_hours),0) from public.business_timecards where tenant_id=new.tenant_id and staff_id=new.staff_id and work_date=new.work_date and status='posted' and id<>new.id)>scheduled then raise exception 'BUSINESS_ATTENDANCE_EXCEEDED';end if;
 return new;
end $$;
revoke all on function public.business_guard_attendance() from public,anon,authenticated,service_role;
create trigger business_attendance_guard before insert or update on public.business_timecards for each row execute function public.business_guard_attendance();

do $$ declare body text;anchor text;spec record;begin
 for spec in select * from (values
 ('public.business_operational_calculation(uuid,text,jsonb)','if coalesce((select (definition->>''attendanceDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return public.business_attendance_calculation(p_tenant,p_kind,v);end if;'),
 ('public.business_operational_effect(uuid,uuid,text,jsonb,text)','if coalesce((select (definition->>''attendanceDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return public.business_attendance_effect(p_tenant,p_actor,p_kind,v,p_action);end if;'),
 ('public.business_operational_store(uuid,text,jsonb,jsonb)','if coalesce((select (definition->>''attendanceDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then perform public.business_attendance_store(p_tenant,p_kind,v,c);return;end if;'),
 ('public.business_operational_validate(uuid,text,uuid,jsonb,jsonb)','perform public.business_attendance_validate(p_tenant,p_kind,p_id,v,old);')
 )t(signature,guard) loop select pg_get_functiondef(spec.signature::regprocedure) into body;execute replace(body,E'begin\n',E'begin\n'||spec.guard||E'\n');end loop;
 select pg_get_functiondef('public.business_operational_validate(uuid,text,uuid,jsonb,jsonb)'::regprocedure) into body;
 body:=replace(body,'when ''stock_count_lines'' then ''stock_counts''','when ''stock_count_lines'' then ''stock_counts'' when ''leave_request_lines'' then ''leave_requests''');
 body:=replace(body,'when ''stock_count_lines'' then ''count_id''','when ''stock_count_lines'' then ''count_id'' when ''leave_request_lines'' then ''request_id''');execute body;
 select pg_get_functiondef('public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into body;
 anchor:='if p_action in (''deactivate'',''activate'') and d->>''parentKind'' is not null then';
 if strpos(body,anchor)=0 then raise exception 'Review attendance source commands';end if;
 execute replace(body,anchor,'if p_kind=''timecards'' and p_action=''reverse'' and v->>''confirmation_id'' is not null then raise exception ''BUSINESS_RECORD_LOCKED'';end if;'||anchor);
 select pg_get_functiondef('public.business_record_action_before_misa(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into body;
 anchor:='coalesce(sum(t.worked_hours),0)/(v->>''standard_hours'')::numeric';
 if strpos(body,anchor)=0 then raise exception 'Review paid leave payroll source';end if;
 execute replace(body,anchor,'(coalesce(sum(t.worked_hours),0)+(select coalesce(sum(pl.hours),0) from public.business_leave_request_lines pl join public.business_leave_requests ph on ph.tenant_id=pl.tenant_id and ph.id=pl.request_id and ph.status=''posted'' and ph.leave_type=''paid'' where pl.tenant_id=l.tenant_id and ph.staff_id=l.staff_id and pl.work_date between (v->>''starts_on'')::date and (v->>''ends_on'')::date and pl.status=''active''))/(v->>''standard_hours'')::numeric');
end $$;
