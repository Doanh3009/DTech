-- Shared-project customer platform; existing internal ERP accounts/data are untouched.
create table public.business_industry_packs (key text primary key,label text not null,features jsonb not null check(jsonb_typeof(features)='array'));
create table public.business_entity_definitions (kind text primary key,definition jsonb not null check(jsonb_typeof(definition)='object'));
create table public.business_tenants (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null unique references public.crm_customers(id),
 slug text not null unique check(slug ~ '^[a-z][a-z0-9-]{2,39}$'), name text not null check(char_length(name) between 2 and 120),
 system_name text not null check(char_length(system_name) between 2 and 100), industry text not null references public.business_industry_packs(key),
 features jsonb not null check(jsonb_typeof(features)='array'), status text not null default 'trial' check(status in ('trial','active','suspended')),
 trial_ends_at timestamptz not null, row_version integer not null default 1 check(row_version>0), created_at timestamptz not null default now()
);
create table public.business_accounts (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 username text not null check(username ~ '^[a-z][a-z0-9._-]{2,31}$'),display_name text not null check(char_length(display_name) between 2 and 100),
 password_hash text not null check(password_hash ~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$'),
 role text not null default 'owner' check(role in ('owner','editor','viewer')),status text not null default 'active' check(status in ('active','disabled')),
 must_change_password boolean not null default true,credential_version integer not null default 1 check(credential_version>0),created_at timestamptz not null default now(),
 unique(tenant_id,id),unique(tenant_id,username)
);
create unique index business_one_owner_idx on public.business_accounts(tenant_id) where role='owner';
create table public.business_sessions (
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),tenant_id uuid not null,account_id uuid not null,credential_version integer not null,
 expires_at timestamptz not null,last_seen_at timestamptz not null default now(),revoked_at timestamptz,
 foreign key(tenant_id,account_id) references public.business_accounts(tenant_id,id)
);
create index business_sessions_account_idx on public.business_sessions(tenant_id,account_id) where revoked_at is null;
create table public.business_login_limits (key_hash text primary key check(key_hash ~ '^[a-f0-9]{64}$'),window_start timestamptz not null,attempts integer not null check(attempts>0));
create table public.business_commands (
 request_id uuid primary key,tenant_id uuid not null references public.business_tenants(id),actor_id uuid not null,kind text not null,
 payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),receipt jsonb not null,created_at timestamptz not null default now()
);
create table public.business_audit (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),actor_id uuid not null,
 action text not null,entity_kind text,entity_id uuid,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);
create index business_audit_tenant_date_idx on public.business_audit(tenant_id,created_at desc);

create function public.business_assert_session(p_hash text,p_slug text,p_write boolean default false,p_allow_password_change boolean default false)
returns public.business_accounts language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;s public.business_sessions%rowtype;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_slug is null then raise exception 'BUSINESS_SESSION_REQUIRED';end if;
 select * into s from public.business_sessions where token_hash=p_hash and revoked_at is null and expires_at>now() and last_seen_at>now()-interval '2 hours';
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED';end if;
 select * into t from public.business_tenants where id=s.tenant_id and slug=p_slug and status in ('trial','active') and (status='active' or trial_ends_at>now()) for share;
 if not found then raise exception 'BUSINESS_TENANT_UNAVAILABLE';end if;
 select * into a from public.business_accounts where tenant_id=s.tenant_id and id=s.account_id and status='active' and credential_version=s.credential_version for share;
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED';end if;
 if a.must_change_password and not p_allow_password_change then raise exception 'BUSINESS_PASSWORD_CHANGE_REQUIRED';end if;
 if p_write and a.role='viewer' then raise exception 'BUSINESS_FORBIDDEN';end if;
 update public.business_sessions set last_seen_at=now() where token_hash=p_hash and last_seen_at<now()-interval '1 minute';
 return a;
end $$;

