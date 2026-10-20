-- Personnel records are managed by HR. Field supervisors keep their scoped
-- project roster and self-service access without the company-wide HR directory.
delete from public.role_permissions assignment
using public.roles role
where assignment.role_id = role.id
  and role.code = 'supervisor'
  and assignment.permission_key = 'employee.view';

-- Explicit personal timesheet access for employees, including installations
-- that only granted the legacy entry permission timesheet.view.
insert into public.role_permissions (role_id, permission_key)
select role.id, permission.key
from public.roles role
join public.permissions permission on permission.key = 'timesheet.self.view'
where role.code = 'employee'
on conflict do nothing;
