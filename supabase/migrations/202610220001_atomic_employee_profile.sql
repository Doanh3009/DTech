-- Employee profile edits and offboarding are one command. A required row version
-- rejects stale and uncertain retries without repeating history/access changes.
-- Lifecycle writers share one lock BEFORE employee/account row locks so two
-- administrators cannot concurrently remove the final active administrator.

-- Private implementation: public commands validate the actor and acquire the
-- lifecycle/employee locks before calling it. The service credential cannot call
-- this helper directly and bypass those checks.
create or replace function public.apply_app_account_status_locked(
  p_account_id uuid,
  p_status text,
  p_actor_id uuid,
  p_reason text default null
)
returns public.app_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.app_accounts;
  v_after public.app_accounts;
begin
  if p_status is null or p_status not in ('pending_activation', 'active', 'disabled', 'locked', 'invited') then
    raise exception 'INVALID_STATUS';
  end if;
  select * into v_before from public.app_accounts where id = p_account_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;

  if v_before.status = 'active' and p_status <> 'active'
    and exists (
      select 1 from public.account_roles ar
      join public.roles r on r.id = ar.role_id
      where ar.account_id = p_account_id and r.code = 'admin'
    ) and not exists (
      select 1 from public.app_accounts a
      join public.account_roles ar on ar.account_id = a.id
      join public.roles r on r.id = ar.role_id
      where a.status = 'active' and a.id <> p_account_id and r.code = 'admin'
    ) then
    raise exception 'LAST_ACTIVE_ADMIN';
  end if;

  update public.app_accounts
  set status = p_status::public.account_status,
      disabled_at = case when p_status = 'disabled' then now() else null end
  where id = p_account_id returning * into v_after;
  if p_status <> 'active' then
    update public.app_sessions set revoked_at = now()
    where account_id = p_account_id and revoked_at is null;
  end if;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, reason)
  values(p_actor_id, 'account.status_updated', 'account', p_account_id::text,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_after.status), p_reason);
  return v_after;
end;
$$;

revoke all on function public.apply_app_account_status_locked(uuid,text,uuid,text)
  from public, anon, authenticated, service_role;

create or replace function public.set_app_account_status(
  p_account_id uuid,
  p_status text,
  p_actor_id uuid,
  p_reason text default null
)
returns public.app_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_employee public.employees;
  v_required_permission text;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if p_status is null or p_status not in ('pending_activation', 'active', 'disabled', 'locked', 'invited') then
    raise exception 'INVALID_STATUS';
  end if;
  v_required_permission := case when p_status = 'active' then 'account.enable' else 'account.disable' end;
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = v_required_permission
  ) then raise exception 'ACCOUNT_ACTOR_FORBIDDEN'; end if;

  select employee_id into v_employee_id from public.app_accounts where id = p_account_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if v_employee_id is not null then
    select * into v_employee from public.employees where id = v_employee_id for update;
    if p_status = 'active' and (not found or v_employee.employment_status = 'terminated' or v_employee.profile_status = 'archived') then
      raise exception 'ACCOUNT_EMPLOYEE_INACTIVE';
    end if;
  end if;
  return public.apply_app_account_status_locked(p_account_id, p_status, p_actor_id, p_reason);
end;
$$;

create or replace function public.replace_app_account_roles(
  p_account_id uuid,
  p_role_ids uuid[],
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.app_accounts;
  v_before jsonb;
  v_role_ids uuid[];
  v_was_admin boolean;
  v_will_admin boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = 'account.assign_role'
  ) then raise exception 'ACCOUNT_ACTOR_FORBIDDEN'; end if;
  select * into v_account from public.app_accounts where id = p_account_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  select coalesce(array_agg(distinct item), '{}'::uuid[]) into v_role_ids
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) item;
  if cardinality(v_role_ids) = 0 then raise exception 'ROLE_REQUIRED'; end if;
  if array_position(v_role_ids, null) is not null
    or (select count(*) from public.roles where id = any(v_role_ids)) <> cardinality(v_role_ids)
  then raise exception 'ROLE_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(ar.role_id order by ar.role_id), '[]'::jsonb), coalesce(bool_or(r.code = 'admin'), false)
  into v_before, v_was_admin
  from public.account_roles ar join public.roles r on r.id = ar.role_id where ar.account_id = p_account_id;
  select exists(select 1 from public.roles where id = any(v_role_ids) and code = 'admin') into v_will_admin;
  if v_account.status = 'active' and v_was_admin and not v_will_admin and not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.roles r on r.id = ar.role_id
    where a.status = 'active' and a.id <> p_account_id and r.code = 'admin'
  ) then raise exception 'LAST_ACTIVE_ADMIN'; end if;

  delete from public.account_roles where account_id = p_account_id;
  insert into public.account_roles(account_id, role_id, assigned_by)
  select p_account_id, unnest(v_role_ids), p_actor_id;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data)
  values(p_actor_id, 'account.roles_updated', 'account', p_account_id::text,
    jsonb_build_object('roleIds', v_before), jsonb_build_object('roleIds', to_jsonb(v_role_ids)));
