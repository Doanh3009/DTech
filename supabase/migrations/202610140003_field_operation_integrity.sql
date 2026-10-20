-- Keep worker attendance parent/entries/history and shipment header/lines atomic.
-- No existing attendance, shipment or stock ledger is rewritten.

create or replace function public.field_actor_can(p_actor_id uuid,p_permissions text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from app_accounts a join account_roles ar on ar.account_id=a.id
    join role_permissions rp on rp.role_id=ar.role_id
    where a.id=p_actor_id and a.status='active' and rp.permission_key=any(p_permissions))
$$;

create or replace function public.assert_worker_session_actor(p_session_id uuid,p_actor_id uuid,p_permissions text[])
returns void language plpgsql security definer set search_path=public as $$
declare v_session worker_attendance_sessions%rowtype;v_employee_id uuid;
begin
  if not field_actor_can(p_actor_id,p_permissions) then raise exception 'FIELD_ACTOR_DENIED';end if;
  select employee_id into v_employee_id from app_accounts where id=p_actor_id and status='active';
  if v_employee_id is null then raise exception 'FIELD_ACTOR_DENIED';end if;
  select * into v_session from worker_attendance_sessions where id=p_session_id;
  if not found then raise exception 'FIELD_SESSION_NOT_FOUND';end if;
  if not field_actor_can(p_actor_id,array['worker_attendance.view_all']) and not exists(
    select 1 from project_assignments where project_id=v_session.project_id and worksite_id=v_session.worksite_id
      and employee_id=v_employee_id and assignment_role in ('supervisor_main','supervisor_replacement','project_manager')
      and status='active' and start_date<=v_session.attendance_date and (end_date is null or end_date>=v_session.attendance_date)
  ) then raise exception 'FIELD_ACTOR_DENIED';end if;
end $$;

