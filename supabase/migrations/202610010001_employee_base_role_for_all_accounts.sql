-- Employee is the default business role. Self-service access for linked employees
-- is resolved by the application and must not be duplicated on every account.
insert into public.role_permissions (role_id, permission_key)
select role.id, permission.key
from public.roles role
join public.permissions permission on permission.key = any (array[
  'dashboard.view', 'profile.view', 'notification.view', 'attendance.view',
  'attendance.self.view', 'attendance.self.create',
  'attendance.self', 'attendance.self_history', 'attendance.self_request',
  'payslip.self.view', 'timesheet.view', 'leave.view', 'chat.access', 'file.read'
])
where role.code = 'employee'
on conflict do nothing;

insert into public.account_roles (account_id, role_id)
select account.id, role.id
from public.app_accounts account
cross join public.roles role
where role.code = 'employee'
  and account.employee_id is not null
  and not exists (
    select 1 from public.account_roles assignment
    where assignment.account_id = account.id
  )
on conflict do nothing;
