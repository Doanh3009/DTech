-- Read-only pre/post rollout evidence. No employee bodies or identifiers.
with commands(signature, private_helper) as (values
  ('public.patch_employee_profile_command(uuid,integer,jsonb,uuid,date,text)', false),
  ('public.set_app_account_status(uuid,text,uuid,text)', false),
  ('public.replace_app_account_roles(uuid,uuid[],uuid)', false),
  ('public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date)', false),
  ('public.apply_app_account_status_locked(uuid,text,uuid,text)', true)
)
select jsonb_build_object(
  'postgresVersion', current_setting('server_version'),
  'migrationCount', (select count(*) from supabase_migrations.schema_migrations),
  'latestMigration', (select max(version) from supabase_migrations.schema_migrations),
  'activeAccounts', (select count(*) from public.app_accounts where status = 'active'),
  'accounts', (select count(*) from public.app_accounts),
  'employees', (select count(*) from public.employees),
  'terminatedEmployees', (select count(*) from public.employees where employment_status = 'terminated'),
  'employeeHistoryEvents', (select count(*) from public.employee_history_events),
  'projects', (select count(*) from public.projects),
  'inventoryItems', (select count(*) from public.inventory_items),
  'warehouses', (select count(*) from public.warehouses),
  'settingsVersions', (select jsonb_object_agg(group_key, version) from public.system_settings),
  'commands', (select jsonb_agg(jsonb_build_object(
    'signature', c.signature,
    'exists', p.oid is not null,
    'privateHelper', c.private_helper,
    'securityDefiner', p.prosecdef,
    'config', p.proconfig,
    'serviceCanExecute', case when p.oid is not null then has_function_privilege('service_role', p.oid, 'EXECUTE') end,
    'anonCanExecute', case when p.oid is not null then has_function_privilege('anon', p.oid, 'EXECUTE') end,
    'authenticatedCanExecute', case when p.oid is not null then has_function_privilege('authenticated', p.oid, 'EXECUTE') end,
    'hasLifecycleLock', case when p.oid is not null then position('dtech:account-lifecycle-command' in p.prosrc) > 0 end
  ) order by c.signature)
  from commands c left join pg_proc p on p.oid = to_regprocedure(c.signature))
) as evidence;
