-- Forward compatibility for the six shared-project industry packs. Applied migrations stay immutable.
alter table public.product_trial_requests drop constraint product_trial_requests_industry_check;
alter table public.product_trial_requests add constraint product_trial_requests_industry_check check(industry in ('construction','trading','services','garment','other','metalworking','plastics_packaging','electronics','food_beverage'));
do $$declare f text;old text;begin
 old:='(''construction'',''trading'',''services'',''garment'',''other'')';
 select pg_get_functiondef('public.submit_product_trial_request(uuid,jsonb,text,text,text)'::regprocedure) into f;
 if strpos(f,old)=0 then raise exception 'Intake definition changed; review industry extension';end if;
 execute replace(f,old,'(''construction'',''trading'',''services'',''garment'',''other'',''metalworking'',''plastics_packaging'',''electronics'',''food_beverage'')');
 select pg_get_functiondef('public.crm_validate_documents(jsonb,jsonb,text)'::regprocedure) into f;
 old:='(''general'',''construction'',''garment'',''trading'',''services'')';
 if strpos(f,old)=0 then raise exception 'CRM validator changed; review industry extension';end if;
 execute replace(f,old,'(''general'',''construction'',''garment'',''trading'',''services'',''metalworking'',''plastics_packaging'',''electronics'',''food_beverage'')');
 select pg_get_functiondef('public.crm_save_customer(uuid,integer,jsonb,jsonb,text,text,uuid)'::regprocedure) into f;
 old:='perform public.crm_validate_documents(p_profile,p_setup,p_stage);';
 if strpos(f,old)=0 then raise exception 'CRM save changed; review workspace integration';end if;
 f:=replace(f,old,'perform public.crm_validate_documents(p_profile,p_setup,case when exists(select 1 from public.business_tenants where customer_id=p_id) then ''discovery'' else p_stage end);');
 old:='a:=case when b.stage<>p_stage then ''stage'' else ''updated'' end;';
 if strpos(f,old)=0 then raise exception 'CRM lifecycle changed; review workspace integration';end if;
 f:=replace(f,old,old||E'\n   if b.stage<>p_stage then\n    update public.business_tenants set status=case when p_stage in (''paused'',''closed'') then ''suspended'' when p_stage=''active'' then ''active'' when p_stage=''trial'' then ''trial'' else status end,row_version=row_version+1 where customer_id=p_id;\n    if p_stage in (''paused'',''closed'') then update public.business_sessions set revoked_at=now() where tenant_id in (select id from public.business_tenants where customer_id=p_id);end if;\n   end if;');
 execute f;
end $$;

create function public.business_reset_owner(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_password_hash text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;a public.business_accounts%rowtype;r jsonb;h text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
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

create or replace function public.business_manage_workspace(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_status text,p_days integer,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;r jsonb;h text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_status is null or p_status not in ('trial','active','suspended') or p_days is null or p_days not between 1 and 90 or p_expected_version is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
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
revoke all on function public.business_reset_owner(uuid,uuid,integer,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_reset_owner(uuid,uuid,integer,text,uuid) to service_role;
