-- Service ACL, private helper ACL and empty operation queue; read-only.
with commands(signature, exposed) as (values
  ('public.get_account_lifecycle_operation(uuid,uuid)', true),
  ('public.list_account_lifecycle_operations(uuid)', true),
  ('public.prepare_account_provision(uuid,uuid,uuid,text,text,text,uuid[],text,text,date)', true),
  ('public.complete_account_provision(uuid,uuid)', true),
  ('public.cancel_account_provision(uuid,uuid)', true),
  ('public.complete_account_provision_cleanup(uuid,uuid)', true),
  ('public.prepare_account_deletion(uuid,uuid,uuid,date)', true),
  ('public.complete_account_deletion(uuid,uuid)', true),
  ('public.patch_employee_sensitive_command(uuid,integer,jsonb,uuid,date,text)', true),
  ('public.archive_employee_command(uuid,integer,uuid,date,text)', true),
  ('public.assert_account_lifecycle_actor(uuid,text)', false),
  ('public.assert_account_provision_actor(uuid,uuid[])', false),
  ('public.apply_app_account_status_locked(uuid,text,uuid,text)', false),
  ('public.guard_deleted_account_roles()', false),
  ('public.guard_reserved_auth_identity()', false),
  ('public.guard_linked_auth_deletion()', false),
  ('public.guard_active_account_session()', false)
)
select jsonb_build_object(
  'operationsRls', (select relrowsecurity from pg_class where oid = 'public.account_lifecycle_operations'::regclass),
  'operationCount', (select count(*) from public.account_lifecycle_operations),
  'serviceCanReadOperations', has_table_privilege('service_role','public.account_lifecycle_operations','SELECT'),
  'serviceCanInsertOperations', has_table_privilege('service_role','public.account_lifecycle_operations','INSERT'),
  'serviceCanUpdateOperations', has_table_privilege('service_role','public.account_lifecycle_operations','UPDATE'),
  'serviceCanDeleteOperations', has_table_privilege('service_role','public.account_lifecycle_operations','DELETE'),
  'anonCanReadOperations', has_table_privilege('anon','public.account_lifecycle_operations','SELECT'),
  'authenticatedCanReadOperations', has_table_privilege('authenticated','public.account_lifecycle_operations','SELECT'),
  'legacyProvisionServiceExecute', has_function_privilege('service_role','public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date)','EXECUTE'),
  'commands', (select jsonb_agg(jsonb_build_object(
    'signature', c.signature, 'exposed', c.exposed, 'exists', p.oid is not null,
    'securityDefiner', p.prosecdef, 'config', p.proconfig,
    'serviceExecute', case when p.oid is not null then has_function_privilege('service_role',p.oid,'EXECUTE') end,
    'anonExecute', case when p.oid is not null then has_function_privilege('anon',p.oid,'EXECUTE') end,
    'authenticatedExecute', case when p.oid is not null then has_function_privilege('authenticated',p.oid,'EXECUTE') end
  ) order by c.signature)
  from commands c left join pg_proc p on p.oid = to_regprocedure(c.signature))
) as evidence;
