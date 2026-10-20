-- Production hardening: authenticated sessions, login throttling, operational jobs and migration evidence.
create table if not exists public.app_sessions (
  id text primary key check (length(id) between 32 and 128),
  account_id uuid not null references public.app_accounts(id) on delete cascade,
  refresh_token_hash text not null check (length(refresh_token_hash) = 64),
  ip_hash text check (ip_hash is null or length(ip_hash) = 64),
  user_agent text check (user_agent is null or length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index if not exists app_sessions_account_active_idx on public.app_sessions(account_id, expires_at desc) where revoked_at is null;

create table if not exists public.auth_login_attempts (
  key_hash text primary key check (length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.check_auth_login_allowed(p_key_hash text)
returns boolean language sql security definer set search_path=public as $$
  select not exists(select 1 from auth_login_attempts where key_hash=p_key_hash and blocked_until > now());
$$;

create or replace function public.record_auth_login_result(p_key_hash text, p_succeeded boolean)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_succeeded then delete from auth_login_attempts where key_hash=p_key_hash; return; end if;
  insert into auth_login_attempts(key_hash,window_started_at,failure_count,blocked_until,updated_at)
  values(p_key_hash,now(),1,null,now())
  on conflict(key_hash) do update set
    window_started_at=case when auth_login_attempts.window_started_at < now()-interval '15 minutes' then now() else auth_login_attempts.window_started_at end,
    failure_count=case when auth_login_attempts.window_started_at < now()-interval '15 minutes' then 1 else auth_login_attempts.failure_count+1 end,
    blocked_until=case when (case when auth_login_attempts.window_started_at < now()-interval '15 minutes' then 1 else auth_login_attempts.failure_count+1 end)>=5 then now()+interval '15 minutes' else auth_login_attempts.blocked_until end,
    updated_at=now();
end;
$$;

revoke all on function public.check_auth_login_allowed(text) from public, anon, authenticated;
revoke all on function public.record_auth_login_result(text,boolean) from public, anon, authenticated;
grant execute on function public.check_auth_login_allowed(text) to service_role;
grant execute on function public.record_auth_login_result(text,boolean) to service_role;

create or replace function public.set_app_account_status(p_account_id uuid,p_status text,p_actor_id uuid,p_reason text default null)
returns public.app_accounts language plpgsql security definer set search_path=public as $$
declare v_before app_accounts;v_after app_accounts;v_is_admin boolean;v_other_admins integer;
begin
  select * into v_before from app_accounts where id=p_account_id for update;if not found then raise exception 'ACCOUNT_NOT_FOUND';end if;
  if p_status not in ('pending_activation','active','disabled','locked','invited') then raise exception 'INVALID_STATUS';end if;
  select exists(select 1 from account_roles ar join roles r on r.id=ar.role_id where ar.account_id=p_account_id and r.code='admin') into v_is_admin;
  if v_is_admin and p_status<>'active' then select count(distinct a.id) into v_other_admins from app_accounts a join account_roles ar on ar.account_id=a.id join roles r on r.id=ar.role_id where r.code='admin' and a.status='active' and a.id<>p_account_id;if v_other_admins=0 then raise exception 'LAST_ACTIVE_ADMIN';end if;end if;
  update app_accounts set status=p_status::account_status,disabled_at=case when p_status='disabled' then now() else null end where id=p_account_id returning * into v_after;
  if p_status<>'active' then update app_sessions set revoked_at=now() where account_id=p_account_id and revoked_at is null;end if;
  insert into audit_logs(actor_account_id,action,entity_type,entity_id,before_data,after_data,reason) values(p_actor_id,'account.status_updated','account',p_account_id::text,jsonb_build_object('status',v_before.status),jsonb_build_object('status',v_after.status),p_reason);
  return v_after;
end;$$;

create or replace function public.replace_app_account_roles(p_account_id uuid,p_role_ids uuid[],p_actor_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_was_admin boolean;v_will_admin boolean;v_other_admins integer;v_before jsonb;
begin
  if coalesce(array_length(p_role_ids,1),0)=0 then raise exception 'ROLE_REQUIRED';end if;
  if (select count(*) from roles where id=any(p_role_ids))<>array_length(p_role_ids,1) then raise exception 'ROLE_NOT_FOUND';end if;
  select coalesce(jsonb_agg(role_id), '[]'::jsonb),bool_or(r.code='admin') into v_before,v_was_admin from account_roles ar join roles r on r.id=ar.role_id where ar.account_id=p_account_id;
  select exists(select 1 from roles where id=any(p_role_ids) and code='admin') into v_will_admin;
  if coalesce(v_was_admin,false) and not v_will_admin then select count(distinct a.id) into v_other_admins from app_accounts a join account_roles ar on ar.account_id=a.id join roles r on r.id=ar.role_id where r.code='admin' and a.status='active' and a.id<>p_account_id;if v_other_admins=0 then raise exception 'LAST_ACTIVE_ADMIN';end if;end if;
  delete from account_roles where account_id=p_account_id;insert into account_roles(account_id,role_id,assigned_by) select p_account_id,unnest(p_role_ids),p_actor_id;
  insert into audit_logs(actor_account_id,action,entity_type,entity_id,before_data,after_data) values(p_actor_id,'account.roles_updated','account',p_account_id::text,jsonb_build_object('roleIds',v_before),jsonb_build_object('roleIds',to_jsonb(p_role_ids)));
end;$$;
revoke all on function public.set_app_account_status(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.replace_app_account_roles(uuid,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.set_app_account_status(uuid,text,uuid,text) to service_role;
grant execute on function public.replace_app_account_roles(uuid,uuid[],uuid) to service_role;

create or replace function public.update_role_definition(p_role_id uuid,p_code text,p_name text,p_description text,p_permission_keys text[],p_actor_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_role roles;v_unknown integer;
begin
  select * into v_role from roles where id=p_role_id for update;if not found then raise exception 'ROLE_NOT_FOUND';end if;
  if v_role.is_system and p_code<>v_role.code then raise exception 'SYSTEM_ROLE_CODE_IMMUTABLE';end if;
  select count(*) into v_unknown from unnest(p_permission_keys) k left join permissions p on p.key=k where p.key is null;if v_unknown>0 then raise exception 'UNKNOWN_PERMISSION';end if;
  if v_role.code='admin' and not ('system_admin.access'=any(p_permission_keys)) then raise exception 'ADMIN_ACCESS_REQUIRED';end if;
  update roles set code=p_code,name=p_name,description=p_description where id=p_role_id;
  delete from role_permissions where role_id=p_role_id;insert into role_permissions(role_id,permission_key) select p_role_id,unnest(p_permission_keys);
  insert into audit_logs(actor_account_id,action,entity_type,entity_id,after_data) values(p_actor_id,'role.updated','role',p_role_id::text,jsonb_build_object('code',p_code,'name',p_name,'permissionKeys',p_permission_keys));
end;$$;
revoke all on function public.update_role_definition(uuid,text,text,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.update_role_definition(uuid,text,text,text,text[],uuid) to service_role;

create table if not exists public.operational_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  idempotency_key text not null,
  status text not null check(status in ('running','completed','failed','skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  created_by uuid references public.app_accounts(id),
  unique(job_key,idempotency_key)
);
create unique index if not exists operational_job_one_running_idx on public.operational_job_runs(job_key) where status='running';
create index if not exists operational_job_status_time_idx on public.operational_job_runs(status,started_at desc);

create table if not exists public.data_migration_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_checksum text not null,
  entity_type text not null,
  mode text not null check(mode in ('dry_run','execute')),
  status text not null check(status in ('created','validating','validated','running','completed','failed','reconciled')),
  rows_total integer not null default 0 check(rows_total>=0),
  rows_valid integer not null default 0 check(rows_valid>=0),
  rows_invalid integer not null default 0 check(rows_invalid>=0),
  rows_written integer not null default 0 check(rows_written>=0),
  requested_by uuid references public.app_accounts(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(source_checksum,entity_type,mode)
);
create table if not exists public.data_migration_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.data_migration_batches(id) on delete cascade,
  row_number integer not null check(row_number>0),
  source_key text,
  field text,
  error_code text not null,
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists data_migration_errors_batch_idx on public.data_migration_errors(batch_id,row_number);

insert into public.permissions(key,module,description) values
  ('operations.view','operations','Xem tình trạng vận hành'),
  ('operations.run','operations','Chạy kiểm tra vận hành'),
  ('jobs.retry','operations','Thử lại job lỗi')
on conflict(key) do update set module=excluded.module,description=excluded.description;
insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in ('operations.view','operations.run','jobs.retry') where r.code='admin'
on conflict do nothing;

create index if not exists app_accounts_auth_status_idx on public.app_accounts(auth_user_id,status);
create index if not exists report_exports_status_requested_idx on public.report_exports(status,requested_at);
create index if not exists integration_sync_jobs_status_created_idx on public.integration_sync_jobs(status,created_at);
create index if not exists import_jobs_status_created_idx on public.import_jobs(status,created_at);
create index if not exists approval_cases_status_submitted_idx on public.approval_cases(status,submitted_at desc);
create index if not exists file_assets_created_idx on public.file_assets(created_at desc);

alter table public.app_sessions enable row level security;
alter table public.auth_login_attempts enable row level security;
alter table public.operational_job_runs enable row level security;
alter table public.data_migration_batches enable row level security;
alter table public.data_migration_errors enable row level security;
