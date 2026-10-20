-- Managed TEST identity repair only. Run inside the guarded TEST transaction.
-- No inventory, receipts, credentials, sessions or production roles are changed.
do $repair_import_warehouse_access$
declare
  v_account_id uuid := '8e29b137-f054-4c86-8db4-3ebd9c6c5e73';
  v_role_id uuid;
  v_warehouse_id uuid := 'e3000000-0000-4000-8000-000000000001';
begin
  if not exists (
    select 1 from supabase_migrations.ct_test_bootstrap
    where key = 'owner'
      and value->>'owner' = 'ct-noibo-test-v1'
      and value->>'projectId' = 'lgmlkagcytfjazulgfbz'
  ) then
    raise exception 'TEST_IMPORT_REPAIR_TARGET_MISMATCH';
  end if;

  if not exists (
    select 1 from public.app_accounts
    where id = v_account_id and username = 'import.test' and status = 'active'
      and metadata->>'testOwner' = 'ct-noibo-test-v1'
      and metadata->>'testTarget' = 'https://lgmlkagcytfjazulgfbz.supabase.co/'
  ) then
    raise exception 'TEST_IMPORT_REPAIR_ACCOUNT_MISMATCH';
  end if;

  select role.id into v_role_id
  from public.roles role
  join public.account_roles assignment on assignment.role_id = role.id
  where assignment.account_id = v_account_id
    and role.code = 'qa_import' and role.name = '[TEST] Xuất nhập khẩu'
    and role.is_system = false;
  if v_role_id is null or (
    select count(*) from public.account_roles where account_id = v_account_id
  ) <> 1 then
    raise exception 'TEST_IMPORT_REPAIR_ROLE_MISMATCH';
  end if;
  if exists (
    select 1 from public.account_roles assignment
    join public.app_accounts account on account.id = assignment.account_id
    where assignment.role_id = v_role_id and (
      account.metadata->>'testOwner' is distinct from 'ct-noibo-test-v1'
      or account.metadata->>'testTarget' is distinct from 'https://lgmlkagcytfjazulgfbz.supabase.co/'
    )
  ) then
    raise exception 'TEST_IMPORT_REPAIR_ROLE_NOT_MANAGED';
  end if;

  if not exists (
    select 1 from public.warehouses
    where id = v_warehouse_id and code = 'KHO-CHINH' and status = 'active'
  ) then
    raise exception 'TEST_IMPORT_REPAIR_WAREHOUSE_MISMATCH';
  end if;
  if (select count(*) from public.permissions where key in ('warehouse.view', 'warehouse.item.view')) <> 2 then
    raise exception 'TEST_IMPORT_REPAIR_PERMISSIONS_MISSING';
  end if;

  insert into public.role_permissions(role_id, permission_key)
  values (v_role_id, 'warehouse.view'), (v_role_id, 'warehouse.item.view')
  on conflict do nothing;

  insert into public.warehouse_user_scopes(account_id, warehouse_id, can_view, can_operate)
  values (v_account_id, v_warehouse_id, true, true)
  on conflict (account_id, warehouse_id) do update
    set can_view = true, can_operate = true
    where not warehouse_user_scopes.can_view or not warehouse_user_scopes.can_operate;
end $repair_import_warehouse_access$;