create function public.business_provision_customer(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_config jsonb,p_password_hash text,p_payload_hash text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_customers%rowtype;t public.business_tenants%rowtype;a public.business_accounts%rowtype;old public.business_commands%rowtype;pack public.business_industry_packs%rowtype;r jsonb;k text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_request_id is null or p_customer_id is null or p_expected_version is null or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
 or coalesce(jsonb_typeof(p_config),'')<>'object' or (select count(*) from jsonb_object_keys(p_config))<>7
 or not(p_config ?& array['slug','industry','features','systemName','username','displayName','trialDays'])
 or p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into old from public.business_commands where request_id=p_request_id;
 if found then
  if old.kind<>'provision' or old.actor_id<>p_actor_id or old.payload_hash<>p_payload_hash then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  if (old.receipt->>'customerId')::uuid<>p_customer_id then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  return old.receipt;
 end if;
 select * into c from public.crm_customers where id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 if c.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if c.stage in ('closed','paused') then raise exception 'BUSINESS_CUSTOMER_CLOSED';end if;
 select * into pack from public.business_industry_packs where key=p_config->>'industry';
 if not found or coalesce(jsonb_typeof(p_config->'features'),'')<>'array' or jsonb_array_length(p_config->'features') not between 1 and 8 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from jsonb_array_elements(p_config->'features') f where jsonb_typeof(f)<>'string' or not(pack.features @> jsonb_build_array(f)))
 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_config->'features')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if (p_config->'features' ?| array['production','mes','traceability','quality','sales'] and not(p_config->'features' ? 'inventory')) or (p_config->'features' ? 'mes' and not(p_config->'features' ? 'production')) or (p_config->'features' ? 'sales' and not(p_config->'features' ? 'crm')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 foreach k in array array['slug','industry','systemName','username','displayName'] loop
  if coalesce(jsonb_typeof(p_config->k),'')<>'string' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 end loop;
 if (p_config->>'slug') !~ '^[a-z][a-z0-9-]{2,39}$' or (p_config->>'username') !~ '^[a-z][a-z0-9._-]{2,31}$'
 or char_length(btrim(p_config->>'systemName')) not between 2 and 100 or char_length(btrim(p_config->>'displayName')) not between 2 and 100
 or coalesce(jsonb_typeof(p_config->'trialDays'),'')<>'number' or (p_config->>'trialDays') !~ '^[0-9]+$' or (p_config->>'trialDays')::numeric not between 1 and 90 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from public.business_tenants where customer_id=p_customer_id) then raise exception 'BUSINESS_ALREADY_PROVISIONED';end if;
 insert into public.business_tenants(customer_id,slug,name,system_name,industry,features,trial_ends_at)
 values(p_customer_id,p_config->>'slug',c.profile->>'companyName',btrim(p_config->>'systemName'),pack.key,p_config->'features',now()+make_interval(days=>(p_config->>'trialDays')::integer)) returning * into t;
 insert into public.business_accounts(tenant_id,username,display_name,password_hash) values(t.id,p_config->>'username',btrim(p_config->>'displayName'),p_password_hash) returning * into a;
 update public.crm_customers set profile=jsonb_set(profile,'{industry}',to_jsonb(pack.key)),setup=jsonb_set(setup,'{industryPreset}',to_jsonb(pack.key)),stage='trial',row_version=row_version+1,updated_at=now() where id=p_customer_id;
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),p_customer_id,'stage','Đã cấp không gian dùng thử và tài khoản doanh nghiệp',p_actor_id);
 r:=jsonb_build_object('customerId',c.id,'tenantId',t.id,'slug',t.slug,'accountId',a.id,'username',a.username,'trialEndsAt',t.trial_ends_at,'rowVersion',c.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'provision',p_payload_hash,r);
 insert into public.audit_logs(actor_account_id,action,entity_type,entity_id,after_data) values(p_actor_id,'business.provision','crm_customer',c.id::text,jsonb_build_object('tenantId',t.id,'industry',t.industry,'accountId',a.id));
 return r;
exception when unique_violation then raise exception 'BUSINESS_DUPLICATE';
end $$;

