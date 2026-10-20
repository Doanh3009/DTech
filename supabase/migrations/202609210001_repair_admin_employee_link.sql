-- Existing deployments could have created the admin account before the personal
-- attendance migration. That migration created HR002 only for a missing account,
-- leaving the existing admin account without employee_id and unable to check in.
-- Repair only active admin accounts and only when a matching, unclaimed employee
-- profile exists; no attendance event is fabricated by this migration.
with eligible_accounts as (
  select a.id, lower(a.primary_email) as primary_email
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
), ranked_profiles as (
  select
    a.id as account_id,
    e.id as employee_id,
    row_number() over (partition by a.id order by e.join_date asc, e.created_at asc) as account_rank,
    row_number() over (partition by e.id order by a.id) as employee_rank
  from eligible_accounts a
  join public.employees e
    on lower(e.company_email) = a.primary_email
    or lower(e.personal_email) = a.primary_email
  where e.employment_status in ('active', 'probation', 'pending_onboarding')
    and not exists (
      select 1 from public.app_accounts linked
      where linked.employee_id = e.id
    )
), matching_profiles as (
  select account_id, employee_id
  from ranked_profiles
  where account_rank = 1 and employee_rank = 1
)
update public.app_accounts account
set employee_id = profile.employee_id
from matching_profiles profile
where account.id = profile.account_id
  and account.employee_id is null;

-- The legacy demo admin profile is identified by HR002. Link it by account email
-- as a compatibility fallback when the profile was seeded before the account.
update public.app_accounts account
set employee_id = employee.id
from public.employees employee
where account.status = 'active'
  and account.employee_id is null
  and lower(account.primary_email) = 'admin@chautuan.local'
  and lower(employee.employee_code) = 'hr002'
  and not exists (
    select 1 from public.app_accounts linked
    where linked.employee_id = employee.id
  )
  and exists (
    select 1
    from public.account_roles ar
    join public.roles r on r.id = ar.role_id
    where ar.account_id = account.id and r.code = 'admin'
  );
