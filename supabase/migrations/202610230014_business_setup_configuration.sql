-- One industry configuration for ERP, operator setup and the published workflow catalog.
create function public.business_configure_workspace(p_request_id uuid,p_customer_id uuid,p_customer_version integer,p_expected_version integer,p_industry text,p_features jsonb,p_system_name text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.crm_customers%rowtype;t public.business_tenants%rowtype;pack public.business_industry_packs%rowtype;r jsonb;h text;entry record;has_data boolean;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 -- All operator configuration commands lock CRM before tenant.
 select * into c from public.crm_customers where id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select * into t from public.business_tenants where customer_id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||t.id,0));
 h:=encode(sha256(convert_to(jsonb_build_object('customer',p_customer_id,'customerVersion',p_customer_version,'version',p_expected_version,'industry',p_industry,'features',p_features,'systemName',p_system_name)::text,'UTF8')),'hex');
 r:=public.business_command_replay(p_request_id,t.id,p_actor_id,'workspace.configure',h);if r is not null then return r;end if;
 if p_expected_version is null or p_customer_version is null or t.row_version<>p_expected_version or c.row_version<>p_customer_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into pack from public.business_industry_packs where key=p_industry;
 if not found or p_system_name is null or char_length(btrim(p_system_name)) not between 2 and 100 or coalesce(jsonb_typeof(p_features),'')<>'array' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if jsonb_array_length(p_features) not between 1 and 8 or not(pack.features @> p_features) or exists(select 1 from jsonb_array_elements(p_features) f where jsonb_typeof(f)<>'string') or (select count(*)<>count(distinct value) from jsonb_array_elements(p_features)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if (p_features ?| array['production','mes','traceability','quality','sales','projects'] and not(p_features ? 'inventory')) or (p_features ? 'mes' and not(p_features ? 'production')) or (p_features ? 'sales' and not(p_features ? 'crm')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 -- Prevent data from disappearing behind an industry switch or a disabled feature.
 for entry in select kind,definition from public.business_entity_definitions loop
  if (entry.definition->>'feature') in (select jsonb_array_elements_text(t.features)) and
    (not(p_features ? (entry.definition->>'feature')) or p_industry<>t.industry) then
   execute format('select exists(select 1 from public.%I where tenant_id=$1)',public.business_entity_table(entry.kind)) into has_data using t.id;
   if has_data then raise exception 'BUSINESS_CONFIGURATION_HAS_DATA';end if;
  end if;
 end loop;
 update public.business_tenants set industry=p_industry,features=p_features,system_name=btrim(p_system_name),row_version=row_version+1 where id=t.id;
 update public.crm_customers set profile=jsonb_set(profile,'{industry}',to_jsonb(p_industry)),setup=jsonb_set(jsonb_set(setup,'{industryPreset}',to_jsonb(p_industry)),'{systemName}',to_jsonb(btrim(p_system_name))),row_version=row_version+1,updated_at=now() where id=c.id;
 insert into public.business_audit(tenant_id,actor_id,action,details) values(t.id,p_actor_id,'workspace.configure',jsonb_build_object('industry',p_industry,'features',p_features,'requestId',p_request_id));
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),c.id,'updated','Đã đồng bộ gói ngành và module ERP',p_actor_id);
 r:=jsonb_build_object('tenantId',t.id,'rowVersion',t.row_version+1,'customerVersion',c.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'workspace.configure',h,r);return r;
