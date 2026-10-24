-- Reserve external Auth identity before contacting Auth. No credential is stored.
-- A lost response can be recovered by the immutable operation/request ID. Account
-- deletion first revokes application access and records durable Auth cleanup.
insert into public.permissions(key, module, description)
values('account.delete', 'accounts', 'Xóa tài khoản và thu hồi danh tính đăng nhập')
on conflict(key) do nothing;
insert into public.role_permissions(role_id, permission_key)
select id, 'account.delete' from public.roles where code = 'admin'
on conflict do nothing;

create table public.account_lifecycle_operations (
  request_id uuid primary key,
  kind text not null check (kind in ('provision', 'delete')),
  created_by uuid not null references public.app_accounts(id),
  payload_hash text not null,
  payload jsonb not null,
  account_id uuid not null,
  auth_user_id uuid,
  employee_id uuid,
  username text,
  login_email text,
  state text not null check (state in ('prepared', 'cleanup_required', 'completed', 'cancelled')),
  receipt jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index account_lifecycle_employee_reservation_idx
  on public.account_lifecycle_operations(employee_id)
  where kind = 'provision' and state in ('prepared', 'cleanup_required');
create unique index account_lifecycle_username_reservation_idx
  on public.account_lifecycle_operations(lower(username))
  where kind = 'provision' and state in ('prepared', 'cleanup_required');
create unique index account_lifecycle_email_reservation_idx
  on public.account_lifecycle_operations(lower(login_email))
  where kind = 'provision' and state in ('prepared', 'cleanup_required');
create unique index account_lifecycle_delete_reservation_idx
  on public.account_lifecycle_operations(account_id) where kind = 'delete';
alter table public.account_lifecycle_operations enable row level security;
revoke all on table public.account_lifecycle_operations from public, anon, authenticated, service_role;
grant select on table public.account_lifecycle_operations to service_role;

-- Helpers are private even to the service role. Every exposed command checks
-- current actor access after taking the shared lifecycle lock.
create function public.assert_account_lifecycle_actor(p_actor_id uuid, p_permission text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.app_accounts a
    join public.account_roles ar on ar.account_id = a.id
    join public.role_permissions rp on rp.role_id = ar.role_id
    where a.id = p_actor_id and a.status = 'active' and rp.permission_key = p_permission
      and not (a.metadata ? 'deleted_at')
  ) then raise exception 'ACCOUNT_ACTOR_FORBIDDEN'; end if;
end;
$$;
revoke all on function public.assert_account_lifecycle_actor(uuid,text) from public, anon, authenticated, service_role;

-- Creating a basic employee login does not grant authority to assign business
-- or administrator roles. Recovery retains the same current permission boundary.
create function public.assert_account_provision_actor(p_actor_id uuid, p_role_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.create');
  if exists(select 1 from public.roles where id = any(p_role_ids) and code <> 'employee') then
    perform public.assert_account_lifecycle_actor(p_actor_id, 'account.assign_role');
  end if;
end;
$$;
revoke all on function public.assert_account_provision_actor(uuid,uuid[]) from public, anon, authenticated, service_role;

create function public.get_account_lifecycle_operation(p_request_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_op public.account_lifecycle_operations;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id;
  if not found then
    -- Do not disclose whether an ID exists to an actor with neither permission.
    if not exists (
      select 1 from public.app_accounts a join public.account_roles ar on ar.account_id = a.id
      join public.role_permissions rp on rp.role_id = ar.role_id
      where a.id = p_actor_id and a.status = 'active'
        and rp.permission_key in ('account.create', 'account.delete') and not (a.metadata ? 'deleted_at')
    ) then raise exception 'ACCOUNT_ACTOR_FORBIDDEN'; end if;
    raise exception 'ACCOUNT_OPERATION_NOT_FOUND';
  end if;
  perform public.assert_account_lifecycle_actor(p_actor_id,
    case when v_op.kind = 'provision' then 'account.create' else 'account.delete' end);
  if v_op.kind = 'provision' then
    perform public.assert_account_provision_actor(p_actor_id,
      array(select value::uuid from jsonb_array_elements_text(v_op.payload -> 'roleIds') item(value)));
  end if;
  return v_op.receipt;
end;
$$;

create function public.list_account_lifecycle_operations(p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_create boolean; v_delete boolean; v_assign boolean; v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  select coalesce(bool_or(rp.permission_key = 'account.create'), false),
         coalesce(bool_or(rp.permission_key = 'account.delete'), false),
         coalesce(bool_or(rp.permission_key = 'account.assign_role'), false)
  into v_create, v_delete, v_assign
  from public.app_accounts a join public.account_roles ar on ar.account_id = a.id
  join public.role_permissions rp on rp.role_id = ar.role_id
  where a.id = p_actor_id and a.status = 'active' and not (a.metadata ? 'deleted_at');
  if not v_create and not v_delete then raise exception 'ACCOUNT_ACTOR_FORBIDDEN'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', request_id, 'kind', kind, 'state', state, 'accountId', account_id,
    'employeeId', employee_id, 'username', username,
    'credentialMode', payload ->> 'credentialMode', 'createdAt', created_at
  ) order by created_at, request_id), '[]'::jsonb) into v_result
  from public.account_lifecycle_operations
  where state in ('prepared', 'cleanup_required')
    and ((kind = 'provision' and v_create and (v_assign or not exists(
      select 1 from jsonb_array_elements_text(payload -> 'roleIds') item(value)
      join public.roles r on r.id = item.value::uuid where r.code <> 'employee'
    ))) or (kind = 'delete' and v_delete));
  return v_result;
end;
$$;

create function public.prepare_account_provision(
  p_request_id uuid, p_actor_id uuid, p_employee_id uuid, p_username text,
  p_primary_email text, p_phone text, p_role_ids uuid[],
  p_credential_fingerprint text, p_credential_mode text, p_event_date date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_op public.account_lifecycle_operations;
  v_employee public.employees;
  v_role_ids uuid[];
  v_username text := lower(btrim(p_username));
  v_email text := lower(btrim(p_primary_email));
  v_phone text := nullif(btrim(p_phone), '');
  v_payload jsonb;
  v_hash text;
  v_account_id uuid := gen_random_uuid();
  v_auth_id uuid := gen_random_uuid();
  v_receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.create');
  if p_request_id is null or p_employee_id is null
    or v_username is null or v_username !~ '^[a-z][a-z0-9._-]{2,31}$'
    or v_email is null or length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (v_phone is not null and length(v_phone) > 100)
    or p_credential_fingerprint is null or p_credential_fingerprint !~ '^[0-9a-f]{64}$'
    or p_credential_mode is null or p_credential_mode not in ('generated', 'provided')
    or p_event_date is null or not isfinite(p_event_date)
    or p_event_date not between date '0001-01-01' and date '9999-12-31'
  then raise exception 'ACCOUNT_INVALID_INPUT'; end if;
  select coalesce(array_agg(distinct item order by item), '{}'::uuid[]) into v_role_ids
  from unnest(coalesce(p_role_ids, '{}'::uuid[])) item;
  if cardinality(v_role_ids) = 0 then raise exception 'ROLE_REQUIRED'; end if;
  if array_position(v_role_ids, null) is not null then raise exception 'ROLE_NOT_FOUND'; end if;
  perform public.assert_account_provision_actor(p_actor_id, v_role_ids);
  v_payload := jsonb_build_object('employeeId', p_employee_id, 'username', v_username,
    'loginEmail', v_email, 'phone', v_phone, 'roleIds', to_jsonb(v_role_ids),
    'credentialFingerprint', p_credential_fingerprint, 'credentialMode', p_credential_mode);
  v_hash := encode(sha256(convert_to(jsonb_build_object('kind', 'provision', 'actorId', p_actor_id, 'payload', v_payload)::text, 'UTF8')), 'hex');
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id for update;
  if found then
    if v_op.kind <> 'provision' or v_op.created_by <> p_actor_id or v_op.payload_hash <> v_hash then
      raise exception 'ACCOUNT_OPERATION_CONFLICT';
    end if;
    return v_op.receipt;
  end if;
  select * into v_employee from public.employees where id = p_employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_employee.employment_status = 'terminated' or v_employee.profile_status = 'archived' then
    raise exception 'ACCOUNT_EMPLOYEE_INACTIVE';
  end if;
  if exists(select 1 from public.app_accounts where employee_id = p_employee_id) then
    raise exception 'EMPLOYEE_ACCOUNT_EXISTS';
  end if;
  if exists(select 1 from public.app_accounts
    where lower(username) = v_username or lower(primary_email) = v_email) then
    raise exception 'ACCOUNT_IDENTITY_EXISTS';
  end if;
  if exists(select 1 from public.account_lifecycle_operations
    where ((kind = 'provision' and state in ('prepared', 'cleanup_required'))
      or (kind = 'delete' and state = 'cleanup_required'))
      and (employee_id = p_employee_id or lower(username) = v_username or lower(login_email) = v_email)) then
    raise exception 'ACCOUNT_OPERATION_PENDING';
  end if;
  if (select count(*) from public.roles where id = any(v_role_ids)) <> cardinality(v_role_ids) then
    raise exception 'ROLE_NOT_FOUND';
  end if;
  v_payload := v_payload || jsonb_build_object('eventDate', p_event_date);
  v_receipt := jsonb_build_object('requestId', p_request_id, 'kind', 'provision', 'state', 'prepared',
    'accountId', v_account_id, 'authUserId', v_auth_id, 'employeeId', p_employee_id,
    'username', v_username, 'loginEmail', v_email,
    'credentialMode', p_credential_mode, 'credentialFingerprint', p_credential_fingerprint,
    'roleIds', v_role_ids, 'loginPhone', v_phone, 'displayName', v_employee.full_name,
    'actorId', p_actor_id, 'createdAt', now(), 'completedAt', null);
  insert into public.account_lifecycle_operations(
    request_id, kind, created_by, payload_hash, payload, account_id, auth_user_id,
    employee_id, username, login_email, state, receipt
  ) values(p_request_id, 'provision', p_actor_id, v_hash, v_payload, v_account_id, v_auth_id,
    p_employee_id, v_username, v_email, 'prepared', v_receipt);
  return v_receipt;
end;
$$;

create function public.complete_account_provision(p_request_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_op public.account_lifecycle_operations;
  v_employee public.employees;
  v_role_ids uuid[];
  v_receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.create');
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id for update;
  if not found then raise exception 'ACCOUNT_OPERATION_NOT_FOUND'; end if;
  if v_op.kind <> 'provision' then raise exception 'ACCOUNT_OPERATION_CONFLICT'; end if;
  perform public.assert_account_provision_actor(p_actor_id,
    array(select value::uuid from jsonb_array_elements_text(v_op.payload -> 'roleIds') item(value)));
  if v_op.state = 'completed' then return v_op.receipt; end if;
  if v_op.state <> 'prepared' then raise exception 'ACCOUNT_AUTH_CLEANUP_REQUIRED'; end if;
  select * into v_employee from public.employees where id = v_op.employee_id for update;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if v_employee.employment_status = 'terminated' or v_employee.profile_status = 'archived' then
    raise exception 'ACCOUNT_EMPLOYEE_INACTIVE';
  end if;
  if exists(select 1 from public.app_accounts where employee_id = v_op.employee_id) then
    raise exception 'EMPLOYEE_ACCOUNT_EXISTS';
  end if;
  if not exists(select 1 from auth.users u where u.id = v_op.auth_user_id
    and lower(u.email) = v_op.login_email
    and u.raw_app_meta_data ->> 'dtech_operation_id' = p_request_id::text) then
    raise exception 'ACCOUNT_AUTH_IDENTITY_MISMATCH';
  end if;
  select array_agg(value::uuid order by value::uuid) into v_role_ids
  from jsonb_array_elements_text(v_op.payload -> 'roleIds') value;
  if (select count(*) from public.roles where id = any(v_role_ids)) <> cardinality(v_role_ids) then
    raise exception 'ROLE_NOT_FOUND';
  end if;
  insert into public.app_accounts(id, auth_user_id, employee_id, username, display_name,
    primary_email, phone, status, activated_at)
  values(v_op.account_id, v_op.auth_user_id, v_op.employee_id, v_op.username, v_employee.full_name,
    v_op.login_email, v_op.payload ->> 'phone', 'active', now());
  insert into public.account_roles(account_id, role_id, assigned_by)
  select v_op.account_id, unnest(v_role_ids), p_actor_id;
  insert into public.employee_history_events(employee_id, event_type, event_date, actor_account_id, after_data)
  values(v_op.employee_id, 'account_provisioned', (v_op.payload ->> 'eventDate')::date, p_actor_id,
    jsonb_build_object('accountId', v_op.account_id, 'status', 'active', 'username', v_op.username,
      'roleIds', v_role_ids, 'requestId', p_request_id));
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, after_data, metadata)
  values(p_actor_id, 'account.provisioned', 'account', v_op.account_id::text,
    jsonb_build_object('employeeId', v_op.employee_id, 'status', 'active', 'roleIds', v_role_ids),
    jsonb_build_object('requestId', p_request_id, 'preparedBy', v_op.created_by));
  v_receipt := v_op.receipt || jsonb_build_object('state', 'completed', 'completedAt', now());
  update public.account_lifecycle_operations set state = 'completed', receipt = v_receipt,
    updated_at = now(), completed_at = now() where request_id = p_request_id;
  return v_receipt;
exception when unique_violation then raise exception 'ACCOUNT_IDENTITY_EXISTS';
end;
$$;

-- Cancellation is explicit. First persist cleanup intent, then remove only the
-- reserved Auth ID after checking its operation metadata in the application.
create function public.cancel_account_provision(p_request_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_op public.account_lifecycle_operations; v_receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.create');
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id for update;
  if not found then raise exception 'ACCOUNT_OPERATION_NOT_FOUND'; end if;
  if v_op.kind <> 'provision' or v_op.state = 'completed' then raise exception 'ACCOUNT_OPERATION_CONFLICT'; end if;
  perform public.assert_account_provision_actor(p_actor_id,
    array(select value::uuid from jsonb_array_elements_text(v_op.payload -> 'roleIds') item(value)));
  if v_op.state in ('cleanup_required', 'cancelled') then return v_op.receipt; end if;
  v_receipt := v_op.receipt || jsonb_build_object('state', 'cleanup_required');
  update public.account_lifecycle_operations set state = 'cleanup_required', receipt = v_receipt,
    updated_at = now() where request_id = p_request_id;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, metadata)
  values(p_actor_id, 'account.provision_cancellation_requested', 'account_operation', p_request_id::text,
    jsonb_build_object('requestId', p_request_id, 'preparedBy', v_op.created_by));
  return v_receipt;
end;
$$;

create function public.complete_account_provision_cleanup(p_request_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_op public.account_lifecycle_operations; v_receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.create');
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id for update;
  if not found then raise exception 'ACCOUNT_OPERATION_NOT_FOUND'; end if;
  if v_op.kind <> 'provision' then raise exception 'ACCOUNT_OPERATION_CONFLICT'; end if;
  perform public.assert_account_provision_actor(p_actor_id,
    array(select value::uuid from jsonb_array_elements_text(v_op.payload -> 'roleIds') item(value)));
  if v_op.state = 'cancelled' then return v_op.receipt; end if;
  if v_op.state <> 'cleanup_required' then raise exception 'ACCOUNT_OPERATION_CONFLICT'; end if;
  if exists(select 1 from auth.users where id = v_op.auth_user_id)
    or exists(select 1 from public.app_accounts where auth_user_id = v_op.auth_user_id)
  then raise exception 'ACCOUNT_AUTH_CLEANUP_REQUIRED'; end if;
  v_receipt := v_op.receipt || jsonb_build_object('state', 'cancelled', 'completedAt', now());
  update public.account_lifecycle_operations set state = 'cancelled', receipt = v_receipt,
    updated_at = now(), completed_at = now() where request_id = p_request_id;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, metadata)
  values(p_actor_id, 'account.provision_cancelled', 'account_operation', p_request_id::text,
    jsonb_build_object('requestId', p_request_id, 'preparedBy', v_op.created_by));
  return v_receipt;
end;
$$;

create function public.prepare_account_deletion(
  p_request_id uuid, p_actor_id uuid, p_account_id uuid, p_event_date date
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_op public.account_lifecycle_operations;
  v_account public.app_accounts;
  v_hash text;
  v_payload jsonb;
  v_receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.delete');
  if p_request_id is null or p_account_id is null or p_event_date is null or not isfinite(p_event_date)
    or p_event_date not between date '0001-01-01' and date '9999-12-31'
  then raise exception 'ACCOUNT_INVALID_INPUT'; end if;
  if p_account_id = p_actor_id then raise exception 'ACCOUNT_SELF_DELETE'; end if;
  v_payload := jsonb_build_object('accountId', p_account_id);
  v_hash := encode(sha256(convert_to(jsonb_build_object('kind', 'delete', 'actorId', p_actor_id, 'payload', v_payload)::text, 'UTF8')), 'hex');
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id for update;
  if found then
    if v_op.kind <> 'delete' or v_op.created_by <> p_actor_id or v_op.payload_hash <> v_hash then
      raise exception 'ACCOUNT_OPERATION_CONFLICT';
    end if;
    return v_op.receipt;
  end if;
  if exists(select 1 from public.account_lifecycle_operations where kind = 'delete' and account_id = p_account_id) then
    raise exception 'ACCOUNT_OPERATION_PENDING';
  end if;
  -- Lock order remains global -> employee -> account, matching offboarding.
  perform 1 from public.employees where id = (select employee_id from public.app_accounts where id = p_account_id) for update;
  select * into v_account from public.app_accounts where id = p_account_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if v_account.metadata ? 'deleted_at' then raise exception 'ACCOUNT_DELETED'; end if;
  if v_account.status = 'active' and exists (
    select 1 from public.account_roles ar join public.roles r on r.id = ar.role_id
    where ar.account_id = p_account_id and r.code = 'admin'
  ) and not exists (
    select 1 from public.app_accounts a join public.account_roles ar on ar.account_id = a.id
    join public.roles r on r.id = ar.role_id
    where a.id <> p_account_id and a.status = 'active' and r.code = 'admin'
      and not (a.metadata ? 'deleted_at')
  ) then raise exception 'LAST_ACTIVE_ADMIN'; end if;
  update public.app_sessions set revoked_at = now() where account_id = p_account_id and revoked_at is null;
  delete from public.account_roles where account_id = p_account_id;
  update public.app_accounts set auth_user_id = null, employee_id = null,
    username = translate(replace(id::text, '-', ''), '0123456789', 'ghijklmnop'), primary_email = null, phone = null,
    status = 'disabled', disabled_at = now(),
    metadata = metadata || jsonb_build_object('deleted_at', now(), 'deleted_by', p_actor_id,
      'deleted_employee_id', v_account.employee_id, 'deleted_username', v_account.username,
      'deleted_email', v_account.primary_email, 'deletion_request_id', p_request_id)
  where id = p_account_id;
  if v_account.employee_id is not null then
    insert into public.employee_history_events(employee_id, event_type, event_date, actor_account_id, before_data, after_data)
    values(v_account.employee_id, 'account_disabled', p_event_date, p_actor_id,
      jsonb_build_object('accountId', p_account_id, 'status', v_account.status),
      jsonb_build_object('accountId', p_account_id, 'status', 'disabled', 'deleted', true, 'requestId', p_request_id));
  end if;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, metadata)
  values(p_actor_id, 'account.deletion_prepared', 'account', p_account_id::text,
    jsonb_build_object('status', v_account.status, 'employeeId', v_account.employee_id),
    jsonb_build_object('status', 'disabled', 'deleted', true), jsonb_build_object('requestId', p_request_id));
  v_receipt := jsonb_build_object('requestId', p_request_id, 'kind', 'delete', 'state', 'cleanup_required',
    'accountId', p_account_id, 'authUserId', v_account.auth_user_id, 'employeeId', v_account.employee_id,
    'username', v_account.username, 'loginEmail', v_account.primary_email,
    'actorId', p_actor_id, 'createdAt', now(), 'completedAt', null);
  insert into public.account_lifecycle_operations(request_id, kind, created_by, payload_hash, payload,
    account_id, auth_user_id, employee_id, username, login_email, state, receipt)
  values(p_request_id, 'delete', p_actor_id, v_hash, v_payload, p_account_id, v_account.auth_user_id,
    v_account.employee_id, v_account.username, v_account.primary_email, 'cleanup_required', v_receipt);
  return v_receipt;
end;
$$;

create function public.complete_account_deletion(p_request_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_op public.account_lifecycle_operations; v_receipt jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  perform public.assert_account_lifecycle_actor(p_actor_id, 'account.delete');
  select * into v_op from public.account_lifecycle_operations where request_id = p_request_id for update;
  if not found then raise exception 'ACCOUNT_OPERATION_NOT_FOUND'; end if;
  if v_op.kind <> 'delete' then raise exception 'ACCOUNT_OPERATION_CONFLICT'; end if;
  if v_op.state = 'completed' then return v_op.receipt; end if;
  if v_op.state <> 'cleanup_required' then raise exception 'ACCOUNT_OPERATION_CONFLICT'; end if;
  if v_op.auth_user_id is not null and exists(select 1 from auth.users where id = v_op.auth_user_id) then
    raise exception 'ACCOUNT_AUTH_CLEANUP_REQUIRED';
  end if;
  v_receipt := v_op.receipt || jsonb_build_object('state', 'completed', 'completedAt', now());
  update public.account_lifecycle_operations set state = 'completed', receipt = v_receipt,
    updated_at = now(), completed_at = now() where request_id = p_request_id;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, metadata)
  values(p_actor_id, 'account.deleted', 'account', v_op.account_id::text,
    jsonb_build_object('requestId', p_request_id, 'preparedBy', v_op.created_by));
  return v_receipt;
end;
$$;

-- Existing activation and role commands must not resurrect account tombstones.
create or replace function public.apply_app_account_status_locked(
  p_account_id uuid, p_status text, p_actor_id uuid, p_reason text default null
)
returns public.app_accounts language plpgsql security definer set search_path = '' as $$
declare v_before public.app_accounts; v_after public.app_accounts;
begin
  if p_status is null or p_status not in ('pending_activation','active','disabled','locked','invited') then
    raise exception 'INVALID_STATUS';
  end if;
  select * into v_before from public.app_accounts where id = p_account_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  if v_before.metadata ? 'deleted_at' then raise exception 'ACCOUNT_DELETED'; end if;
  if v_before.status = 'active' and p_status <> 'active' and exists (
    select 1 from public.account_roles ar join public.roles r on r.id = ar.role_id
    where ar.account_id = p_account_id and r.code = 'admin'
  ) and not exists (
    select 1 from public.app_accounts a join public.account_roles ar on ar.account_id = a.id
    join public.roles r on r.id = ar.role_id
    where a.status = 'active' and a.id <> p_account_id and r.code = 'admin'
      and not (a.metadata ? 'deleted_at')
  ) then raise exception 'LAST_ACTIVE_ADMIN'; end if;
  update public.app_accounts set status = p_status::public.account_status,
    disabled_at = case when p_status = 'disabled' then now() else null end
  where id = p_account_id returning * into v_after;
  if p_status <> 'active' then
    update public.app_sessions set revoked_at = now() where account_id = p_account_id and revoked_at is null;
  end if;
  insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, reason)
  values(p_actor_id, 'account.status_updated', 'account', p_account_id::text,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_after.status), p_reason);
  return v_after;