end;
$$;

-- Preserve the provisioning signature while closing the create-after-offboard
-- race. Auth creation/cleanup remains an application-level recovery workflow.
create or replace function public.provision_app_account(
  p_auth_user_id uuid,
  p_employee_id uuid,
  p_username text,
  p_display_name text,
  p_primary_email text,
  p_phone text,
  p_role_ids uuid[],
  p_actor_id uuid,
  p_event_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := gen_random_uuid();
  v_employee public.employees;
  v_role_ids uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = 'account.create'
  ) then raise exception 'ACCOUNT_ACTOR_FORBIDDEN'; end if;
  select * into v_employee from public.employees where id = p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_employee.employment_status = 'terminated' or v_employee.profile_status = 'archived' then
    raise exception 'ACCOUNT_EMPLOYEE_INACTIVE';
  end if;
  if exists(select 1 from public.app_accounts where employee_id = p_employee_id) then
    raise exception 'EMPLOYEE_ACCOUNT_EXISTS';
  end if;
  select coalesce(array_agg(distinct item), '{}'::uuid[]) into v_role_ids
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) item;
  if cardinality(v_role_ids) = 0 then raise exception 'ROLE_REQUIRED'; end if;
  if array_position(v_role_ids, null) is not null
    or (select count(*) from public.roles where id = any(v_role_ids)) <> cardinality(v_role_ids)
  then raise exception 'ROLE_NOT_FOUND'; end if;
  insert into public.app_accounts(
    id, auth_user_id, employee_id, username, display_name, primary_email, phone, status, activated_at
  ) values(
    v_account_id, p_auth_user_id, p_employee_id, lower(btrim(p_username)), p_display_name,
    p_primary_email, nullif(btrim(p_phone), ''), 'active', now()
  );
  insert into public.account_roles(account_id, role_id, assigned_by)
  select v_account_id, unnest(v_role_ids), p_actor_id;
  insert into public.employee_history_events(employee_id, event_type, event_date, actor_account_id, after_data)
  values(p_employee_id, 'account_provisioned', p_event_date, p_actor_id,
    jsonb_build_object('accountId', v_account_id, 'status', 'active',
      'username', lower(btrim(p_username)), 'roleIds', v_role_ids));
  return v_account_id;
exception when unique_violation then
  raise exception 'ACCOUNT_IDENTITY_EXISTS';
end;
$$;

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
set search_path = ''
as $$
declare
  v_before public.employees;
  v_after public.employees;
  v_patch jsonb := p_patch;
  v_key text;
  v_value jsonb;
  v_date date;
  v_phone text;
  v_normalized_phone text;
  v_account_id uuid;
  v_assignments text;
  v_before_data jsonb;
  v_after_data jsonb;
  v_offboard boolean;
  v_edit boolean;
  v_has_edit boolean;
  v_has_offboard boolean;
  v_allowed constant text[] := array[
    'employee_code', 'full_name', 'display_name', 'date_of_birth', 'gender',
    'personal_phone', 'normalized_phone', 'personal_email', 'company_email',
    'department_id', 'position_id', 'employment_type_id', 'manager_employee_id',
    'join_date', 'probation_start_date', 'probation_end_date', 'official_date',
    'employment_status', 'current_address', 'permanent_address', 'province',
    'contractor_name', 'marital_status', 'note', 'termination_date', 'termination_reason'
  ];
  v_required constant text[] := array[
    'employee_code', 'full_name', 'department_id', 'position_id', 'employment_type_id', 'join_date', 'employment_status'
  ];
  v_dates constant text[] := array[
    'date_of_birth', 'join_date', 'probation_start_date', 'probation_end_date', 'official_date', 'termination_date'
  ];
  v_uuids constant text[] := array['department_id', 'position_id', 'employment_type_id', 'manager_employee_id'];
