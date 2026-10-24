-- Read-only metadata for the explicitly selected DTech ERP deployment.
select jsonb_build_object(
  'postgresVersion', current_setting('server_version'),
  'migrationCount', (select count(*) from supabase_migrations.schema_migrations),
  'latestMigration', (select max(version) from supabase_migrations.schema_migrations),
  'commandsTableExists', to_regclass('public.system_settings_commands') is not null,
  'commandExists', to_regprocedure('public.publish_system_settings_command(uuid,uuid,jsonb,jsonb,text)') is not null,
  'versions', (select jsonb_object_agg(group_key, version) from public.system_settings),
  'auditColumns', (select jsonb_agg(jsonb_build_object('name', column_name, 'type', data_type,
      'nullable', is_nullable, 'default', column_default) order by ordinal_position)
    from information_schema.columns where table_schema = 'public' and table_name = 'audit_logs'),
  'activeAccounts', (select count(*) from public.app_accounts where status = 'active'),
  'projects', (select count(*) from public.projects),
  'inventoryItems', (select count(*) from public.inventory_items),
  'warehouses', (select count(*) from public.warehouses)
) as preflight;
