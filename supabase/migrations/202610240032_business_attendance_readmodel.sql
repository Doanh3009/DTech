create function public.business_people_workspace(p_hash text,p_slug text,p_from date,p_to date,p_page integer default 1) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;totals jsonb;total bigint;pending bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,'staff');perform public.business_assert_report_access(a.id,array['people']);
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 or p_page is null or p_page not between 1 and 100000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 with staff_rows as (
  select s.id,s.code,s.name,s.department,
   (select coalesce(sum(regular_hours),0) from public.business_shift_assignments where tenant_id=s.tenant_id and staff_id=s.id and status='posted' and work_date between p_from and p_to) scheduled_hours,
   (select coalesce(sum(worked_hours),0) from public.business_timecards where tenant_id=s.tenant_id and staff_id=s.id and status='posted' and work_date between p_from and p_to) worked_hours,
   (select coalesce(sum(overtime_hours),0) from public.business_timecards where tenant_id=s.tenant_id and staff_id=s.id and status='posted' and work_date between p_from and p_to) overtime_hours,
   (select coalesce(sum(l.hours),0) from public.business_leave_request_lines l join public.business_leave_requests h on h.tenant_id=l.tenant_id and h.id=l.request_id and h.status='posted' and h.leave_type='paid' where l.tenant_id=s.tenant_id and h.staff_id=s.id and l.status='active' and l.work_date between p_from and p_to) paid_leave_hours,
   (select coalesce(sum(l.hours),0) from public.business_leave_request_lines l join public.business_leave_requests h on h.tenant_id=l.tenant_id and h.id=l.request_id and h.status='posted' and h.leave_type='unpaid' where l.tenant_id=s.tenant_id and h.staff_id=s.id and l.status='active' and l.work_date between p_from and p_to) unpaid_leave_hours,
   (select coalesce(sum(greatest(0,e.allowed_hours+e.carry_hours-(select coalesce(sum(total_hours),0) from public.business_leave_requests where tenant_id=e.tenant_id and entitlement_id=e.id and status='posted' and leave_type='paid'))),0) from public.business_leave_entitlements e where e.tenant_id=s.tenant_id and e.staff_id=s.id and e.status='active' and (now() at time zone 'Asia/Ho_Chi_Minh')::date between e.starts_on and e.ends_on) available_leave_hours,
   exists(select 1 from public.business_attendance_locks l where l.tenant_id=s.tenant_id and l.status='posted' and l.starts_on<=p_to and l.ends_on>=p_from and (coalesce(l.department,'')='' or l.department=s.department) and (l.project_id is null or exists(select 1 from public.business_shift_assignments where tenant_id=s.tenant_id and staff_id=s.id and project_id=l.project_id and status='posted' and work_date between greatest(p_from,l.starts_on) and least(p_to,l.ends_on)))) has_locked_days
  from public.business_staff s where s.tenant_id=a.tenant_id and s.status='active'
 ) select count(*),jsonb_build_object('staff',count(*),'scheduled',coalesce(sum(scheduled_hours),0),'worked',coalesce(sum(worked_hours),0),'overtime',coalesce(sum(overtime_hours),0),'paidLeave',coalesce(sum(paid_leave_hours),0),'unpaidLeave',coalesce(sum(unpaid_leave_hours),0)),coalesce((select jsonb_agg(to_jsonb(x)) from(select * from staff_rows order by department,name,id limit 25 offset (p_page-1)*25)x),'[]') into total,totals,rows from staff_rows;
 select (select count(*) from public.business_shift_assignments where tenant_id=a.tenant_id and status='draft' and starts_on between p_from and p_to)+(select count(*) from public.business_overtime_requests where tenant_id=a.tenant_id and status='draft' and work_date between p_from and p_to)+(select count(*) from public.business_attendance_confirmations c join public.business_shift_assignments s on s.tenant_id=c.tenant_id and s.id=c.assignment_id where c.tenant_id=a.tenant_id and c.status='draft' and s.work_date between p_from and p_to)+(select count(distinct h.id) from public.business_leave_requests h join public.business_leave_request_lines l on l.tenant_id=h.tenant_id and l.request_id=h.id where h.tenant_id=a.tenant_id and h.status='draft' and l.status='active' and l.work_date between p_from and p_to) into pending;
 return jsonb_build_object('rows',rows,'total',total,'totals',totals||jsonb_build_object('pending',pending),'from',p_from,'to',p_to,'page',p_page,'pageSize',25);
end $$;
revoke all on function public.business_people_workspace(text,text,date,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_people_workspace(text,text,date,date,integer) to service_role;

create function public.business_scope_department(p_tenant uuid,p_kind text,v jsonb,p_depth integer default 0) returns text language plpgsql stable security definer set search_path='' as $$
declare d jsonb;parent jsonb;department_name text;
begin
 if v->>'department' is not null then return v->>'department';end if;
 if v->>'staff_id' is not null then select department into department_name from public.business_staff where tenant_id=p_tenant and id=(v->>'staff_id')::uuid;return department_name;end if;
 if p_depth>=4 then return null;end if;
 select definition into d from public.business_entity_definitions where kind=p_kind;if d->>'parentKind' is null or v->>(d->>'parentField') is null then return null;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using p_tenant,(v->>(d->>'parentField'))::uuid;
 return public.business_scope_department(p_tenant,d->>'parentKind',parent,p_depth+1);
end $$;
revoke all on function public.business_scope_department(uuid,text,jsonb,integer) from public,anon,authenticated,service_role;
do $$ declare body text;begin select pg_get_functiondef('public.business_access_allowed(uuid,text,text,jsonb)'::regprocedure) into body;execute replace(body,'department_name:=v->>''department'';','department_name:=public.business_scope_department(a.tenant_id,p_kind,v);');end $$;