create function public.business_customer_workspace(p_customer_id uuid,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;a public.business_accounts%rowtype;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view']);
 if not exists(select 1 from public.crm_customers where id=p_customer_id) then raise exception 'BUSINESS_NOT_FOUND';end if;
 select * into t from public.business_tenants where customer_id=p_customer_id;if not found then return 'null'::jsonb;end if;
 select * into a from public.business_accounts where tenant_id=t.id and role='owner';
 return jsonb_build_object('tenantId',t.id,'slug',t.slug,'name',t.name,'systemName',t.system_name,'industry',t.industry,'features',t.features,'status',t.status,'trialEndsAt',t.trial_ends_at,'rowVersion',t.row_version,'username',a.username,'accountId',a.id,'displayName',a.display_name,'mustChangePassword',a.must_change_password);
end $$;

create function public.business_login_lookup(p_slug text,p_username text,p_identifier_hash text,p_network_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare k text;n integer;a public.business_accounts%rowtype;
begin
 if p_slug is null or p_username is null or p_identifier_hash is null or p_network_hash is null or p_identifier_hash !~ '^[a-f0-9]{64}$' or p_network_hash !~ '^[a-f0-9]{64}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('dtech:business-login',0));
 foreach k in array array[p_identifier_hash,p_network_hash] loop
  insert into public.business_login_limits(key_hash,window_start,attempts) values(k,now(),1)
  on conflict(key_hash) do update set attempts=case when business_login_limits.window_start<now()-interval '15 minutes' then 1 else business_login_limits.attempts+1 end,window_start=case when business_login_limits.window_start<now()-interval '15 minutes' then now() else business_login_limits.window_start end returning attempts into n;
  if n>(case when k=p_identifier_hash then 10 else 40 end) then raise exception 'BUSINESS_RATE_LIMITED';end if;
 end loop;
 if (select sum(attempts) from public.business_login_limits where window_start>now()-interval '15 minutes')>600 then raise exception 'BUSINESS_RATE_LIMITED';end if;
 select a0.* into a from public.business_accounts a0 join public.business_tenants t on t.id=a0.tenant_id
 where t.slug=p_slug and a0.username=p_username and a0.status='active' and t.status in ('trial','active') and (t.status='active' or t.trial_ends_at>now());
 if not found then return 'null'::jsonb;end if;
 return jsonb_build_object('accountId',a.id,'tenantId',a.tenant_id,'credentialVersion',a.credential_version,'passwordHash',a.password_hash);
end $$;

create function public.business_open_session(p_account_id uuid,p_credential_version integer,p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;
begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into a from public.business_accounts where id=p_account_id and credential_version=p_credential_version and status='active';
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED';end if;
 select * into t from public.business_tenants where id=a.tenant_id and status in ('trial','active') and (status='active' or trial_ends_at>now()) for share;
 if not found then raise exception 'BUSINESS_TENANT_UNAVAILABLE';end if;
 select * into a from public.business_accounts where id=p_account_id and credential_version=p_credential_version and status='active' for update;
 if not found then raise exception 'BUSINESS_SESSION_REQUIRED';end if;
 insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values(p_token_hash,t.id,a.id,a.credential_version,now()+interval '12 hours');
 return jsonb_build_object('slug',t.slug,'mustChangePassword',a.must_change_password);
end $$;

create function public.business_session_workspace(p_hash text,p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;
begin
 a:=public.business_assert_session(p_hash,p_slug,false,true);select * into t from public.business_tenants where id=a.tenant_id;
 return jsonb_build_object('tenantId',t.id,'slug',t.slug,'name',t.name,'systemName',t.system_name,'industry',t.industry,'features',t.features,'status',t.status,'trialEndsAt',t.trial_ends_at,'accountId',a.id,'displayName',a.display_name,'username',a.username,'role',a.role,'mustChangePassword',a.must_change_password);
end $$;

create function public.business_change_password(p_hash text,p_slug text,p_expected_version integer,p_password_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;
begin
 a:=public.business_assert_session(p_hash,p_slug,false,true);
 if p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into a from public.business_accounts where id=a.id and tenant_id=a.tenant_id for update;
 if a.credential_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 update public.business_accounts set password_hash=p_password_hash,must_change_password=false,credential_version=credential_version+1 where id=a.id;
 update public.business_sessions set revoked_at=now() where account_id=a.id and token_hash<>p_hash;
 update public.business_sessions set credential_version=a.credential_version+1 where token_hash=p_hash;
 insert into public.business_audit(tenant_id,actor_id,action) values(a.tenant_id,a.id,'password.changed');
 return jsonb_build_object('changed',true);
end $$;

create function public.business_password_snapshot(p_hash text,p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$declare a public.business_accounts%rowtype;begin
 a:=public.business_assert_session(p_hash,p_slug,false,true);return jsonb_build_object('passwordHash',a.password_hash,'credentialVersion',a.credential_version);end $$;

create function public.business_logout(p_hash text) returns void language sql security definer set search_path='' as $$update public.business_sessions set revoked_at=now() where token_hash=p_hash$$;

create function public.business_manage_workspace(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_status text,p_days integer,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;r jsonb;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_status is null or p_status not in ('trial','active','suspended') or p_days is null or p_days not between 1 and 90 or p_request_id is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into t from public.business_tenants where customer_id=p_customer_id for update;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 if t.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 update public.business_tenants set status=p_status,trial_ends_at=case when p_status='trial' then now()+make_interval(days=>p_days) else trial_ends_at end,row_version=row_version+1 where id=t.id;
 if p_status='suspended' then update public.business_sessions set revoked_at=now() where tenant_id=t.id;end if;
 insert into public.business_audit(tenant_id,actor_id,action,details) values(t.id,p_actor_id,'workspace.status',jsonb_build_object('status',p_status,'requestId',p_request_id));
 return jsonb_build_object('tenantId',t.id,'rowVersion',t.row_version+1);
end $$;

do $$declare n text;f record;begin
 foreach n in array array['business_industry_packs','business_entity_definitions','business_tenants','business_accounts','business_sessions','business_login_limits','business_commands','business_audit'] loop
  execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated,service_role',n);
 end loop;
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname like 'business_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.proname<>'business_assert_session' then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $$;
