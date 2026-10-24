select
  (select count(*) from supabase_migrations.schema_migrations) as applied_migrations,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p')) as public_tables,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity) as tables_with_rls,
  (select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity) as tables_without_rls,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from auth.users) as auth_users,
  (select value->>'systemName' from public.system_settings where group_key = 'branding') as system_name;
