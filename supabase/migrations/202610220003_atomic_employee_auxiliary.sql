-- Sensitive data corrections and standalone archival share the employee version
-- with ordinary profile edits. The lifecycle lock always precedes employee and
-- account locks, matching profile/offboarding/provisioning/deletion commands.

create or replace function public.patch_employee_sensitive_command(
  p_employee_id uuid,
  p_expected_row_version integer,
  p_patch jsonb,
  p_actor_id uuid,
  p_event_date date,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee public.employees;
  v_before public.employee_sensitive_profiles;
  v_after public.employee_sensitive_profiles;
  v_patch jsonb := p_patch;
  v_key text;
  v_value jsonb;
  v_text text;
  v_reason text := regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_date date;
  v_new_version integer;
  v_fields jsonb;
  v_allowed constant text[] := array[
    'national_id_number', 'national_id_issued_date', 'national_id_issued_place', 'national_id_expiry_date',
    'bank_name', 'bank_account_number', 'bank_account_holder', 'bank_branch',
    'personal_tax_code', 'social_insurance_code'
  ];
begin
  if p_employee_id is null or p_actor_id is null
    or p_expected_row_version is null or p_expected_row_version not between 1 and 2147483646
    or p_event_date is null or not isfinite(p_event_date)
    or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb
    or octet_length(p_patch::text) > 16384
    or v_reason is null or length(v_reason) not between 3 and 500
  then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;

  for v_key, v_value in select key, value from jsonb_each(p_patch) loop
    if not (v_key = any(v_allowed)) or jsonb_typeof(v_value) not in ('string', 'null') then
      raise exception 'EMPLOYEE_INVALID_PATCH';
    end if;
    if v_value = 'null'::jsonb then continue; end if;
    v_text := regexp_replace(p_patch ->> v_key, '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if v_text = '' or length(v_text) > 200 then
      raise exception 'EMPLOYEE_INVALID_PATCH';
    end if;
    v_patch := jsonb_set(v_patch, array[v_key], to_jsonb(v_text));
    if v_key in ('national_id_issued_date', 'national_id_expiry_date') then
      if (v_patch ->> v_key) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'EMPLOYEE_INVALID_DATES';
      end if;
      begin
        v_date := (v_patch ->> v_key)::date;
        if not isfinite(v_date) or to_char(v_date, 'YYYY-MM-DD') <> (v_patch ->> v_key) then
          raise exception 'EMPLOYEE_INVALID_DATES';
        end if;
      exception when datetime_field_overflow or invalid_datetime_format then
        raise exception 'EMPLOYEE_INVALID_DATES';
      end;
    end if;
  end loop;
  if v_patch -> 'national_id_number' <> 'null'::jsonb and (v_patch ->> 'national_id_number') !~ '^[0-9]{9,12}$' then
    raise exception 'EMPLOYEE_INVALID_PATCH';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = 'employee.edit_sensitive'
  ) then raise exception 'EMPLOYEE_ACTOR_FORBIDDEN'; end if;

  select * into v_employee from public.employees where id = p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_employee.row_version <> p_expected_row_version then raise exception 'EMPLOYEE_VERSION_CONFLICT'; end if;
  -- Archival does not prevent an authorized correction of historical data.
  select * into v_before from public.employee_sensitive_profiles where employee_id = p_employee_id for update;
  v_after := jsonb_populate_record(v_before, v_patch);
  if v_after.national_id_expiry_date is not null and v_after.national_id_issued_date is not null
    and v_after.national_id_expiry_date < v_after.national_id_issued_date
  then raise exception 'EMPLOYEE_INVALID_DATES'; end if;

  -- File links and omitted fields stay intact. A first patch creates the row;
  -- the employee row lock serializes this with other versioned profile commands.
  insert into public.employee_sensitive_profiles(
    employee_id, national_id_number, national_id_issued_date, national_id_issued_place, national_id_expiry_date,
    bank_name, bank_account_number, bank_account_holder, bank_branch, personal_tax_code, social_insurance_code, updated_by
  ) values (
    p_employee_id, v_after.national_id_number, v_after.national_id_issued_date, v_after.national_id_issued_place,
    v_after.national_id_expiry_date, v_after.bank_name, v_after.bank_account_number, v_after.bank_account_holder,
    v_after.bank_branch, v_after.personal_tax_code, v_after.social_insurance_code, p_actor_id
  ) on conflict (employee_id) do update set
    national_id_number = excluded.national_id_number,
    national_id_issued_date = excluded.national_id_issued_date,
    national_id_issued_place = excluded.national_id_issued_place,
    national_id_expiry_date = excluded.national_id_expiry_date,
    bank_name = excluded.bank_name,
    bank_account_number = excluded.bank_account_number,
    bank_account_holder = excluded.bank_account_holder,
    bank_branch = excluded.bank_branch,
    personal_tax_code = excluded.personal_tax_code,
    social_insurance_code = excluded.social_insurance_code,
    updated_by = p_actor_id;

  update public.employees set updated_at = now() where id = p_employee_id returning row_version into v_new_version;
  select jsonb_agg(key order by key) into v_fields from jsonb_object_keys(v_patch) item(key);
  -- Neither history nor audit contains ID, bank, tax or insurance values.
  insert into public.employee_history_events(
    employee_id, event_type, event_date, actor_account_id, before_data, after_data, reason
  ) values (
    p_employee_id, 'sensitive_updated', p_event_date, p_actor_id,
    jsonb_build_object('rowVersion', v_employee.row_version),
    jsonb_build_object('rowVersion', v_new_version, 'fields', v_fields), v_reason
  );
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, reason)
  values(p_actor_id, 'employee.sensitive_updated', 'employee', p_employee_id::text,
    jsonb_build_object('rowVersion', v_employee.row_version),
    jsonb_build_object('rowVersion', v_new_version, 'changedFields', v_fields), v_reason);
  return v_new_version;