end $$;
revoke all on function public.business_configure_workspace(uuid,uuid,integer,integer,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_configure_workspace(uuid,uuid,integer,integer,text,jsonb,text,uuid) to service_role;

-- CRM cannot overwrite the provisioned industry's authoritative configuration.
create function public.business_sync_crm_configuration() returns trigger
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;
begin
 select * into t from public.business_tenants where customer_id=new.id for update;
 if not found then return new;end if;
 if new.profile->>'industry' is distinct from t.industry then raise exception 'BUSINESS_USE_WORKSPACE_CONFIGURATION';end if;
 new.setup:=jsonb_set(jsonb_set(new.setup,'{industryPreset}',to_jsonb(t.industry)),'{systemName}',to_jsonb(t.system_name));
 if t.name is distinct from new.profile->>'companyName' then
  update public.business_tenants set name=new.profile->>'companyName',row_version=row_version+1 where id=t.id;
 end if;
 return new;
end $$;
create trigger business_sync_crm_configuration before update on public.crm_customers for each row execute function public.business_sync_crm_configuration();
revoke all on function public.business_sync_crm_configuration() from public,anon,authenticated,service_role;

-- Provisioning also goes through the CRM trigger; backfill configuration metadata only.
update public.crm_customers c set setup=jsonb_set(jsonb_set(c.setup,'{industryPreset}',to_jsonb(t.industry)),'{systemName}',to_jsonb(t.system_name))
from public.business_tenants t where t.customer_id=c.id;




create or replace function public.business_manage_workspace(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_status text,p_days integer,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;r jsonb;h text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_status is null or p_status not in ('trial','active','suspended') or p_days is null or p_days not between 1 and 90 or p_expected_version is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 perform 1 from public.crm_customers where id=p_customer_id for update;
 select * into t from public.business_tenants where customer_id=p_customer_id for update;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 h:=encode(sha256(convert_to(p_customer_id::text||p_expected_version::text||p_status||p_days::text,'UTF8')),'hex');
 r:=public.business_command_replay(p_request_id,t.id,p_actor_id,'workspace.status',h);if r is not null then return r;end if;
 if t.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 update public.business_tenants set status=p_status,trial_ends_at=case when p_status='trial' then now()+make_interval(days=>p_days) else trial_ends_at end,row_version=row_version+1 where id=t.id;
 if p_status='suspended' then update public.business_sessions set revoked_at=now() where tenant_id=t.id;end if;
 update public.crm_customers set stage=case p_status when 'suspended' then 'paused' when 'active' then 'active' else 'trial' end,row_version=row_version+1,updated_at=now() where id=p_customer_id;
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),p_customer_id,'stage',case p_status when 'suspended' then 'Đã tạm ngừng ERP' when 'active' then 'Đã kích hoạt ERP' else 'Đã gia hạn dùng thử' end,p_actor_id);
 insert into public.business_audit(tenant_id,actor_id,action,details) values(t.id,p_actor_id,'workspace.status',jsonb_build_object('status',p_status,'requestId',p_request_id));
 r:=jsonb_build_object('tenantId',t.id,'rowVersion',t.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'workspace.status',h,r);return r;
end $$;

create or replace function public.business_reset_owner(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_password_hash text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;a public.business_accounts%rowtype;r jsonb;h text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 perform 1 from public.crm_customers where id=p_customer_id for update;
 select * into t from public.business_tenants where customer_id=p_customer_id for update;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 h:=encode(sha256(convert_to(p_customer_id::text||p_expected_version::text||p_password_hash,'UTF8')),'hex');
 r:=public.business_command_replay(p_request_id,t.id,p_actor_id,'owner.reset',h);if r is not null then return r;end if;
 if t.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into a from public.business_accounts where tenant_id=t.id and role='owner' for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 update public.business_accounts set password_hash=p_password_hash,must_change_password=true,credential_version=credential_version+1 where tenant_id=t.id and id=a.id;
 update public.business_sessions set revoked_at=now() where tenant_id=t.id and account_id=a.id;
 update public.business_tenants set row_version=row_version+1 where id=t.id;
 insert into public.business_audit(tenant_id,actor_id,action) values(t.id,p_actor_id,'owner.reset');
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),p_customer_id,'note','Đã cấp lại mật khẩu quản trị',p_actor_id);
 r:=jsonb_build_object('tenantId',t.id,'username',a.username,'rowVersion',t.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'owner.reset',h,r);return r;
end $$;

create or replace function public.business_provision_customer(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_config jsonb,p_password_hash text,p_payload_hash text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_customers%rowtype;t public.business_tenants%rowtype;a public.business_accounts%rowtype;old public.business_commands%rowtype;pack public.business_industry_packs%rowtype;r jsonb;k text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_request_id is null or p_customer_id is null or p_expected_version is null or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
 or coalesce(jsonb_typeof(p_config),'')<>'object' or (select count(*) from jsonb_object_keys(p_config))<>7
 or not(p_config ?& array['slug','industry','features','systemName','username','displayName','trialDays'])
 or p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into c from public.crm_customers where id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select * into old from public.business_commands where request_id=p_request_id;
 if found then
  if old.kind<>'provision' or old.actor_id<>p_actor_id or old.payload_hash<>p_payload_hash then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  if (old.receipt->>'customerId')::uuid<>p_customer_id then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  return old.receipt;
 end if;

 if c.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if c.stage in ('closed','paused') then raise exception 'BUSINESS_CUSTOMER_CLOSED';end if;
 select * into pack from public.business_industry_packs where key=p_config->>'industry';
 if not found or coalesce(jsonb_typeof(p_config->'features'),'')<>'array' or jsonb_array_length(p_config->'features') not between 1 and 8 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from jsonb_array_elements(p_config->'features') f where jsonb_typeof(f)<>'string' or not(pack.features @> jsonb_build_array(f)))
 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_config->'features')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if (p_config->'features' ?| array['production','mes','traceability','quality','sales','projects'] and not(p_config->'features' ? 'inventory')) or (p_config->'features' ? 'mes' and not(p_config->'features' ? 'production')) or (p_config->'features' ? 'sales' and not(p_config->'features' ? 'crm')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
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