end;
$$;

-- The existing function owns permission and final-admin checks. A private
-- trigger adds the tombstone check without duplicating or weakening that code.
create function public.guard_deleted_account_roles()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.app_accounts where id = new.account_id and metadata ? 'deleted_at') then
    raise exception 'ACCOUNT_DELETED';
  end if;
  return new;
end;
$$;
create trigger account_roles_reject_deleted_account before insert or update on public.account_roles
  for each row execute function public.guard_deleted_account_roles();
revoke all on function public.guard_deleted_account_roles() from public, anon, authenticated, service_role;
revoke all on function public.apply_app_account_status_locked(uuid,text,uuid,text) from public, anon, authenticated, service_role;
-- Old callers cannot bypass the reservation protocol.
revoke all on function public.provision_app_account(uuid,uuid,text,text,text,text,uuid[],uuid,date)
  from public, anon, authenticated, service_role;

revoke all on function public.get_account_lifecycle_operation(uuid,uuid) from public, anon, authenticated;
revoke all on function public.prepare_account_provision(uuid,uuid,uuid,text,text,text,uuid[],text,text,date) from public, anon, authenticated;
revoke all on function public.complete_account_provision(uuid,uuid) from public, anon, authenticated;
revoke all on function public.cancel_account_provision(uuid,uuid) from public, anon, authenticated;
revoke all on function public.complete_account_provision_cleanup(uuid,uuid) from public, anon, authenticated;
revoke all on function public.prepare_account_deletion(uuid,uuid,uuid,date) from public, anon, authenticated;
revoke all on function public.complete_account_deletion(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_account_lifecycle_operation(uuid,uuid) to service_role;
grant execute on function public.prepare_account_provision(uuid,uuid,uuid,text,text,text,uuid[],text,text,date) to service_role;
grant execute on function public.complete_account_provision(uuid,uuid) to service_role;
grant execute on function public.cancel_account_provision(uuid,uuid) to service_role;
grant execute on function public.complete_account_provision_cleanup(uuid,uuid) to service_role;
grant execute on function public.prepare_account_deletion(uuid,uuid,uuid,date) to service_role;
grant execute on function public.complete_account_deletion(uuid,uuid) to service_role;

revoke all on function public.list_account_lifecycle_operations(uuid) from public, anon, authenticated;
grant execute on function public.list_account_lifecycle_operations(uuid) to service_role;

-- A request cancelled while Auth is in flight must never be recreated after
-- cleanup released its reservation. This trigger only scopes our reserved
-- identity flow; normal Supabase signup/admin user creation remains unchanged.
create function public.guard_reserved_auth_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_operation_text text; v_request_id uuid; v_op public.account_lifecycle_operations;
begin
  v_operation_text := new.raw_app_meta_data ->> 'dtech_operation_id';
  if v_operation_text is null then return new; end if;
  begin
    v_request_id := v_operation_text::uuid;
  exception when invalid_text_representation then raise exception 'ACCOUNT_AUTH_IDENTITY_MISMATCH'; end;
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  select * into v_op from public.account_lifecycle_operations where request_id = v_request_id for update;
  if not found or v_op.kind <> 'provision' or v_op.state <> 'prepared'
    or v_op.auth_user_id <> new.id or lower(new.email) is distinct from v_op.login_email
  then raise exception 'ACCOUNT_AUTH_IDENTITY_MISMATCH'; end if;
  return new;
end;
$$;
create trigger dtech_reserved_auth_identity before insert on auth.users
  for each row execute function public.guard_reserved_auth_identity();
revoke all on function public.guard_reserved_auth_identity() from public, anon, authenticated, service_role;

-- Auth is deleted only after the account transaction has detached its identity.
-- This also stops older compensation code from deleting a committed account.
create function public.guard_linked_auth_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize with complete_account_provision. That command reads Auth without
  -- an Auth row lock, so holding this external row lock before the advisory lock
  -- cannot create the inverse row-lock dependency.
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if exists(select 1 from public.app_accounts where auth_user_id = old.id) then
    raise exception 'ACCOUNT_AUTH_LINKED';
  end if;
  return old;
end;
$$;
create trigger dtech_linked_auth_deletion before delete on auth.users
  for each row execute function public.guard_linked_auth_deletion();
revoke all on function public.guard_linked_auth_deletion() from public, anon, authenticated, service_role;

-- Login must serialize with access revocation. An insert before disablement is
-- revoked by that command; an insert after it waits and is rejected. Re-enabling
-- an account cannot resurrect a session created in the disabled interval.
create function public.guard_active_account_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command', 0));
  if not exists(select 1 from public.app_accounts
    where id = new.account_id and status = 'active' and not (metadata ? 'deleted_at')) then
    raise exception 'ACCOUNT_SESSION_FORBIDDEN';
  end if;
  return new;
end;
$$;
create trigger app_sessions_require_active_account before insert on public.app_sessions
  for each row execute function public.guard_active_account_session();
revoke all on function public.guard_active_account_session() from public, anon, authenticated, service_role;
