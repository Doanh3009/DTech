-- Synthetic local integration data only. The runner applies real foundation,
-- HR, account and session migrations before this fixture; this file does not
-- connect to or seed any customer/Supabase database.
insert into public.departments(id,code,name) values
  ('d0000000-0000-4000-8000-000000000001','INTEGRATION','Integration');
insert into public.positions(id,code,name,department_id) values
  ('e0000000-0000-4000-8000-000000000001','INTEGRATION','Integration','d0000000-0000-4000-8000-000000000001');
insert into public.employment_types(id,code,name,worker_category) values
  ('f0000000-0000-4000-8000-000000000001','INTEGRATION','Integration','office');

insert into public.roles(id,code,name) values
  ('10000000-0000-4000-8000-000000000010','integration_editor','Integration editor'),
  ('10000000-0000-4000-8000-000000000011','integration_offboard','Integration offboard'),
  ('10000000-0000-4000-8000-000000000012','integration_accounts','Integration accounts');
insert into public.role_permissions(role_id,permission_key) values
  ('10000000-0000-4000-8000-000000000010','employee.edit'),
  ('10000000-0000-4000-8000-000000000011','employee.offboard'),
  ('10000000-0000-4000-8000-000000000012','account.enable'),
  ('10000000-0000-4000-8000-000000000012','account.disable'),
  ('10000000-0000-4000-8000-000000000012','account.assign_role'),
  ('10000000-0000-4000-8000-000000000012','account.create');

insert into public.employees(id,employee_code,full_name,department_id,position_id,employment_type_id,join_date,profile_status)
select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'INTEGRATION-'||n,'Integration employee '||n,
  'd0000000-0000-4000-8000-000000000001',
  'e0000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001','2026-01-01','complete'
from generate_series(1,14) n;

insert into public.app_accounts(id,employee_id,username,display_name,status)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'integration_'||n,'Integration account '||n,
  (case when n=13 then 'disabled' else 'active' end)::public.account_status
from unnest(array[1,2,3,10,11,12,13,14]) n;
insert into public.account_roles(account_id,role_id)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r.id
from unnest(array[1,2,13]) n cross join public.roles r where r.code='admin';
insert into public.account_roles(account_id,role_id)
select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,r.id
from unnest(array[3,12]) n cross join public.roles r where r.code='employee';
insert into public.account_roles(account_id,role_id) values
  ('20000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000010'),
  ('20000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000011'),
  ('20000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000012');

insert into public.app_sessions(id,account_id,refresh_token_hash,expires_at,revoked_at)
select 'integration-session-'||lpad(n::text,16,'0'),
  '20000000-0000-4000-8000-000000000003',repeat('a',64),
  now()+interval '1 day',case when n=3 then now()-interval '1 hour' else null end
from generate_series(1,3) n;
insert into public.app_sessions(id,account_id,refresh_token_hash,expires_at)
values('integration-admin-session-00000001','20000000-0000-4000-8000-000000000001',repeat('b',64),now()+interval '1 day');
