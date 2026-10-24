-- Read-only post-migration checks; does not execute a settings command.
select jsonb_build_object(
  'migrationCount', (select count(*) from supabase_migrations.schema_migrations),
  'latestMigration', (select max(version) from supabase_migrations.schema_migrations),
  'commandsRls', (select relrowsecurity from pg_class where oid = 'public.system_settings_commands'::regclass),
  'serviceCanReadReceipt', has_table_privilege('service_role', 'public.system_settings_commands', 'SELECT'),
  'serviceCanInsertReceipt', has_table_privilege('service_role', 'public.system_settings_commands', 'INSERT'),
  'serviceCanUpdateReceipt', has_table_privilege('service_role', 'public.system_settings_commands', 'UPDATE'),
  'serviceCanDeleteReceipt', has_table_privilege('service_role', 'public.system_settings_commands', 'DELETE'),
  'serviceCanExecute', has_function_privilege('service_role', 'public.publish_system_settings_command(uuid,uuid,jsonb,jsonb,text)', 'EXECUTE'),
  'anonymousCanExecute', has_function_privilege('anon', 'public.publish_system_settings_command(uuid,uuid,jsonb,jsonb,text)', 'EXECUTE'),
  'authenticatedCanExecute', has_function_privilege('authenticated', 'public.publish_system_settings_command(uuid,uuid,jsonb,jsonb,text)', 'EXECUTE'),
  'versions', (select jsonb_object_agg(group_key, version) from public.system_settings),
  'commandCount', (select count(*) from public.system_settings_commands),
  'activeAccounts', (select count(*) from public.app_accounts where status = 'active'),
  'projects', (select count(*) from public.projects),
  'inventoryItems', (select count(*) from public.inventory_items),
  'warehouses', (select count(*) from public.warehouses)
) as verification;
