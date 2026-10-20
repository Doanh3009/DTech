-- An administrator may be a real employee even when the legacy account was
-- provisioned before employee linking existed. For the remaining active admin
-- accounts without a matching employee, create a minimal editable profile and
-- link it atomically. This enables self-service attendance without fabricating
-- an attendance event.
with unlinked_admins as (
  select
    a.id as account_id,
    coalesce(nullif(trim(a.display_name), ''), nullif(trim(a.username), ''), 'Quản trị viên') as full_name,
    lower(a.primary_email) as primary_email,
    'ADM-' || upper(left(replace(a.id::text, '-', ''), 8)) as employee_code
  from public.app_accounts a
  where a.status = 'active'
    and a.employee_id is null
    and a.primary_email is not null
    and exists (
      select 1
      from public.account_roles ar
      join public.roles r on r.id = ar.role_id
      where ar.account_id = a.id and r.code = 'admin'
    )
    and not exists (
      select 1
      from public.employees e
      where lower(e.company_email) = lower(a.primary_email)
        or lower(e.personal_email) = lower(a.primary_email)
    )
), organization_defaults as (
  select
    (select id from public.departments where code = 'board' limit 1) as department_id,
    (select id from public.positions where code = 'director' limit 1) as position_id,
    (select id from public.employment_types where code = 'office_employee' limit 1) as employment_type_id
), created_profiles as (
  insert into public.employees (
    employee_code,
    full_name,
    display_name,
    personal_phone,
    normalized_phone,
    company_email,
    department_id,
    position_id,
    employment_type_id,
    join_date,
    employment_status,
    profile_status,
    profile_completeness,
    note
  )
  select
    account.employee_code,
    account.full_name,
    account.full_name,
    '0000000000',
    '0000000000',
    account.primary_email,
    organization.department_id,
    organization.position_id,
    organization.employment_type_id,
    current_date,
    'active',
    'pending_hr_completion',
    20,
    '[SYSTEM] Hồ sơ tối thiểu được tạo để liên kết tài khoản quản trị với chấm công; cần HR hoàn thiện.'
  from unlinked_admins account
  cross join organization_defaults organization
  where organization.department_id is not null
    and organization.position_id is not null
    and organization.employment_type_id is not null
  returning id, employee_code
)
update public.app_accounts account
set employee_id = profile.id
from created_profiles profile
where account.employee_id is null
  and profile.employee_code = 'ADM-' || upper(left(replace(account.id::text, '-', ''), 8));
