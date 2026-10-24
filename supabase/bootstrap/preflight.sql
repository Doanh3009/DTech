-- Read-only inventory before initializing the user-selected ERP database.
select
  current_database() as database_name,
  current_user as database_role,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as public_table_count,
  (select coalesce(jsonb_agg(table_name order by table_name), '[]'::jsonb) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as public_tables,
  (select count(*) from auth.users) as auth_user_count,
  (select count(*) from storage.buckets) as storage_bucket_count,
  to_regclass('supabase_migrations.schema_migrations')::text as migrations_table;