create or replace function public.save_worker_session_draft_command(
  p_session_id uuid,p_expected_version integer,p_actor_id uuid,p_header jsonb,p_entries jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_session worker_attendance_sessions%rowtype;v_entry jsonb;v_response jsonb;
begin
  select * into v_session from worker_attendance_sessions where id=p_session_id for update;
  if not found then raise exception 'FIELD_SESSION_NOT_FOUND';end if;
  perform assert_worker_session_actor(p_session_id,p_actor_id,array['worker_attendance.create']);
  if p_expected_version is null or v_session.version<>p_expected_version then raise exception 'FIELD_VERSION_CONFLICT';end if;
  if v_session.status in ('submitted','locked') then raise exception 'FIELD_SESSION_NOT_EDITABLE';end if;
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>500
    or p_header is null or jsonb_typeof(p_header)<>'object'
    or jsonb_typeof(p_header->'checklist_responses') is distinct from 'array'
    or jsonb_array_length(p_header->'checklist_responses')>100 then raise exception 'FIELD_INPUT_INVALID';end if;
  if (select count(*) from jsonb_array_elements(p_entries))<>(select count(distinct entry->>'id') from jsonb_array_elements(p_entries) entry) then raise exception 'FIELD_ENTRY_INVALID';end if;
  for v_response in select value from jsonb_array_elements(p_header->'checklist_responses') loop
    if not exists(select 1 from jsonb_array_elements(coalesce(v_session.checklist_snapshot,'[]'::jsonb)) item where item->>'id'=v_response->>'itemId') then raise exception 'FIELD_CHECKLIST_INVALID';end if;
  end loop;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    perform 1 from worker_attendance_entries where id=(v_entry->>'id')::uuid and session_id=p_session_id for update;
    if not found then raise exception 'FIELD_ENTRY_INVALID';end if;
    update worker_attendance_entries set status=(v_entry->>'status')::worker_attendance_entry_status,
      exception_reason=nullif(v_entry->>'exceptionReason','')::worker_exception_reason,
      day_exception=coalesce(v_entry->>'dayException','none')::worker_day_exception,
      exception_time=nullif(v_entry->>'exceptionTime','')::time,note=v_entry->>'note'
    where id=(v_entry->>'id')::uuid and session_id=p_session_id;
  end loop;
  update worker_attendance_sessions set work_note=p_header->>'work_note',note=p_header->>'note',
    checklist_responses=p_header->'checklist_responses',status='in_progress',sync_status='synced',
    latitude=case when p_header?'latitude' then (p_header->>'latitude')::double precision else latitude end,
    longitude=case when p_header?'longitude' then (p_header->>'longitude')::double precision else longitude end,
    accuracy_meters=case when p_header?'accuracy_meters' then (p_header->>'accuracy_meters')::double precision else accuracy_meters end,
    geofence_status=case when p_header?'geofence_status' then p_header->>'geofence_status' else geofence_status end,
    distance_meters=case when p_header?'distance_meters' then (p_header->>'distance_meters')::double precision else distance_meters end
  where id=p_session_id;
  return p_session_id;
end $$;

create or replace function public.close_worker_session_day_command(
  p_session_id uuid,p_expected_version integer,p_actor_id uuid,p_entries jsonb,p_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_session worker_attendance_sessions%rowtype;v_before worker_attendance_entries%rowtype;v_entry jsonb;v_exception worker_day_exception;v_time time;
begin
  select * into v_session from worker_attendance_sessions where id=p_session_id for update;
  if not found then raise exception 'FIELD_SESSION_NOT_FOUND';end if;
  perform assert_worker_session_actor(p_session_id,p_actor_id,array['worker_attendance.create','worker_attendance.adjust']);
  if v_session.submitted_at is null then raise exception 'FIELD_SESSION_NOT_SUBMITTED';end if;
  if p_entries is null or jsonb_typeof(p_entries)<>'array' or jsonb_array_length(p_entries)>500
    or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'FIELD_INPUT_INVALID';end if;
  if (select count(*) from jsonb_array_elements(p_entries))<>(select count(distinct entry->>'id') from jsonb_array_elements(p_entries) entry) then raise exception 'FIELD_ENTRY_INVALID';end if;
  if v_session.day_closed_at is not null then
    for v_entry in select value from jsonb_array_elements(p_entries) loop
      if not exists(select 1 from worker_attendance_entries where id=(v_entry->>'id')::uuid and session_id=p_session_id
        and day_exception=(v_entry->>'dayException')::worker_day_exception and exception_time is not distinct from nullif(v_entry->>'exceptionTime','')::time) then raise exception 'FIELD_CLOSED_REPLAY_CONFLICT';end if;
    end loop;
    return p_session_id;
  end if;
  if p_expected_version is null or v_session.version<>p_expected_version then raise exception 'FIELD_VERSION_CONFLICT';end if;
  for v_entry in select value from jsonb_array_elements(p_entries) loop
    select * into v_before from worker_attendance_entries where id=(v_entry->>'id')::uuid and session_id=p_session_id for update;
    if not found then raise exception 'FIELD_ENTRY_INVALID';end if;
    v_exception:=(v_entry->>'dayException')::worker_day_exception;v_time:=nullif(v_entry->>'exceptionTime','')::time;
    if v_before.day_exception is not distinct from v_exception and v_before.exception_time is not distinct from v_time then continue;end if;
    update worker_attendance_entries set day_exception=v_exception,exception_time=v_time where id=v_before.id;
    insert into worker_attendance_adjustments(session_id,entry_id,actor_account_id,reason,before_data,after_data)
    values(p_session_id,v_before.id,p_actor_id,p_reason,jsonb_build_object('dayException',v_before.day_exception,'exceptionTime',case when v_before.exception_time is null then null else left(v_before.exception_time::text,5) end),jsonb_build_object('dayException',v_exception,'exceptionTime',case when v_time is null then null else left(v_time::text,5) end));
  end loop;
  update worker_attendance_sessions set day_closed_at=now(),day_closed_by=p_actor_id where id=p_session_id;
  return p_session_id;
end $$;

create or replace function public.adjust_worker_entry_command(
  p_session_id uuid,p_expected_version integer,p_actor_id uuid,p_entry_id uuid,p_status text,p_reason text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_session worker_attendance_sessions%rowtype;v_entry worker_attendance_entries%rowtype;
begin
  select * into v_session from worker_attendance_sessions where id=p_session_id for update;
  if not found then raise exception 'FIELD_SESSION_NOT_FOUND';end if;
  perform assert_worker_session_actor(p_session_id,p_actor_id,array['worker_attendance.adjust']);
  if p_expected_version is null or v_session.version<>p_expected_version then raise exception 'FIELD_VERSION_CONFLICT';end if;
  if coalesce(p_status,'') not in ('present','absent','leave','late','transferred') or length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'FIELD_INPUT_INVALID';end if;
  select * into v_entry from worker_attendance_entries where id=p_entry_id and session_id=p_session_id for update;
  if not found then raise exception 'FIELD_ENTRY_INVALID';end if;
  update worker_attendance_entries set status=p_status::worker_attendance_entry_status where id=p_entry_id;
  insert into worker_attendance_adjustments(session_id,entry_id,actor_account_id,reason,before_data,after_data)
  values(p_session_id,p_entry_id,p_actor_id,p_reason,jsonb_build_object('status',v_entry.status),jsonb_build_object('status',p_status));
  update worker_attendance_sessions set status='needs_review' where id=p_session_id;
  return p_session_id;
end $$;

create or replace function public.save_shipment_command(
  p_shipment_id uuid,p_row_version integer,p_actor_id uuid,p_header jsonb,p_lines jsonb,p_quantity_change_reason text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_shipment shipments%rowtype;v_line jsonb;v_existing shipment_lines%rowtype;v_changed_quantity boolean:=false;v_count integer;
begin
  if not field_actor_can(p_actor_id,array['shipment.edit']) then raise exception 'FIELD_ACTOR_DENIED';end if;
  -- Receipt posting already uses this key when validating over-receipt limits.
  perform pg_advisory_xact_lock(hashtextextended('shipment:'||p_shipment_id::text,0));
  select * into v_shipment from shipments where id=p_shipment_id for update;
  if not found then raise exception 'FIELD_SHIPMENT_NOT_FOUND';end if;
  if not field_actor_can(p_actor_id,array['import_export.view_all']) and v_shipment.created_by is distinct from p_actor_id and v_shipment.assigned_account_id is distinct from p_actor_id then raise exception 'FIELD_ACTOR_DENIED';end if;
  if p_row_version is null or v_shipment.row_version<>p_row_version then raise exception 'FIELD_VERSION_CONFLICT';end if;
  if v_shipment.status in ('completed','cancelled') then raise exception 'FIELD_SHIPMENT_CLOSED';end if;
  if p_header is null or jsonb_typeof(p_header)<>'object' or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 200 then raise exception 'FIELD_INPUT_INVALID';end if;
  select count(*) into v_count from shipment_lines where shipment_id=p_shipment_id;
  if v_count<>jsonb_array_length(p_lines) or v_count<>(select count(distinct line->>'id') from jsonb_array_elements(p_lines) line) then raise exception 'FIELD_SHIPMENT_LINE_INVALID';end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    select * into v_existing from shipment_lines where id=(v_line->>'id')::uuid and shipment_id=p_shipment_id for update;
    if not found then raise exception 'FIELD_SHIPMENT_LINE_INVALID';end if;
    if v_existing.item_id is distinct from (v_line->>'item_id')::uuid or v_existing.uom_id is distinct from (v_line->>'uom_id')::uuid or v_existing.contract_line_id is distinct from nullif(v_line->>'contract_line_id','')::uuid then raise exception 'FIELD_SHIPMENT_LINE_IDENTITY_CHANGED';end if;
    if v_existing.expected_quantity is distinct from (v_line->>'expected_quantity')::numeric then v_changed_quantity:=true;end if;
  end loop;
  if v_changed_quantity and exists(select 1 from inventory_documents d join inventory_document_lines l on l.document_id=d.id where d.type='receipt' and d.status='posted' and l.shipment_line_id in (select id from shipment_lines where shipment_id=p_shipment_id)) and length(trim(coalesce(p_quantity_change_reason,'')))=0 then raise exception 'FIELD_SHIPMENT_QUANTITY_REASON_REQUIRED';end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    update shipment_lines set expected_quantity=(v_line->>'expected_quantity')::numeric,package_count=nullif(v_line->>'package_count','')::int,
      gross_weight=nullif(v_line->>'gross_weight','')::numeric,net_weight=nullif(v_line->>'net_weight','')::numeric,volume=nullif(v_line->>'volume','')::numeric,
      marks_numbers=v_line->>'marks_numbers',note=v_line->>'note',row_version=row_version+1
    where id=(v_line->>'id')::uuid and shipment_id=p_shipment_id;
  end loop;
  update shipments set contract_id=nullif(p_header->>'contract_id','')::uuid,supplier_id=(p_header->>'supplier_id')::uuid,
    carrier_id=nullif(p_header->>'carrier_id','')::uuid,forwarder_id=nullif(p_header->>'forwarder_id','')::uuid,assigned_account_id=nullif(p_header->>'assigned_account_id','')::uuid,
    transport_mode=p_header->>'transport_mode',shipment_type=p_header->>'shipment_type',origin=p_header->>'origin',destination=p_header->>'destination',
    port_of_loading=p_header->>'port_of_loading',port_of_discharge=p_header->>'port_of_discharge',booking_number=p_header->>'booking_number',bill_of_lading_number=p_header->>'bill_of_lading_number',
    forwarder_reference=p_header->>'forwarder_reference',carrier_reference=p_header->>'carrier_reference',actual_departure=nullif(p_header->>'actual_departure','')::date,actual_arrival=nullif(p_header->>'actual_arrival','')::date,
    incoterm_snapshot=p_header->>'incoterm_snapshot',currency=p_header->>'currency',note=p_header->>'note'
  where id=p_shipment_id;
  return p_shipment_id;
end $$;

revoke all on function public.field_actor_can(uuid,text[]) from public,anon,authenticated;
revoke all on function public.assert_worker_session_actor(uuid,uuid,text[]) from public,anon,authenticated;
revoke all on function public.save_worker_session_draft_command(uuid,integer,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.close_worker_session_day_command(uuid,integer,uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.adjust_worker_entry_command(uuid,integer,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.save_shipment_command(uuid,integer,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.field_actor_can(uuid,text[]) to service_role;
grant execute on function public.assert_worker_session_actor(uuid,uuid,text[]) to service_role;
grant execute on function public.save_worker_session_draft_command(uuid,integer,uuid,jsonb,jsonb) to service_role;
grant execute on function public.close_worker_session_day_command(uuid,integer,uuid,jsonb,text) to service_role;
grant execute on function public.adjust_worker_entry_command(uuid,integer,uuid,uuid,text,text) to service_role;
grant execute on function public.save_shipment_command(uuid,integer,uuid,jsonb,jsonb,text) to service_role;
