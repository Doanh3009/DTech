alter table public.app_accounts
  add column if not exists activated_at timestamptz,
  add column if not exists last_login_at timestamptz;

update public.app_accounts
set activated_at = coalesce(activated_at, created_at)
where status = 'active' and activated_at is null;

create table if not exists public.account_provisioning_recoveries (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  employee_id uuid not null references public.employees(id),
  username text not null,
  status text not null default 'cleanup_required' check (status in ('cleanup_required', 'resolved')),
  last_error text not null,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (auth_user_id)
);

alter table public.account_provisioning_recoveries enable row level security;

create or replace function public.create_role_definition(
  p_code text,
  p_name text,
  p_description text,
  p_permission_keys text[],
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role_id uuid := gen_random_uuid();
  v_permission_keys text[];
  v_unknown integer;
begin
  if btrim(coalesce(p_code, '')) = '' or btrim(coalesce(p_name, '')) = '' then
    raise exception 'ROLE_FIELDS_REQUIRED';
  end if;

  select coalesce(array_agg(distinct value), '{}'::text[])
  into v_permission_keys
  from unnest(coalesce(p_permission_keys, '{}'::text[])) value;

  select count(*)
  into v_unknown
  from unnest(v_permission_keys) value
  left join permissions permission on permission.key = value
  where permission.key is null;

  if v_unknown > 0 then
    raise exception 'UNKNOWN_PERMISSION';
  end if;

  insert into roles(id, code, name, description, is_system)
  values(v_role_id, lower(btrim(p_code)), btrim(p_name), nullif(btrim(p_description), ''), false);

  insert into role_permissions(role_id, permission_key)
  select v_role_id, unnest(v_permission_keys);

  insert into audit_logs(actor_account_id, action, entity_type, entity_id, after_data)
  values(
    p_actor_id,
    'role.created',
    'role',
    v_role_id::text,
    jsonb_build_object('code', lower(btrim(p_code)), 'name', btrim(p_name), 'permissionKeys', v_permission_keys)
  );

  return v_role_id;
exception
  when unique_violation then
    raise exception 'ROLE_CODE_EXISTS';
end;
$$;

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
set search_path=public
as $$
declare
  v_account_id uuid := gen_random_uuid();
  v_role_ids uuid[];
  v_employee_id uuid;
begin
  select id into v_employee_id from employees where id = p_employee_id for update;
  if not found then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;

  if exists(select 1 from app_accounts where employee_id = p_employee_id) then
    raise exception 'EMPLOYEE_ACCOUNT_EXISTS';
  end if;

  select coalesce(array_agg(distinct value), '{}'::uuid[])
  into v_role_ids
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) value;

  if coalesce(array_length(v_role_ids, 1), 0) = 0 then
    raise exception 'ROLE_REQUIRED';
  end if;

  if (select count(*) from roles where id = any(v_role_ids)) <> array_length(v_role_ids, 1) then
    raise exception 'ROLE_NOT_FOUND';
  end if;

  insert into app_accounts(
    id, auth_user_id, employee_id, username, display_name, primary_email, phone,
    status, activated_at
  )
  values(
    v_account_id, p_auth_user_id, p_employee_id, lower(btrim(p_username)),
    p_display_name, p_primary_email, nullif(btrim(p_phone), ''), 'active', now()
  );

  insert into account_roles(account_id, role_id, assigned_by)
  select v_account_id, unnest(v_role_ids), p_actor_id;

  insert into employee_history_events(
    employee_id, event_type, event_date, actor_account_id, after_data
  )
  values(
    p_employee_id,
    'account_provisioned',
    p_event_date,
    p_actor_id,
    jsonb_build_object(
      'accountId', v_account_id,
      'status', 'active',
      'username', lower(btrim(p_username)),
      'roleIds', v_role_ids
    )
  );

  return v_account_id;
exception
  when unique_violation then
    raise exception 'ACCOUNT_IDENTITY_EXISTS';
end;
$$;