end;
$$;

create or replace function public.archive_employee_command(
  p_employee_id uuid,
  p_expected_row_version integer,
  p_actor_id uuid,
  p_event_date date,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.employees;
  v_after public.employees;
  v_account_id uuid;
  v_reason text := regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
begin
  if p_employee_id is null or p_actor_id is null
    or p_expected_row_version is null or p_expected_row_version not between 1 and 2147483646
    or p_event_date is null or not isfinite(p_event_date)
    or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or v_reason is null or length(v_reason) not between 3 and 500
  then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;

  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = 'employee.archive'
  ) then raise exception 'EMPLOYEE_ACTOR_FORBIDDEN'; end if;

  select * into v_before from public.employees where id = p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_before.row_version <> p_expected_row_version then raise exception 'EMPLOYEE_VERSION_CONFLICT'; end if;
  if v_before.profile_status = 'archived' then raise exception 'EMPLOYEE_ALREADY_ARCHIVED'; end if;
  -- Standalone archival changes visibility and access, preserving employment
  -- status/dates. A contractual termination uses the offboarding command.
  update public.employees set profile_status = 'archived' where id = p_employee_id returning * into v_after;
  for v_account_id in select id from public.app_accounts where employee_id = p_employee_id order by id loop
    perform public.apply_app_account_status_locked(v_account_id, 'disabled', p_actor_id, v_reason);
  end loop;
  insert into public.employee_history_events(
    employee_id, event_type, event_date, actor_account_id, before_data, after_data, reason
  ) values (
    p_employee_id, 'archived', p_event_date, p_actor_id,
    jsonb_build_object('rowVersion', v_before.row_version, 'profileStatus', v_before.profile_status),
    jsonb_build_object('rowVersion', v_after.row_version, 'profileStatus', v_after.profile_status), v_reason
  );
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, reason)
  values(p_actor_id, 'employee.archived', 'employee', p_employee_id::text,
    jsonb_build_object('rowVersion', v_before.row_version, 'profileStatus', v_before.profile_status),
    jsonb_build_object('rowVersion', v_after.row_version, 'profileStatus', v_after.profile_status), v_reason);
  return v_after.row_version;
end;
$$;

revoke all on function public.patch_employee_sensitive_command(uuid,integer,jsonb,uuid,date,text) from public, anon, authenticated;
revoke all on function public.archive_employee_command(uuid,integer,uuid,date,text) from public, anon, authenticated;
grant execute on function public.patch_employee_sensitive_command(uuid,integer,jsonb,uuid,date,text) to service_role;
grant execute on function public.archive_employee_command(uuid,integer,uuid,date,text) to service_role;
