-- SUPERSEDED historical draft. Do not deploy or execute this proposal.
-- Implementation: supabase/migrations/202610220001_atomic_employee_profile.sql.
-- Verification: supabase/tests/atomic-employee.integration.mjs; inspect current
-- release evidence and progress.md for checks and remote deployment status.
-- Version 202610210002 belongs to atomic system settings, not this draft.
-- Save the employee, offboarding access changes, and history in one transaction.
-- Keep the existing account-status command as the authority for last-admin and session rules.
create or replace function public.patch_employee_profile_command(
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
set search_path = public
as $$
declare
  v_before public.employees;
  v_after public.employees;
  v_account_id uuid;
  v_assignments text;
  v_required_permission text;
  v_allowed text[] := array[
    'employee_code', 'full_name', 'display_name', 'date_of_birth', 'gender',
    'personal_phone', 'normalized_phone', 'personal_email', 'company_email',
    'department_id', 'position_id', 'employment_type_id', 'manager_employee_id',
    'join_date', 'probation_start_date', 'probation_end_date', 'official_date',
    'employment_status', 'current_address', 'permanent_address', 'province',
    'contractor_name', 'marital_status', 'note', 'termination_date', 'termination_reason'
  ];
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb
    or p_event_date is null then
    raise exception 'EMPLOYEE_INVALID_PATCH';
  end if;
  if exists(select 1 from jsonb_object_keys(p_patch) key where not (key = any(v_allowed))) then
    raise exception 'EMPLOYEE_INVALID_PATCH';
  end if;

  v_required_permission := case when p_patch ->> 'employment_status' = 'terminated'
    then 'employee.offboard' else 'employee.edit' end;
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = v_required_permission
  ) then
    raise exception 'EMPLOYEE_ACTOR_DENIED';
  end if;

  select * into v_before from public.employees where id = p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if p_expected_row_version is not null and v_before.row_version <> p_expected_row_version then
    raise exception 'EMPLOYEE_VERSION_CONFLICT';
  end if;

  -- Identifiers are allowlisted and quoted; values remain bound parameters.
  select string_agg(format('%1$I = (jsonb_populate_record(null::public.employees, $1)).%1$I', key), ', ' order by key)
    into v_assignments from jsonb_object_keys(p_patch) key;
  execute format('update public.employees set %s where id = $2 returning *', v_assignments)
    into v_after using p_patch, p_employee_id;

  if v_after.probation_start_date is not null and v_after.probation_end_date is not null
    and v_after.probation_end_date < v_after.probation_start_date then
    raise exception 'EMPLOYEE_INVALID_PATCH';
  end if;

  if p_patch ->> 'employment_status' = 'terminated' then
    -- A failure here, including LAST_ACTIVE_ADMIN, rolls back the profile edit.
    for v_account_id in select id from public.app_accounts
      where employee_id = p_employee_id order by id for update
    loop
      perform public.set_app_account_status(v_account_id, 'disabled', p_actor_id,
        coalesce(nullif(btrim(p_reason), ''), 'Offboarding'));
    end loop;
    update public.employees set profile_status = 'archived' where id = p_employee_id
      returning * into v_after;
  end if;

  insert into public.employee_history_events(
    employee_id, event_type, event_date, actor_account_id, before_data, after_data, reason
  ) values (
    p_employee_id,
    case when p_patch ->> 'employment_status' = 'terminated' then 'terminated' else 'profile_updated' end,
    coalesce(v_after.termination_date, p_event_date), p_actor_id,
    jsonb_build_object('rowVersion', v_before.row_version),
    jsonb_build_object('rowVersion', v_after.row_version, 'employmentStatus', v_after.employment_status),
    p_reason
  );
  return v_after.row_version;
end;
$$;

revoke all on function public.patch_employee_profile_command(uuid, integer, jsonb, uuid, date, text) from public, anon, authenticated;
grant execute on function public.patch_employee_profile_command(uuid, integer, jsonb, uuid, date, text) to service_role;