revoke all on function public.create_role_definition(text,text,text,text[],uuid) from public, anon, authenticated;
revoke all on function public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date) from public, anon, authenticated;
grant execute on function public.create_role_definition(text,text,text,text[],uuid) to service_role;
grant execute on function public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date) to service_role;

create or replace function public.create_employee_profile(
  p_employee jsonb,
  p_sensitive jsonb,
  p_emergency jsonb,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_employee_id uuid := gen_random_uuid();
begin
  insert into employees(
    id, employee_code, full_name, display_name, date_of_birth, gender,
    personal_phone, normalized_phone, personal_email, company_email,
    current_address, permanent_address, province, country,
    department_id, position_id, employment_type_id, manager_employee_id,
    contractor_name, join_date, probation_start_date, probation_end_date,
    official_date, employment_status, profile_status, profile_completeness,
    marital_status, note, created_by
  )
  values(
    v_employee_id,
    p_employee->>'employee_code',
    p_employee->>'full_name',
    p_employee->>'display_name',
    nullif(p_employee->>'date_of_birth', '')::date,
    nullif(p_employee->>'gender', '')::employee_gender,
    nullif(p_employee->>'personal_phone', ''),
    nullif(p_employee->>'normalized_phone', ''),
    nullif(p_employee->>'personal_email', ''),
    nullif(p_employee->>'company_email', ''),
    nullif(p_employee->>'current_address', ''),
    nullif(p_employee->>'permanent_address', ''),
    nullif(p_employee->>'province', ''),
    coalesce(nullif(p_employee->>'country', ''), 'Việt Nam'),
    (p_employee->>'department_id')::uuid,
    (p_employee->>'position_id')::uuid,
    (p_employee->>'employment_type_id')::uuid,
    nullif(p_employee->>'manager_employee_id', '')::uuid,
    nullif(p_employee->>'contractor_name', ''),
    (p_employee->>'join_date')::date,
    nullif(p_employee->>'probation_start_date', '')::date,
    nullif(p_employee->>'probation_end_date', '')::date,
    nullif(p_employee->>'official_date', '')::date,
    (p_employee->>'employment_status')::employee_status,
    'pending_hr_completion',
    0,
    nullif(p_employee->>'marital_status', ''),
    nullif(p_employee->>'note', ''),
    p_actor_id
  );

  if p_sensitive is not null and p_sensitive <> '{}'::jsonb then
    insert into employee_sensitive_profiles(
      employee_id, national_id_number, national_id_issued_date,
      national_id_issued_place, personal_tax_code, updated_by
    )
    values(
      v_employee_id,
      nullif(p_sensitive->>'national_id_number', ''),
      nullif(p_sensitive->>'national_id_issued_date', '')::date,
      nullif(p_sensitive->>'national_id_issued_place', ''),
      nullif(p_sensitive->>'personal_tax_code', ''),
      p_actor_id
    );
  end if;

  if p_emergency is not null and p_emergency <> '{}'::jsonb then
    insert into employee_emergency_contacts(employee_id, full_name, relation, phone, is_primary)
    values(
      v_employee_id,
      coalesce(nullif(p_emergency->>'full_name', ''), 'Chưa cập nhật'),
      coalesce(nullif(p_emergency->>'relation', ''), 'Khác'),
      coalesce(nullif(p_emergency->>'phone', ''), 'Chưa cập nhật'),
      true
    );
  end if;

  insert into employee_history_events(
    employee_id, event_type, event_date, actor_account_id, after_data
  )
  values(
    v_employee_id,
    'joined',
    (p_employee->>'join_date')::date,
    p_actor_id,
    jsonb_build_object(
      'employeeCode', p_employee->>'employee_code',
      'employmentStatus', p_employee->>'employment_status'
    )
  );

  return v_employee_id;
end;
$$;

revoke all on function public.create_employee_profile(jsonb,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.create_employee_profile(jsonb,jsonb,jsonb,uuid) to service_role;

alter table public.project_update_attachments
  add column if not exists client_attachment_id text;

create unique index if not exists project_update_attachments_client_id_unique
  on public.project_update_attachments(update_id, client_attachment_id)
  where client_attachment_id is not null;
