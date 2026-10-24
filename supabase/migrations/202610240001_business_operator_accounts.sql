-- Operator-only access management for the separate customer identity domain.
create function public.business_operator_accounts(p_customer_id uuid,p_actor_id uuid,p_page integer default 1,p_query text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;rows jsonb;n bigint;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view']);
 if p_page is null or p_page not between 1 and 100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into t from public.business_tenants where customer_id=p_customer_id;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select count(*) into n from public.business_accounts where tenant_id=t.id and (strpos(lower(username),lower(p_query))>0 or strpos(lower(display_name),lower(p_query))>0);
 select coalesce(jsonb_agg(to_jsonb(x) order by username),'[]'::jsonb) into rows from (select id,username,display_name,role,status,must_change_password from public.business_accounts where tenant_id=t.id and (strpos(lower(username),lower(p_query))>0 or strpos(lower(display_name),lower(p_query))>0) order by username limit 25 offset (p_page-1)*25) x;
 return jsonb_build_object('rowVersion',t.row_version,'accounts',rows,'total',n,'page',p_page,'pageSize',25);
end $$;

create function public.business_operator_account_command(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_operation text,p_account_id uuid,p_data jsonb,p_password_hash text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.business_tenants%rowtype;c public.crm_customers%rowtype;a public.business_accounts%rowtype;h text;r jsonb;note text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_request_id is null or p_account_id is null or p_expected_version is null or p_operation is null or p_operation not in ('create','reset','disable','enable') or coalesce(jsonb_typeof(p_data),'')<>'object' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_operation in ('create','reset') and (p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_operation not in ('create','reset') and p_password_hash is not null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_operation='create' then
  if (select count(*) from jsonb_object_keys(p_data))<>3 or not(p_data ?& array['username','displayName','role']) or coalesce(jsonb_typeof(p_data->'username'),'')<>'string' or coalesce(jsonb_typeof(p_data->'displayName'),'')<>'string' or coalesce(jsonb_typeof(p_data->'role'),'')<>'string' or (p_data->>'username') !~ '^[a-z][a-z0-9._-]{2,31}$' or char_length(btrim(p_data->>'displayName')) not between 2 and 100 or (p_data->>'role') not in ('editor','viewer') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 elsif p_data<>'{}'::jsonb then raise exception 'BUSINESS_INVALID_INPUT';end if;
 -- Same lock order as CRM configuration: operator -> customer -> tenant -> account -> sessions.
 select * into c from public.crm_customers where id=p_customer_id for update;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select * into t from public.business_tenants where customer_id=p_customer_id for update;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 h:=encode(sha256(convert_to(jsonb_build_object('customerId',p_customer_id,'version',p_expected_version,'operation',p_operation,'accountId',p_account_id,'data',p_data,'passwordHash',p_password_hash)::text,'UTF8')),'hex');
 r:=public.business_command_replay(p_request_id,t.id,p_actor_id,'account.'||p_operation,h);if r is not null then return r;end if;
 if t.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_operation='create' then
  insert into public.business_accounts(id,tenant_id,username,display_name,password_hash,role,must_change_password) values(p_account_id,t.id,p_data->>'username',btrim(p_data->>'displayName'),p_password_hash,p_data->>'role',true) returning * into a;
  note:='Đã cấp tài khoản '||a.display_name;
 else
  select * into a from public.business_accounts where tenant_id=t.id and id=p_account_id for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
  if a.role='owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
  if p_operation='reset' then
   update public.business_accounts set password_hash=p_password_hash,must_change_password=true,credential_version=credential_version+1 where tenant_id=t.id and id=a.id;note:='Đã cấp lại mật khẩu '||a.display_name;
  elsif p_operation='disable' then
   if a.status<>'active' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_accounts set status='disabled',credential_version=credential_version+1 where tenant_id=t.id and id=a.id;note:='Đã tạm ngừng tài khoản '||a.display_name;
  else
   if a.status<>'disabled' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_accounts set status='active' where tenant_id=t.id and id=a.id;note:='Đã mở lại tài khoản '||a.display_name;
  end if;
  if p_operation in ('reset','disable') then update public.business_sessions set revoked_at=now() where tenant_id=t.id and account_id=a.id and revoked_at is null;end if;
 end if;
 update public.business_tenants set row_version=row_version+1 where id=t.id;
 update public.crm_customers set row_version=row_version+1,updated_at=now() where id=c.id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(t.id,p_actor_id,'account.'||p_operation,'business_accounts',a.id,jsonb_build_object('username',a.username,'role',a.role));
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),c.id,'updated',note,p_actor_id);
 r:=jsonb_build_object('accountId',a.id,'username',a.username,'displayName',a.display_name,'rowVersion',t.row_version+1,'customerVersion',c.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'account.'||p_operation,h,r);return r;
exception when unique_violation then raise exception 'BUSINESS_DUPLICATE';end $$;

revoke all on function public.business_operator_accounts(uuid,uuid,integer,text),public.business_operator_account_command(uuid,uuid,integer,text,uuid,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_operator_accounts(uuid,uuid,integer,text),public.business_operator_account_command(uuid,uuid,integer,text,uuid,jsonb,text,uuid) to service_role;
