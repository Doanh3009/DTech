-- Counts/config versions only; never return lead contents or account identifiers.
select jsonb_build_object(
 'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
 'latestMigration',(select max(version) from supabase_migrations.schema_migrations),
 'accounts',(select count(*) from public.app_accounts),
 'activeAccounts',(select count(*) from public.app_accounts where status='active'),
 'authUsers',(select count(*) from auth.users),
 'employees',(select count(*) from public.employees),
 'employeeHistoryEvents',(select count(*) from public.employee_history_events),
 'projects',(select count(*) from public.projects),
 'inventoryItems',(select count(*) from public.inventory_items),
 'warehouses',(select count(*) from public.warehouses),
 'permissions',(select count(*) from public.permissions),
 'settingsVersions',(select jsonb_object_agg(group_key,version) from public.system_settings),
 'trialTableExists',to_regclass('public.product_trial_requests') is not null
) as evidence;
