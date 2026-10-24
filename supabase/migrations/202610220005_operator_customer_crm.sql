-- Operator control plane. Customer ERP instances keep the HTTP feature disabled.
insert into public.permissions(key,module,description) values
 ('crm.view','system','Xem CRM triển khai của đội setup'),('crm.manage','system','Quản lý khách hàng và cấu hình triển khai') on conflict do nothing;
insert into public.roles(code,name,description,is_system) values ('deployment_team','Team triển khai','CRM và thiết lập khách hàng',true) on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_key)
 select r.id,p.key from public.roles r cross join public.permissions p where r.code in ('admin','deployment_team') and p.key in ('crm.view','crm.manage','trial_request.view','trial_request.manage') on conflict do nothing;

alter table public.product_trial_requests add column qualification jsonb not null default '{}'::jsonb check(jsonb_typeof(qualification)='object' and octet_length(qualification::text)<=6000);

create table public.crm_customers (
 id uuid primary key, source_request_id uuid unique references public.product_trial_requests(request_id),
 profile jsonb not null, setup jsonb not null, stage text not null check(stage in ('discovery','configuration','provisioning','trial','active','paused','closed')),
 search_text text generated always as (lower(coalesce(profile->>'companyName','')||' '||coalesce(profile->>'contactName','')||' '||coalesce(profile->>'email','')||' '||coalesce(profile->>'phone','')||' '||coalesce(profile->>'taxCode',''))) stored,
 row_version integer not null default 1 check(row_version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index crm_customer_project_idx on public.crm_customers(nullif(setup->>'projectRef',''));
create unique index crm_customer_origin_idx on public.crm_customers(lower(nullif(setup->>'baseUrl','')));
create unique index crm_customer_deployment_idx on public.crm_customers(nullif(setup->>'deploymentId',''));
create index crm_customer_stage_idx on public.crm_customers(stage,updated_at desc);
create table public.crm_activities (
 id uuid primary key, customer_id uuid not null references public.crm_customers(id),
 kind text not null check(kind in ('note','call','email','meeting','created','updated','stage')),
 note text not null check(char_length(note) between 3 and 2000), actor_id uuid references public.app_accounts(id) on delete set null,
 created_at timestamptz not null default now()
);
create index crm_activity_customer_idx on public.crm_activities(customer_id,created_at desc);
alter table public.crm_customers enable row level security;
alter table public.crm_activities enable row level security;
revoke all on public.crm_customers,public.crm_activities from public,anon,authenticated,service_role;
grant select on public.crm_customers,public.crm_activities to service_role;

create function public.crm_assert_actor(p_actor uuid,p_permissions text[]) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command',0));
 if not exists(select 1 from public.app_accounts where id=p_actor and status='active')
 or exists(select unnest(p_permissions) except select rp.permission_key from public.account_roles ar join public.role_permissions rp on rp.role_id=ar.role_id where ar.account_id=p_actor)
 then raise exception 'CRM_FORBIDDEN'; end if;
end $$;

create function public.crm_validate_documents(p_profile jsonb,p_setup jsonb,p_stage text) returns void
language plpgsql security definer set search_path='' as $$
declare k text; v text;
begin
 if coalesce(jsonb_typeof(p_profile),'')<>'object' or coalesce(jsonb_typeof(p_setup),'')<>'object'
 or (select count(*) from jsonb_object_keys(p_profile))<>18 or (select count(*) from jsonb_object_keys(p_setup))<>17
 or not(p_profile ?& array['companyName','taxCode','companyType','industry','companySize','province','address','website','branchCount','contactName','contactRole','email','phone','needs','currentTools','rolloutWindow','ownerName','nextContactOn'])
 or not(p_setup ?& array['industryPreset','enabledModules','shortName','systemName','workflow','deploymentId','projectRef','organizationId','baseUrl','region','environment','adminUsername','adminDisplayName','adminEmployeeCode','trialStartsOn','trialEndsOn','checks']) then raise exception 'CRM_INVALID_INPUT'; end if;
 -- Exact key checks reject credentials and unknown options.
 foreach k in array array['companyName','taxCode','companyType','industry','companySize','province','address','website','contactName','contactRole','email','phone','needs','currentTools','rolloutWindow','ownerName','nextContactOn'] loop
   if coalesce(jsonb_typeof(p_profile->k),'')<>'string' or char_length(p_profile->>k)>(case k when 'needs' then 2000 when 'currentTools' then 500 when 'email' then 254 when 'address' then 240 when 'website' then 240 when 'companyName' then 120 when 'phone' then 24 when 'taxCode' then 30 else 100 end) then raise exception 'CRM_INVALID_INPUT'; end if;
 end loop;
 if char_length(btrim(p_profile->>'companyName'))<2 or char_length(btrim(p_profile->>'contactName'))<2
 or (p_profile->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or ((p_profile->>'website')<>'' and (p_profile->>'website') !~ '^https?://[^[:space:]@]+$')
 or (p_profile->>'phone') !~ '^[+0-9() .-]{9,24}$' or char_length(regexp_replace(p_profile->>'phone','[^0-9]','','g')) not between 9 and 15
 or (p_profile->>'industry') not in ('general','construction','garment','trading','services')
 or (p_profile->>'companyType') not in ('limited','joint_stock','private','household','other')
 or (p_profile->>'companySize') not in ('under_20','20_100','101_300','over_300')
 or (p_profile->>'rolloutWindow') not in ('now','quarter','later','exploring')
 or coalesce(jsonb_typeof(p_profile->'branchCount'),'')<>'number' or (p_profile->>'branchCount') !~ '^[0-9]+$' or (p_profile->>'branchCount')::numeric not between 1 and 10000
 then raise exception 'CRM_INVALID_INPUT'; end if;
 foreach k in array array['industryPreset','shortName','systemName','workflow','deploymentId','projectRef','organizationId','baseUrl','region','environment','adminUsername','adminDisplayName','adminEmployeeCode','trialStartsOn','trialEndsOn'] loop
   if coalesce(jsonb_typeof(p_setup->k),'')<>'string' or char_length(p_setup->>k)>(case k when 'workflow' then 2000 when 'baseUrl' then 240 else 100 end) then raise exception 'CRM_INVALID_INPUT'; end if;
 end loop;
 if (p_setup->>'industryPreset') not in ('general','construction','garment','trading','services')
 or (p_setup->>'environment') not in ('staging','production') or (p_setup->>'region') !~ '^[a-z]+-[a-z]+-[0-9]+$'
 or char_length(p_setup->>'shortName')>30 or char_length(p_setup->>'deploymentId')>50
 or ((p_setup->>'deploymentId')<>'' and (p_setup->>'deploymentId') !~ '^[a-z][a-z0-9-]{2,49}$')
 or ((p_setup->>'adminUsername')<>'' and (p_setup->>'adminUsername') !~ '^[a-z][a-z0-9._-]{2,31}$')
 or ((p_setup->>'adminEmployeeCode')<>'' and (p_setup->>'adminEmployeeCode') !~ '^[A-Z][A-Z0-9-]{2,39}$')
 or coalesce(jsonb_typeof(p_setup->'enabledModules'),'')<>'array' or jsonb_array_length(p_setup->'enabledModules')>9
 then raise exception 'CRM_INVALID_INPUT'; end if;
 if exists(select 1 from jsonb_array_elements(p_setup->'enabledModules') x where jsonb_typeof(x)<>'string' or (x#>>'{}') not in ('human_resources','attendance','projects','warehouse','import_export','accounting','operations','reports','messaging'))
 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_setup->'enabledModules')) then raise exception 'CRM_INVALID_INPUT'; end if;
 foreach k in array array['projectRef','organizationId'] loop
   if (p_setup->>k)<>'' and (p_setup->>k) !~ '^[a-z]{20}$' then raise exception 'CRM_INVALID_INPUT'; end if;
 end loop;
 if p_setup->>'projectRef' in ('tcjjhxqtreemccdbvyza','uioywupuuestcaliawlc','lgmlkagcytfjazulgfbz') then raise exception 'CRM_TARGET_PROTECTED'; end if;
 if (p_setup->>'baseUrl')<>'' and ((p_setup->>'baseUrl') !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]+(:[0-9]{1,5})?/?$' or (p_setup->>'baseUrl') ~* '^https://(localhost|127\.|0\.|\[)') then raise exception 'CRM_INVALID_INPUT'; end if;
 foreach v in array array[p_profile->>'nextContactOn',p_setup->>'trialStartsOn',p_setup->>'trialEndsOn'] loop
   if v<>'' then
     if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'CRM_INVALID_INPUT'; end if;
     begin if to_char(v::date,'YYYY-MM-DD')<>v then raise exception 'CRM_INVALID_INPUT'; end if; exception when others then raise exception 'CRM_INVALID_INPUT'; end;
   end if;
 end loop;
 if p_setup->>'trialStartsOn'<>'' and p_setup->>'trialEndsOn'<>'' and p_setup->>'trialStartsOn'>p_setup->>'trialEndsOn' then raise exception 'CRM_INVALID_INPUT'; end if;
 if coalesce(jsonb_typeof(p_setup->'checks'),'')<>'object' or (select count(*) from jsonb_object_keys(p_setup->'checks'))<>5
 or not(p_setup->'checks' ?& array['database','configuration','account','access','data']) then raise exception 'CRM_INVALID_INPUT'; end if;
 foreach k in array array['database','configuration','account','access','data'] loop
   if coalesce(jsonb_typeof(p_setup->'checks'->k),'')<>'boolean' then raise exception 'CRM_INVALID_INPUT'; end if;
 end loop;
 if p_stage in ('provisioning','trial','active') then
   if p_profile->>'address'='' or p_profile->>'contactRole'='' or p_profile->>'needs'='' or jsonb_array_length(p_setup->'enabledModules')=0 then raise exception 'CRM_SETUP_INCOMPLETE'; end if;
   foreach k in array array['shortName','systemName','deploymentId','projectRef','organizationId','baseUrl','adminUsername','adminDisplayName','adminEmployeeCode'] loop
     if char_length(p_setup->>k)<2 then raise exception 'CRM_SETUP_INCOMPLETE'; end if;
   end loop;
 end if;
 if p_stage in ('trial','active') and ((p_setup->'checks')<>'{"database":true,"configuration":true,"account":true,"access":true,"data":true}'::jsonb or p_setup->>'trialStartsOn'='' or p_setup->>'trialEndsOn'='') then raise exception 'CRM_SETUP_INCOMPLETE'; end if;
end $$;

create function public.crm_save_customer(p_id uuid,p_expected_version integer,p_profile jsonb,p_setup jsonb,p_stage text,p_reason text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.crm_customers%rowtype; v integer; a text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.manage','crm.view']);
 if p_id is null or p_expected_version is null or p_expected_version<0 or p_stage is null or p_stage not in ('discovery','configuration','provisioning','trial','active','paused','closed') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'CRM_INVALID_INPUT'; end if;
 perform public.crm_validate_documents(p_profile,p_setup,p_stage);
 select * into b from public.crm_customers where id=p_id for update;
 if not found then
   if p_expected_version<>0 or p_stage<>'discovery' then raise exception 'CRM_VERSION_CONFLICT'; end if;
   insert into public.crm_customers(id,profile,setup,stage) values(p_id,p_profile,p_setup,p_stage); v:=1; a:='created';
 else
   if b.row_version<>p_expected_version then raise exception 'CRM_VERSION_CONFLICT'; end if;
   if b.stage<>p_stage and not(case b.stage when 'discovery' then p_stage in ('configuration','paused','closed') when 'configuration' then p_stage in ('discovery','provisioning','paused','closed') when 'provisioning' then p_stage in ('configuration','trial','paused','closed') when 'trial' then p_stage in ('provisioning','active','paused','closed') when 'active' then p_stage in ('provisioning','paused','closed') when 'paused' then true when 'closed' then p_stage='discovery' else false end) then raise exception 'CRM_INVALID_TRANSITION'; end if;
   -- Infrastructure/module changes invalidate earlier attestations.
   if ((b.setup - array['workflow','trialStartsOn','trialEndsOn','checks']) is distinct from (p_setup - array['workflow','trialStartsOn','trialEndsOn','checks'])
     or (b.profile - array['ownerName','nextContactOn','needs','currentTools','rolloutWindow','contactName','contactRole','companyType','industry','companySize','province','website','branchCount']) is distinct from (p_profile - array['ownerName','nextContactOn','needs','currentTools','rolloutWindow','contactName','contactRole','companyType','industry','companySize','province','website','branchCount']))
     and p_setup->'checks'<>'{"database":false,"configuration":false,"account":false,"access":false,"data":false}'::jsonb then raise exception 'CRM_CHECKS_STALE'; end if;
   update public.crm_customers set profile=p_profile,setup=p_setup,stage=p_stage,row_version=row_version+1,updated_at=now() where id=p_id returning row_version into v;
   a:=case when b.stage<>p_stage then 'stage' else 'updated' end;
 end if;
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),p_id,a,btrim(p_reason),p_actor_id);
 insert into public.audit_logs(actor_account_id,action,entity_type,entity_id,before_data,after_data,reason) values(p_actor_id,'crm.'||a,'crm_customer',p_id::text,jsonb_build_object('rowVersion',b.row_version,'stage',b.stage),jsonb_build_object('rowVersion',v,'stage',p_stage),btrim(p_reason));
 return jsonb_build_object('customerId',p_id,'rowVersion',v);
exception when unique_violation then raise exception 'CRM_DUPLICATE_TARGET';
end $$;

create function public.crm_convert_trial(p_id uuid,p_request_id uuid,p_expected_version integer,p_setup jsonb,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.product_trial_requests%rowtype; c public.crm_customers%rowtype; p jsonb; q jsonb; receipt jsonb;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage','trial_request.view','trial_request.manage']);
 select * into r from public.product_trial_requests where request_id=p_request_id for update;
 if not found then raise exception 'CRM_NOT_FOUND'; end if;
 select * into c from public.crm_customers where source_request_id=p_request_id;
 if found then return jsonb_build_object('customerId',c.id,'rowVersion',c.row_version); end if;
 if p_expected_version is null or r.row_version<>p_expected_version then raise exception 'CRM_VERSION_CONFLICT'; end if;
 if r.status<>'qualified' then raise exception 'CRM_INVALID_TRANSITION'; end if;
 q:=r.qualification;
 p:=jsonb_build_object('companyName',left(r.company_name,120),'taxCode',coalesce(q->>'taxCode',''),'companyType',coalesce(q->>'companyType','other'),'industry',case when r.industry='other' then 'general' else r.industry end,'companySize',r.company_size,'province',coalesce(q->>'province',''),'address',coalesce(q->>'address',''),'website',coalesce(q->>'companyWebsite',''),'branchCount',coalesce((q->>'branchCount')::integer,1),'contactName',left(r.contact_name,100),'contactRole',coalesce(q->>'contactRole',''),'email',r.email,'phone',r.phone,'needs',r.needs,'currentTools',coalesce(q->>'currentTools',''),'rolloutWindow',coalesce(q->>'rolloutWindow','exploring'),'ownerName','','nextContactOn','');
 receipt:=public.crm_save_customer(p_id,0,p,p_setup,'discovery','Tiếp nhận từ đăng ký dùng thử',p_actor_id);
 update public.crm_customers set source_request_id=p_request_id where id=p_id;
 return receipt;
end $$;

create function public.crm_add_activity(p_id uuid,p_activity_id uuid,p_expected_version integer,p_kind text,p_note text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.crm_customers%rowtype; a public.crm_activities%rowtype; v integer;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_id is null or p_activity_id is null or p_expected_version is null or p_expected_version<1 or p_kind is null or p_kind not in ('note','call','email','meeting') or p_note is null or char_length(btrim(p_note)) not between 3 and 2000 then raise exception 'CRM_INVALID_INPUT'; end if;
 select * into b from public.crm_customers where id=p_id for update; if not found then raise exception 'CRM_NOT_FOUND'; end if;
 select * into a from public.crm_activities where id=p_activity_id;
 if found then
   if a.customer_id<>p_id or a.actor_id<>p_actor_id or a.kind<>p_kind or a.note<>btrim(p_note) then raise exception 'CRM_VERSION_CONFLICT'; end if;
   return jsonb_build_object('customerId',p_id,'rowVersion',b.row_version);
 end if;
 if b.row_version<>p_expected_version then raise exception 'CRM_VERSION_CONFLICT'; end if;
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(p_activity_id,p_id,p_kind,btrim(p_note),p_actor_id);
 update public.crm_customers set row_version=row_version+1,updated_at=now() where id=p_id returning row_version into v;
 insert into public.audit_logs(actor_account_id,action,entity_type,entity_id,after_data) values(p_actor_id,'crm.activity','crm_customer',p_id::text,jsonb_build_object('activityId',p_activity_id,'kind',p_kind,'rowVersion',v));
 return jsonb_build_object('customerId',p_id,'rowVersion',v);
end $$;

-- Internal helpers are never callable via PostgREST; commands remain service only.
revoke all on function public.crm_assert_actor(uuid,text[]),public.crm_validate_documents(jsonb,jsonb,text),public.crm_save_customer(uuid,integer,jsonb,jsonb,text,text,uuid),public.crm_convert_trial(uuid,uuid,integer,jsonb,uuid),public.crm_add_activity(uuid,uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.crm_save_customer(uuid,integer,jsonb,jsonb,text,text,uuid),public.crm_convert_trial(uuid,uuid,integer,jsonb,uuid),public.crm_add_activity(uuid,uuid,integer,text,text,uuid) to service_role;

create function public.submit_product_trial_request_v2(p_request_id uuid,p_payload jsonb,p_qualification jsonb,p_payload_hash text,p_requester_hash text,p_contact_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare receipt jsonb; k text;
begin
 if coalesce(jsonb_typeof(p_qualification),'')<>'object' then raise exception 'TRIAL_INVALID_INPUT'; end if;
 -- Empty qualification supports retries from forms opened before this upgrade.
 if p_qualification<>'{}'::jsonb then
   if (select count(*) from jsonb_object_keys(p_qualification))<>9 or not(p_qualification ?& array['companyType','taxCode','companyWebsite','contactRole','province','address','branchCount','currentTools','rolloutWindow']) then raise exception 'TRIAL_INVALID_INPUT'; end if;
   foreach k in array array['companyType','taxCode','companyWebsite','contactRole','province','address','currentTools','rolloutWindow'] loop
     if coalesce(jsonb_typeof(p_qualification->k),'')<>'string' or char_length(p_qualification->>k)>(case k when 'taxCode' then 30 when 'currentTools' then 500 when 'companyWebsite' then 240 when 'address' then 240 else 100 end) then raise exception 'TRIAL_INVALID_INPUT'; end if;
   end loop;
   if p_qualification->>'companyType' not in ('limited','joint_stock','private','household','other') or p_qualification->>'rolloutWindow' not in ('now','quarter','later','exploring')
     or ((p_qualification->>'companyWebsite')<>'' and (p_qualification->>'companyWebsite') !~ '^https?://[^[:space:]@]+$')
     or char_length(btrim(p_qualification->>'contactRole'))<2 or char_length(btrim(p_qualification->>'province'))<2 or char_length(btrim(p_qualification->>'address'))<5
     or coalesce(jsonb_typeof(p_qualification->'branchCount'),'')<>'number' or (p_qualification->>'branchCount') !~ '^[0-9]+$' or (p_qualification->>'branchCount')::numeric not between 1 and 10000 then raise exception 'TRIAL_INVALID_INPUT'; end if;
 end if;
 receipt:=public.submit_product_trial_request(p_request_id,p_payload,p_payload_hash,p_requester_hash,p_contact_hash);
 update public.product_trial_requests set qualification=p_qualification where request_id=p_request_id and qualification='{}'::jsonb;
 return receipt;
end $$;

create function public.crm_review_trial(p_request_id uuid,p_expected_version integer,p_status text,p_reason text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.product_trial_requests%rowtype; v integer;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','trial_request.manage']);
 if p_request_id is null or p_expected_version is null or p_expected_version<1 or p_status is null or p_status not in ('contacted','qualified','closed') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'TRIAL_INVALID_INPUT'; end if;
 select * into b from public.product_trial_requests where request_id=p_request_id for update;
 if not found then raise exception 'TRIAL_NOT_FOUND'; end if;
 if b.row_version<>p_expected_version then raise exception 'TRIAL_VERSION_CONFLICT'; end if;
 if not ((b.status='new' and p_status in ('contacted','closed')) or (b.status='contacted' and p_status in ('qualified','closed')) or (b.status='qualified' and p_status='closed')) then raise exception 'TRIAL_INVALID_TRANSITION'; end if;
 update public.product_trial_requests set status=p_status,row_version=row_version+1,review_note=btrim(p_reason),reviewed_by=p_actor_id,reviewed_at=now() where request_id=p_request_id returning row_version into v;
 insert into public.audit_logs(actor_account_id,action,entity_type,entity_id,before_data,after_data,reason) values(p_actor_id,'trial_request.review','product_trial_request',p_request_id::text,jsonb_build_object('status',b.status,'rowVersion',b.row_version),jsonb_build_object('status',p_status,'rowVersion',v),btrim(p_reason));
 return jsonb_build_object('requestId',p_request_id,'rowVersion',v,'status',p_status);
end $$;
revoke all on function public.submit_product_trial_request_v2(uuid,jsonb,jsonb,text,text,text),public.crm_review_trial(uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_product_trial_request_v2(uuid,jsonb,jsonb,text,text,text),public.crm_review_trial(uuid,integer,text,text,uuid) to service_role;
revoke execute on function public.submit_product_trial_request(uuid,jsonb,text,text,text),public.review_product_trial_request(uuid,integer,text,text,uuid) from service_role;
