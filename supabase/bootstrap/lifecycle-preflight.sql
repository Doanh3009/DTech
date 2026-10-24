-- Metadata only, before and after the development rollout. No identities or PII.
select jsonb_build_object(
  'postgresVersion', current_setting('server_version'),
  'migrationCount', (select count(*) from supabase_migrations.schema_migrations),
  'latestMigration', (select max(version) from supabase_migrations.schema_migrations),
  'accounts', (select count(*) from public.app_accounts),
  'activeAccounts', (select count(*) from public.app_accounts where status = 'active'),
  'deletedAccounts', (select count(*) from public.app_accounts where metadata ? 'deleted_at'),
  'authUsers', (select count(*) from auth.users),
  'employees', (select count(*) from public.employees),
  'employeeHistoryEvents', (select count(*) from public.employee_history_events),
  'legacyRecoveriesPending', (select count(*) from public.account_provisioning_recoveries where status = 'cleanup_required'),
  'permissions', (select count(*) from public.permissions),
  'roles', (select count(*) from public.roles),
  'deletePermissionExists', exists(select 1 from public.permissions where key = 'account.delete'),
  'rolesGrantedDelete', (select count(*) from public.role_permissions where permission_key = 'account.delete'),
  'operationsTableExists', to_regclass('public.account_lifecycle_operations') is not null,
  'projects', (select count(*) from public.projects),
  'inventoryItems', (select count(*) from public.inventory_items),
  'warehouses', (select count(*) from public.warehouses),
  'settingsVersions', (select jsonb_object_agg(group_key,version) from public.system_settings),
  'lifecycleTriggers', (select coalesce(jsonb_agg(jsonb_build_object(
    'name', t.tgname, 'enabled', t.tgenabled, 'schema', n.nspname, 'table', c.relname
  ) order by t.tgname), '[]'::jsonb)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and t.tgname in ('dtech_reserved_auth_identity', 'dtech_linked_auth_deletion', 'app_sessions_require_active_account', 'account_roles_reject_deleted_account'))
) as evidence;
