-- TEST role repair only. Preserve HR onboarding, attendance and leave permissions.
-- The standard HR role is shared by TEST identities; no account assignments change.
do $repair_hr_role_access$
declare
  v_account_id constant uuid := '0591cdfa-ca84-47d1-887a-51277d68e93e';
  v_role_id constant uuid := '9dbdceb7-7361-4889-b00b-a4c183212d15';
  v_removed_keys constant text[] := array['account.assign_role','role.view','permission.view','audit.view'];
  v_preserved_permissions jsonb;
  v_account_roles jsonb;
  v_roles jsonb;
begin
  if not exists (
    select 1 from supabase_migrations.ct_test_bootstrap
    where key = 'owner' and value->>'owner' = 'ct-noibo-test-v1'
      and value->>'projectId' = 'lgmlkagcytfjazulgfbz'
  ) or not exists (
    select 1 from public.app_configurations
    where key = 'testing.environment.guard' and value->>'owner' = 'ct-noibo-test-v1'
      and value->>'projectId' = 'lgmlkagcytfjazulgfbz'
      and value->>'target' = 'https://lgmlkagcytfjazulgfbz.supabase.co/'
  ) then
    raise exception 'TEST_HR_REPAIR_TARGET_MISMATCH';
  end if;
  if not exists (
    select 1 from public.app_accounts
    where id = v_account_id and username = 'hr.test' and status = 'active'
      and metadata->>'testOwner' = 'ct-noibo-test-v1'
      and metadata->>'testTarget' = 'https://lgmlkagcytfjazulgfbz.supabase.co/'
  ) then
    raise exception 'TEST_HR_REPAIR_ACCOUNT_MISMATCH';
  end if;
  if not exists (
    select 1 from public.roles role join public.account_roles assignment on assignment.role_id = role.id
    where role.id = v_role_id and role.code = 'hr' and role.name = 'HR'
      and role.is_system and assignment.account_id = v_account_id
  ) or (select count(*) from public.account_roles where account_id = v_account_id) <> 1 then
    raise exception 'TEST_HR_REPAIR_ROLE_MISMATCH';
  end if;
  if (select count(*) from public.role_permissions where role_id = v_role_id and permission_key in (
    'account.create','account.view','account.disable','attendance.config.view','attendance.config.manage',
    'employee.view','employee.create','employee.edit','leave.approve','leave.view_all'
  )) <> 10 then
    raise exception 'TEST_HR_REPAIR_REQUIRED_PERMISSIONS_MISSING';
  end if;
  select coalesce(jsonb_agg(to_jsonb(permission) order by role_id,permission_key),'[]'::jsonb)
    into v_preserved_permissions from public.role_permissions permission
    where not (role_id = v_role_id and permission_key = any(v_removed_keys));
  select coalesce(jsonb_agg(to_jsonb(assignment) order by account_id,role_id),'[]'::jsonb)
    into v_account_roles from public.account_roles assignment;
  select coalesce(jsonb_agg(to_jsonb(role) order by id),'[]'::jsonb) into v_roles from public.roles role;

  delete from public.role_permissions where role_id = v_role_id and permission_key = any(v_removed_keys);

  if v_preserved_permissions is distinct from (
    select coalesce(jsonb_agg(to_jsonb(permission) order by role_id,permission_key),'[]'::jsonb)
    from public.role_permissions permission
  ) or v_account_roles is distinct from (
    select coalesce(jsonb_agg(to_jsonb(assignment) order by account_id,role_id),'[]'::jsonb)
    from public.account_roles assignment
  ) or v_roles is distinct from (
    select coalesce(jsonb_agg(to_jsonb(role) order by id),'[]'::jsonb) from public.roles role
  ) then
    raise exception 'TEST_HR_REPAIR_PRESERVATION_FAILED';
  end if;
end $repair_hr_role_access$;
