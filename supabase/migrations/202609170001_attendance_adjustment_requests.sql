alter table public.attendance_events drop constraint if exists attendance_events_source_check;
alter table public.attendance_events add constraint attendance_events_source_check check (source in ('SELF_MOBILE_WEB', 'HR_ADJUSTMENT'));

create table if not exists public.attendance_adjustment_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  account_id uuid not null references public.app_accounts(id) on delete restrict,
  attendance_date date not null,
  request_type text not null check (request_type in ('missing_check_in', 'missing_check_out')),
  requested_time time not null,
  reason text not null check (length(trim(reason)) between 5 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_account_id uuid references public.app_accounts(id),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists attendance_adjustment_requests_one_pending_idx
  on public.attendance_adjustment_requests(employee_id, attendance_date, request_type) where status='pending';
create index if not exists attendance_adjustment_requests_employee_idx
  on public.attendance_adjustment_requests(employee_id, created_at desc);
create index if not exists attendance_adjustment_requests_status_idx
  on public.attendance_adjustment_requests(status, created_at desc);
alter table public.attendance_adjustment_requests enable row level security;

create or replace function public.review_attendance_adjustment_request(
  p_request_id uuid, p_reviewer_id uuid, p_approve boolean, p_note text
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_request public.attendance_adjustment_requests%rowtype;
  v_counterpart public.attendance_events%rowtype;
  v_effective timestamptz;
  v_event_type public.attendance_event_type;
  v_event_id uuid;
begin
  select * into v_request from public.attendance_adjustment_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then raise exception 'REQUEST_ALREADY_REVIEWED'; end if;
  if p_reviewer_id is null or not exists(select 1 from public.app_accounts where id=p_reviewer_id and status='active') then
    raise exception 'REVIEWER_NOT_FOUND';
  end if;
  if p_approve then
    v_effective := (v_request.attendance_date::text || ' ' || v_request.requested_time::text)::timestamp at time zone 'Asia/Ho_Chi_Minh';
    v_event_type := case when v_request.request_type='missing_check_in' then 'check_in'::public.attendance_event_type else 'check_out'::public.attendance_event_type end;
    select * into v_counterpart from public.attendance_events
      where employee_id=v_request.employee_id and attendance_date=v_request.attendance_date and event_type<>v_event_type
      limit 1;
    if not found then raise exception 'COUNTERPART_MISSING'; end if;
    if (v_event_type='check_in' and v_effective>=v_counterpart.effective_at)
       or (v_event_type='check_out' and v_effective<=v_counterpart.effective_at) then
      raise exception 'TIME_ORDER_INVALID';
    end if;
    insert into public.attendance_events (
      client_event_id, employee_id, account_id, event_type, attendance_date, effective_at,
      captured_at_client, synced_at, geofence_status, attendance_status, photo_status,
      sync_status, source, device_metadata
    ) values (
      gen_random_uuid(), v_request.employee_id, v_request.account_id, v_event_type,
      v_request.attendance_date, v_effective, v_effective, now(), 'not_required', 'recorded',
      'not_required', 'synced', 'HR_ADJUSTMENT', jsonb_build_object('adjustment_request_id', v_request.id, 'reviewer_account_id', p_reviewer_id)
    ) returning id into v_event_id;
  end if;
  update public.attendance_adjustment_requests set
    status=case when p_approve then 'approved' else 'rejected' end,
    reviewer_account_id=p_reviewer_id, review_note=nullif(trim(p_note),''), reviewed_at=now(), updated_at=now()
  where id=p_request_id;
  return v_event_id;
end $$;
revoke all on function public.review_attendance_adjustment_request(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.review_attendance_adjustment_request(uuid,uuid,boolean,text) to service_role;

insert into public.permissions(key,module,description) values
  ('attendance.self_history','attendance','Xem lịch công cá nhân'),
  ('attendance.self_request','attendance','Gửi yêu cầu điều chỉnh công cá nhân'),
  ('attendance.period.manage','attendance','Quản lý kỳ công')
on conflict(key) do nothing;

insert into public.role_permissions(role_id,permission_key)
select distinct rp.role_id,'attendance.self_history' from public.role_permissions rp
where rp.permission_key in ('attendance.self','attendance.self.view')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_key)
select distinct rp.role_id,'attendance.self_request' from public.role_permissions rp
where rp.permission_key in ('attendance.self','attendance.self.create')
on conflict do nothing;
insert into public.role_permissions(role_id,permission_key)
select distinct rp.role_id,'attendance.period.manage' from public.role_permissions rp
where rp.permission_key='timesheet.lock'
on conflict do nothing;

insert into public.notification_templates(event_key,title_template,message_template,allowed_placeholders,mandatory)
values('attendance.adjustment_reviewed','Yêu cầu điều chỉnh công','Yêu cầu ngày {{date}} đã {{status}}.',array['date','status'],true)
on conflict(event_key) do nothing;