begin
  if p_employee_id is null or p_actor_id is null
    or p_expected_row_version is null or p_expected_row_version not between 1 and 2147483646
    or p_event_date is null or not isfinite(p_event_date)
    or p_event_date not between date '0001-01-01' and date '9999-12-31'
    or jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb
    or octet_length(p_patch::text) > 131072
    or (p_reason is not null and length(btrim(p_reason)) > 500)
  then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;

  for v_key, v_value in select key, value from jsonb_each(p_patch) loop
    if not (v_key = any(v_allowed)) or jsonb_typeof(v_value) not in ('string', 'null')
      or (v_key = any(v_required) and (v_value = 'null'::jsonb or btrim(p_patch ->> v_key) = ''))
    then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
    if v_value = 'null'::jsonb then continue; end if;
    if btrim(p_patch ->> v_key) = '' then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
    v_patch := jsonb_set(v_patch, array[v_key], to_jsonb(btrim(p_patch ->> v_key)));
    if v_key = any(v_dates) then
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
    if v_key = any(v_uuids) and (v_patch ->> v_key) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'EMPLOYEE_INVALID_PATCH';
    end if;
  end loop;
  if v_patch ? 'full_name' and length(v_patch ->> 'full_name') < 2 then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
  if v_patch ? 'employment_status' and (v_patch ->> 'employment_status') not in ('pending_onboarding','probation','active','on_leave','terminated') then
    raise exception 'EMPLOYEE_INVALID_PATCH';
  end if;
  if v_patch -> 'gender' <> 'null'::jsonb and (v_patch ->> 'gender') not in ('male','female','other','undisclosed') then
    raise exception 'EMPLOYEE_INVALID_PATCH';
  end if;
  foreach v_key in array array['personal_email', 'company_email'] loop
    if v_patch ? v_key and v_patch -> v_key <> 'null'::jsonb
      and (v_patch ->> v_key) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
  end loop;
  if v_patch ? 'normalized_phone' and not (v_patch ? 'personal_phone') then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
  if v_patch ? 'personal_phone' then
    v_phone := v_patch ->> 'personal_phone';
    if v_phone is not null and length(v_phone) < 8 then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
    v_normalized_phone := regexp_replace(v_phone, '[^0-9+]', '', 'g');
    if left(v_normalized_phone, 3) = '+84' then v_normalized_phone := '84' || substr(v_normalized_phone, 4);
    elsif left(v_normalized_phone, 2) = '84' then null;
    elsif left(v_normalized_phone, 1) = '0' then v_normalized_phone := '84' || substr(v_normalized_phone, 2);
    else v_normalized_phone := regexp_replace(v_normalized_phone, '[^0-9]', '', 'g'); end if;
    if v_patch ? 'normalized_phone' and (v_patch ->> 'normalized_phone') is distinct from v_normalized_phone then
      raise exception 'EMPLOYEE_INVALID_PATCH';
    end if;
    v_patch := v_patch || jsonb_build_object('normalized_phone', v_normalized_phone);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  v_offboard := v_patch ?| array['termination_date', 'termination_reason'] or v_patch ->> 'employment_status' = 'terminated';
  v_offboard := coalesce(v_offboard, false);
  select exists (
    select 1 from jsonb_object_keys(v_patch) item(key)
    where key not in ('termination_date', 'termination_reason')
      and not (key = 'employment_status' and v_patch ->> key = 'terminated')
  ) into v_edit;
  select coalesce(bool_or(rp.permission_key = 'employee.edit'), false),
         coalesce(bool_or(rp.permission_key = 'employee.offboard'), false)
  into v_has_edit, v_has_offboard
  from public.app_accounts a
  join public.account_roles ar on ar.account_id = a.id
  join public.role_permissions rp on rp.role_id = ar.role_id
  where a.id = p_actor_id and a.status = 'active';
  if (v_edit and not v_has_edit) or (v_offboard and not v_has_offboard) then
    raise exception 'EMPLOYEE_ACTOR_FORBIDDEN';
  end if;

  select * into v_before from public.employees where id = p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_before.row_version <> p_expected_row_version then raise exception 'EMPLOYEE_VERSION_CONFLICT'; end if;
  begin
    v_after := jsonb_populate_record(v_before, v_patch);
  exception when invalid_text_representation then raise exception 'EMPLOYEE_INVALID_PATCH'; end;
  -- Existing inactive references remain historical assignments. A newly chosen
  -- catalog reference must be active; missing references retain their FK error.
  if (v_after.department_id is distinct from v_before.department_id and exists (
      select 1 from public.departments where id = v_after.department_id and not active
    )) or (v_after.position_id is distinct from v_before.position_id and exists (
      select 1 from public.positions where id = v_after.position_id and not active
    )) or (v_after.employment_type_id is distinct from v_before.employment_type_id and exists (
      select 1 from public.employment_types where id = v_after.employment_type_id and not active
    )) then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
  if v_after.manager_employee_id is distinct from v_before.manager_employee_id
    and v_after.manager_employee_id is not null then
    if not exists (
      select 1 from public.employees manager
      where manager.id = v_after.manager_employee_id
        and manager.employment_status = 'active' and manager.profile_status <> 'archived'
    ) then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
    -- Include the edited employee in the visited path, then stop recursion once
    -- a repeat is found. This rejects both a new cycle through this employee and
    -- attachment to an already corrupt cyclic chain without infinite recursion.
    if exists (
      with recursive manager_chain(id, manager_employee_id, visited, is_cycle) as (
        select manager.id, manager.manager_employee_id,
          array[p_employee_id, manager.id], manager.id = p_employee_id
        from public.employees manager where manager.id = v_after.manager_employee_id
        union all
        select manager.id, manager.manager_employee_id,
          chain.visited || manager.id, manager.id = any(chain.visited)
        from manager_chain chain
        join public.employees manager on manager.id = chain.manager_employee_id
        where not chain.is_cycle
      )
      select 1 from manager_chain where is_cycle
    ) then raise exception 'EMPLOYEE_INVALID_PATCH'; end if;
  end if;
  if v_before.employment_status = 'terminated' and v_after.employment_status <> 'terminated' then
    raise exception 'EMPLOYEE_REHIRE_REQUIRED';
  end if;
  if (v_after.official_date is not null and v_after.official_date < v_after.join_date)
    or (v_after.termination_date is not null and v_after.termination_date < v_after.join_date)
    or (v_after.probation_start_date is not null and v_after.probation_end_date is not null
      and v_after.probation_end_date < v_after.probation_start_date)
  then raise exception 'EMPLOYEE_INVALID_DATES'; end if;
  if v_after.employment_status = 'terminated' and (
    v_after.termination_date is null or v_after.termination_reason is null
    or length(btrim(v_after.termination_reason)) not between 3 and 500
  ) then raise exception 'EMPLOYEE_OFFBOARD_DETAILS_REQUIRED'; end if;
  if v_after.employment_status = 'terminated' then
    v_patch := v_patch || jsonb_build_object('profile_status', 'archived');
  end if;

  -- Allowlisted/quoted identifiers; values stay bound. One employee UPDATE means
  -- exactly one version increment, including the archived profile status.
  select string_agg(format('%1$I = (jsonb_populate_record(null::public.employees, $1)).%1$I', key), ', ' order by key)
  into v_assignments from jsonb_object_keys(v_patch) item(key);
  execute format('update public.employees set %s where id = $2 returning *', v_assignments)
  into v_after using v_patch, p_employee_id;

  if v_offboard and v_after.employment_status = 'terminated' then
    for v_account_id in select id from public.app_accounts where employee_id = p_employee_id order by id loop
      perform public.apply_app_account_status_locked(v_account_id, 'disabled', p_actor_id,
        coalesce(nullif(btrim(p_reason), ''), v_after.termination_reason));
    end loop;
  end if;
  select jsonb_object_agg(key, to_jsonb(v_before) -> key), jsonb_object_agg(key, to_jsonb(v_after) -> key)
  into v_before_data, v_after_data from jsonb_object_keys(v_patch) item(key);
  v_before_data := v_before_data || jsonb_build_object('rowVersion', v_before.row_version);
  v_after_data := v_after_data || jsonb_build_object('rowVersion', v_after.row_version);
  insert into public.employee_history_events(
    employee_id, event_type, event_date, actor_account_id, before_data, after_data, reason
  ) values (
    p_employee_id,
    case when v_offboard and v_after.employment_status = 'terminated' then 'terminated' else 'profile_updated' end::public.employee_history_event_type,
    case when v_offboard and v_after.employment_status = 'terminated' then v_after.termination_date else p_event_date end,
    p_actor_id, v_before_data, v_after_data,
    coalesce(nullif(btrim(p_reason), ''), case when v_offboard then v_after.termination_reason end)
  );
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, reason)
  values(p_actor_id,
    case when v_offboard and v_after.employment_status = 'terminated' then 'employee.offboarded' else 'employee.updated' end,
    'employee', p_employee_id::text,
    jsonb_build_object('rowVersion', v_before.row_version, 'employmentStatus', v_before.employment_status),
    jsonb_build_object('rowVersion', v_after.row_version, 'employmentStatus', v_after.employment_status,
      'changedFields', (select jsonb_agg(key order by key) from jsonb_object_keys(v_patch) item(key))),
    coalesce(nullif(btrim(p_reason), ''), case when v_offboard then v_after.termination_reason end));
  return v_after.row_version;
end;
$$;

revoke all on function public.set_app_account_status(uuid,text,uuid,text) from public, anon, authenticated;
revoke all on function public.replace_app_account_roles(uuid,uuid[],uuid) from public, anon, authenticated;
revoke all on function public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date) from public, anon, authenticated;
revoke all on function public.patch_employee_profile_command(uuid,integer,jsonb,uuid,date,text) from public, anon, authenticated;
grant execute on function public.set_app_account_status(uuid,text,uuid,text) to service_role;
grant execute on function public.replace_app_account_roles(uuid,uuid[],uuid) to service_role;
grant execute on function public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date) to service_role;
grant execute on function public.patch_employee_profile_command(uuid,integer,jsonb,uuid,date,text) to service_role;
