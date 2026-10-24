-- Read-only evidence; no names, emails, passwords or business documents are returned.
select jsonb_build_object(
 'migrationCount',(select count(*) from supabase_migrations.schema_migrations),
 'latestMigration',(select max(version) from supabase_migrations.schema_migrations),
 'businessTableExists',to_regclass('public.business_tenants') is not null,
 'accounts',(select count(*) from public.app_accounts),
 'authUsers',(select count(*) from auth.users),
 'employees',(select count(*) from public.employees),
 'projects',(select count(*) from public.projects),
 'inventoryItems',(select count(*) from public.inventory_items),
 'warehouses',(select count(*) from public.warehouses),
 'customers',(select count(*) from public.crm_customers),
 'activities',(select count(*) from public.crm_activities),
 'trials',(select count(*) from public.product_trial_requests),
 'customerHash',md5(coalesce((select jsonb_agg(to_jsonb(t) order by id)::text from public.crm_customers t),'[]')),
 'trialHash',md5(coalesce((select jsonb_agg(to_jsonb(t) order by request_id)::text from public.product_trial_requests t),'[]')),
 'settingsHash',md5(coalesce((select jsonb_agg(to_jsonb(t) order by group_key)::text from public.system_settings t),'[]'))
) evidence;
