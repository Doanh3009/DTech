select jsonb_build_object(
 'trialCount',(select count(*) from public.product_trial_requests),
 'rls',(select relrowsecurity from pg_class where oid='public.product_trial_requests'::regclass),
 'serviceSelect',has_table_privilege('service_role','public.product_trial_requests','SELECT'),
 'serviceWrite',has_table_privilege('service_role','public.product_trial_requests','INSERT,UPDATE,DELETE'),
 'anonSelect',has_table_privilege('anon','public.product_trial_requests','SELECT'),
 'authenticatedSelect',has_table_privilege('authenticated','public.product_trial_requests','SELECT'),
 'grantedRoles',(select jsonb_agg(jsonb_build_object('role',r.code,'permission',rp.permission_key) order by rp.permission_key,r.code) from public.role_permissions rp join public.roles r on r.id=rp.role_id where rp.permission_key in ('trial_request.view','trial_request.manage')),
 'commands',(select jsonb_agg(jsonb_build_object('name',p.proname,'securityDefiner',p.prosecdef,'config',p.proconfig,'serviceExecute',has_function_privilege('service_role',p.oid,'EXECUTE'),'anonExecute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticatedExecute',has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('submit_product_trial_request','review_product_trial_request'))
) as evidence;
