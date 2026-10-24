-- Tenant owners manage only their own identity domain. No internal accounts are used.
alter table public.business_accounts add column staff_id uuid,
 add column access_expires_at timestamptz,
 add column management_version integer not null default 1,
 add foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id);
create unique index business_account_staff_idx on public.business_accounts(tenant_id,staff_id) where staff_id is not null;
alter table public.business_access_profiles add column expires_at timestamptz,add column reason text not null default '';

create function public.business_account_version() returns trigger language plpgsql set search_path='' as $$
begin new.management_version:=old.management_version+1;return new;end $$;
revoke all on function public.business_account_version() from public,anon,authenticated,service_role;
create trigger business_account_management_version before update on public.business_accounts for each row execute function public.business_account_version();

-- Take the tenant write lock before account/session locks, including password changes.
do $$ declare body text;begin
 select pg_get_functiondef('public.business_assert_session(text,text,boolean,boolean)'::regprocedure) into body;
 body:=replace(body,'select * into t from public.business_tenants where id=s.tenant_id',
 'if p_write then perform pg_advisory_xact_lock(hashtextextended(''business:''||s.tenant_id,0));end if; select * into t from public.business_tenants where id=s.tenant_id');
 body:=replace(body,'if a.must_change_password and not p_allow_password_change then',
 'if a.access_expires_at is not null and a.access_expires_at<=now() then raise exception ''BUSINESS_SESSION_REQUIRED'';end if; if a.staff_id is not null and not exists(select 1 from public.business_staff where tenant_id=a.tenant_id and id=a.staff_id and status=''active'') then raise exception ''BUSINESS_SESSION_REQUIRED'';end if; if a.must_change_password and not p_allow_password_change then');
 execute body;
 select pg_get_functiondef('public.business_change_password(text,text,integer,text)'::regprocedure) into body;
 execute replace(body,'perform 1 from public.business_tenants where id=s.tenant_id for share;',
 'perform pg_advisory_xact_lock(hashtextextended(''business:''||s.tenant_id,0));perform 1 from public.business_tenants where id=s.tenant_id for share;');
 select pg_get_functiondef('public.business_access_allowed(uuid,text,text,jsonb)'::regprocedure) into body;
 execute replace(body,'if a.role=''owner'' then return true;end if;',
 'if a.role=''owner'' then return true;end if; if exists(select 1 from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id and custom_access and expires_at<=now()) then return false;end if;');
 select pg_get_functiondef('public.business_assert_report_access(uuid,text[])'::regprocedure) into body;
 execute replace(body,'for d in select kind,definition',
 'if exists(select 1 from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id and custom_access and expires_at<=now()) then raise exception ''BUSINESS_SCOPED_REPORT'';end if; for d in select kind,definition');
 select pg_get_functiondef('public.business_session_workspace(text,text)'::regprocedure) into body;
 execute replace(body,'''isDemo'',t.is_demo',
 '''accessExpiresAt'',(select expires_at from public.business_access_profiles where tenant_id=a.tenant_id and account_id=a.id),''isDemo'',t.is_demo');
 select pg_get_functiondef('public.business_access_snapshot(text,text)'::regprocedure) into body;
 execute replace(body,'''customAccess'',coalesce(p.custom_access,false)',
 '''expiresAt'',p.expires_at,''reason'',coalesce(p.reason,''''),''customAccess'',coalesce(p.custom_access,false)');
 select pg_get_functiondef('public.business_access_update(text,text,uuid,integer,boolean,jsonb,uuid,text)'::regprocedure) into body;
 execute replace(body,'insert into public.business_access_profiles values(',
 'insert into public.business_access_profiles(tenant_id,account_id,custom_access,row_version) values(');
end $$;

alter function public.business_access_update(text,text,uuid,integer,boolean,jsonb,uuid,text) rename to business_access_update_before_expiry;
revoke all on function public.business_access_update_before_expiry(text,text,uuid,integer,boolean,jsonb,uuid,text) from public,anon,authenticated,service_role;
create function public.business_access_update(p_hash text,p_slug text,p_account uuid,p_expected_version integer,p_custom boolean,p_grants jsonb,p_request_id uuid,p_payload_hash text,p_expires_at timestamptz,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;prior timestamptz;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 or p_expires_at is not null and p_expires_at<=now() then raise exception 'BUSINESS_INVALID_INPUT';end if;
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'access.update',p_payload_hash);if r is not null then return r;end if;
 select expires_at into prior from public.business_access_profiles where tenant_id=a.tenant_id and account_id=p_account;
 r:=public.business_access_update_before_expiry(p_hash,p_slug,p_account,p_expected_version,p_custom,p_grants,p_request_id,p_payload_hash);
 update public.business_access_profiles set expires_at=p_expires_at,reason=btrim(p_reason) where tenant_id=a.tenant_id and account_id=p_account;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'access.validity_changed','accounts',p_account,jsonb_build_object('previousExpiry',prior,'expiresAt',p_expires_at,'reason',btrim(p_reason)));
 return r;
end $$;

create function public.business_members_snapshot(p_hash text,p_slug text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;total bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select count(*) into total from public.business_accounts where tenant_id=a.tenant_id and (strpos(lower(display_name),lower(p_query))>0 or strpos(lower(username),lower(p_query))>0);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
  select m.id,m.username,m.display_name,m.role,m.status,m.management_version,m.staff_id,s.name staff_name,m.access_expires_at,m.must_change_password,
   (select max(last_seen_at) from public.business_sessions where tenant_id=m.tenant_id and account_id=m.id) last_seen_at
  from public.business_accounts m left join public.business_staff s on s.tenant_id=m.tenant_id and s.id=m.staff_id
  where m.tenant_id=a.tenant_id and (strpos(lower(m.display_name),lower(p_query))>0 or strpos(lower(m.username),lower(p_query))>0)
  order by m.display_name,m.id limit 25 offset (p_page-1)*25)x;
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'pageSize',25);
end $$;

create function public.business_member_command(p_hash text,p_slug text,p_request_id uuid,p_id uuid,p_expected_version integer,p_operation text,p_data jsonb,p_password_hash text,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;target public.business_accounts%rowtype;person uuid;r jsonb;prior jsonb;expiry timestamptz;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_id is null or p_expected_version is null or p_operation is null or p_operation not in ('create','update','reset','disable','enable') or jsonb_typeof(p_data)<>'object'
 or coalesce(char_length(btrim(p_data->>'reason')),0) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'member.'||p_operation,p_payload_hash);if r is not null then return r;end if;
 if p_operation in ('create','reset') and (p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_operation in ('create','update') then
  if coalesce(p_data->>'username','') !~ '^[a-z][a-z0-9._-]{2,31}$' or coalesce(char_length(btrim(p_data->>'displayName')),0) not between 2 and 100 or coalesce(p_data->>'role','') not in ('editor','viewer') then raise exception 'BUSINESS_INVALID_INPUT';end if;
  person:=(p_data->>'staffId')::uuid;expiry:=(p_data->>'expiresAt')::timestamptz;
  if expiry is not null and expiry<=now() then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if person is not null and not exists(select 1 from public.business_staff where tenant_id=a.tenant_id and id=person and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if person is null and (select features ? 'people' from public.business_tenants where id=a.tenant_id) then raise exception 'BUSINESS_STAFF_REQUIRED';end if;
 end if;
 if p_operation='create' then
  if p_expected_version<>0 then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  insert into public.business_accounts(id,tenant_id,username,display_name,password_hash,role,staff_id,access_expires_at) values(p_id,a.tenant_id,p_data->>'username',btrim(p_data->>'displayName'),p_password_hash,p_data->>'role',person,expiry) returning * into target;
  insert into public.business_access_profiles(tenant_id,account_id,custom_access,reason) values(a.tenant_id,p_id,true,btrim(p_data->>'reason'));
 else
  select * into target from public.business_accounts where tenant_id=a.tenant_id and id=p_id for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
  if target.role='owner' or target.id=a.id then raise exception 'BUSINESS_FORBIDDEN';end if;
  if target.management_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  prior:=jsonb_build_object('name',target.display_name,'role',target.role,'status',target.status,'staffId',target.staff_id,'expiresAt',target.access_expires_at);
  if p_operation='update' then
   if p_data->>'username'<>target.username then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_accounts set display_name=btrim(p_data->>'displayName'),role=p_data->>'role',staff_id=person,access_expires_at=expiry,credential_version=credential_version+1 where tenant_id=a.tenant_id and id=p_id;
  elsif p_operation='reset' then
   update public.business_accounts set password_hash=p_password_hash,must_change_password=true,credential_version=credential_version+1 where tenant_id=a.tenant_id and id=p_id;
  elsif p_operation='disable' then
   if target.status<>'active' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_accounts set status='disabled',credential_version=credential_version+1 where tenant_id=a.tenant_id and id=p_id;
  else
   if target.status<>'disabled' or target.staff_id is not null and not exists(select 1 from public.business_staff where tenant_id=a.tenant_id and id=target.staff_id and status='active') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_accounts set status='active' where tenant_id=a.tenant_id and id=p_id;
  end if;
  if p_operation<>'enable' then update public.business_sessions set revoked_at=now() where tenant_id=a.tenant_id and account_id=p_id and revoked_at is null;end if;
  select * into target from public.business_accounts where tenant_id=a.tenant_id and id=p_id;
 end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'member.'||p_operation,'accounts',p_id,jsonb_build_object('before',prior,'name',target.display_name,'role',target.role,'status',target.status,'staffId',target.staff_id,'expiresAt',target.access_expires_at,'reason',btrim(p_data->>'reason')));
 r:=jsonb_build_object('accountId',target.id,'rowVersion',target.management_version);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'member.'||p_operation,p_payload_hash,r);return r;
end $$;

create function public.business_offboard_staff() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='inactive' and old.status<>'inactive' then
  if exists(select 1 from public.business_accounts where tenant_id=new.tenant_id and staff_id=new.id and role='owner') then raise exception 'BUSINESS_OWNER_TRANSFER_REQUIRED';end if;
  update public.business_accounts set status='disabled',credential_version=credential_version+1 where tenant_id=new.tenant_id and staff_id=new.id and status='active';
  update public.business_sessions set revoked_at=now() where tenant_id=new.tenant_id and account_id in(select id from public.business_accounts where tenant_id=new.tenant_id and staff_id=new.id) and revoked_at is null;
 end if;return new;
end $$;
create trigger business_staff_offboard after update on public.business_staff for each row execute function public.business_offboard_staff();
revoke all on function public.business_offboard_staff() from public,anon,authenticated,service_role;

create function public.business_audit_snapshot(p_hash text,p_slug text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;total bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_page is null or p_page not between 1 and 100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select count(*) into total from public.business_audit x where tenant_id=a.tenant_id and (p_query='' or strpos(lower(action),lower(p_query))>0 or entity_id::text=p_query);
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into rows from(
  select x.id,x.created_at,coalesce(m.display_name,'Quản trị triển khai') actor,x.action,x.entity_kind,x.entity_id,x.details
  from public.business_audit x left join public.business_accounts m on m.tenant_id=x.tenant_id and m.id=x.actor_id
  where x.tenant_id=a.tenant_id and (p_query='' or strpos(lower(x.action),lower(p_query))>0 or x.entity_id::text=p_query)
  order by x.created_at desc,x.id limit 25 offset (p_page-1)*25)r;
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'pageSize',25);
end $$;
revoke all on function public.business_access_update(text,text,uuid,integer,boolean,jsonb,uuid,text,timestamptz,text),public.business_members_snapshot(text,text,integer,text),public.business_member_command(text,text,uuid,uuid,integer,text,jsonb,text,text),public.business_audit_snapshot(text,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.business_access_update(text,text,uuid,integer,boolean,jsonb,uuid,text,timestamptz,text),public.business_members_snapshot(text,text,integer,text),public.business_member_command(text,text,uuid,uuid,integer,text,jsonb,text,text),public.business_audit_snapshot(text,text,integer,text) to service_role;
