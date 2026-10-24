select jsonb_build_object(
 'industryCount',(select count(*) from public.business_industry_packs),
 'entityCount',(select count(*) from public.business_entity_definitions),
 'tenantCount',(select count(*) from public.business_tenants),
 'accountCount',(select count(*) from public.business_accounts),
 'sessionCount',(select count(*) from public.business_sessions),
 'commandCount',(select count(*) from public.business_commands),
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,
 'anonSelect',has_table_privilege('anon',c.oid,'SELECT'),'authenticatedSelect',has_table_privilege('authenticated',c.oid,'SELECT'),
 'serviceSelect',has_table_privilege('service_role',c.oid,'SELECT'),'serviceWrite',has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE')) order by c.relname)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'business_%'),
 'functions',(select jsonb_agg(jsonb_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,
 'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.proname)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'business_%')
) evidence;
