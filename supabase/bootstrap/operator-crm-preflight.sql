-- Metadata only. No customer identities or credentials are returned.
select jsonb_build_object(
 'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
 'latestMigration',(select max(version) from supabase_migrations.schema_migrations),
 'accounts',(select count(*) from public.app_accounts),'authUsers',(select count(*) from auth.users),
 'employees',(select count(*) from public.employees),'employeeHistoryEvents',(select count(*) from public.employee_history_events),
 'projects',(select count(*) from public.projects),'inventoryItems',(select count(*) from public.inventory_items),'warehouses',(select count(*) from public.warehouses),
 'settingsVersions',(select jsonb_object_agg(group_key,version) from public.system_settings),
 'permissions',(select count(*) from public.permissions),'roles',(select count(*) from public.roles),
 'trialCount',(select count(*) from public.product_trial_requests),
 'customerTableExists',to_regclass('public.crm_customers') is not null
) as evidence;
