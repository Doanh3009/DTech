-- Public lead intake is mediated by the application; no anonymous table/RPC access.
insert into public.permissions(key,module,description) values
  ('trial_request.view','system','Xem yêu cầu dùng thử sản phẩm'),
  ('trial_request.manage','system','Xử lý yêu cầu dùng thử sản phẩm')
on conflict(key) do nothing;
insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r cross join public.permissions p
where r.code='admin' and p.key in ('trial_request.view','trial_request.manage') on conflict do nothing;

create table public.product_trial_requests (
  request_id uuid primary key,
  created_at timestamptz not null default now(),
  company_name text not null check(char_length(company_name) between 2 and 180),
  contact_name text not null check(char_length(contact_name) between 2 and 120),
  email text not null check(char_length(email) between 5 and 254),
  phone text not null check(char_length(phone) between 9 and 24),
  industry text not null check(industry in ('construction','trading','services','garment','other')),
  company_size text not null check(company_size in ('under_20','20_100','101_300','over_300')),
  needs text not null default '' check(char_length(needs)<=1500),
  consent_version text not null default '2026-10-22.v1' check(consent_version='2026-10-22.v1'),
  consent_at timestamptz not null default now(),
  payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
  requester_hash text not null check(requester_hash ~ '^[a-f0-9]{64}$'),
  contact_hash text not null check(contact_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'new' check(status in ('new','contacted','qualified','closed')),
  row_version integer not null default 1 check(row_version>0),
  review_note text check(char_length(review_note)<=500),
  reviewed_by uuid references public.app_accounts(id),
  reviewed_at timestamptz
);
create index product_trial_requests_status_date_idx on public.product_trial_requests(status,created_at desc);
create index product_trial_requests_requester_date_idx on public.product_trial_requests(requester_hash,created_at desc);
create index product_trial_requests_contact_date_idx on public.product_trial_requests(contact_hash,created_at desc);
alter table public.product_trial_requests enable row level security;
revoke all on public.product_trial_requests from public,anon,authenticated,service_role;
grant select on public.product_trial_requests to service_role;

create function public.submit_product_trial_request(
  p_request_id uuid,p_payload jsonb,p_payload_hash text,p_requester_hash text,p_contact_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_existing public.product_trial_requests%rowtype; v_key text;
begin
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
    or p_requester_hash is null or p_requester_hash !~ '^[a-f0-9]{64}$'
    or p_contact_hash is null or p_contact_hash !~ '^[a-f0-9]{64}$'
    or (select count(*) from jsonb_object_keys(p_payload))<>8
    or not (p_payload ?& array['companyName','contactName','email','phone','industry','companySize','needs','consent'])
    or p_payload->'consent'<>'true'::jsonb then raise exception 'TRIAL_INVALID_INPUT'; end if;
  foreach v_key in array array['companyName','contactName','email','phone','industry','companySize','needs'] loop
    if jsonb_typeof(p_payload->v_key)<>'string' then raise exception 'TRIAL_INVALID_INPUT'; end if;
  end loop;
  if char_length(p_payload->>'companyName') not between 2 and 180
    or char_length(p_payload->>'contactName') not between 2 and 120
    or char_length(p_payload->>'email')>254
    or (p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(p_payload->>'phone') not between 9 and 24
    or (p_payload->>'phone') !~ '^[+0-9() .-]+$'
    or char_length(regexp_replace(p_payload->>'phone','[^0-9]','','g')) not between 9 and 15
    or (p_payload->>'industry') not in ('construction','trading','services','garment','other')
    or (p_payload->>'companySize') not in ('under_20','20_100','101_300','over_300')
    or char_length(p_payload->>'needs')>1500 then raise exception 'TRIAL_INVALID_INPUT'; end if;

  -- One global lock also bounds distributed/spoofed-address abuse; replay precedes quotas.
  perform pg_advisory_xact_lock(hashtextextended('dtech:product-trial-submit',0));
  select * into v_existing from public.product_trial_requests where request_id=p_request_id for update;
  if found then
    if v_existing.payload_hash<>p_payload_hash then raise exception 'TRIAL_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('requestId',p_request_id,'received',true);
  end if;
  if (select count(*) from public.product_trial_requests where created_at>now()-interval '1 hour')>=100
    or (select count(*) from public.product_trial_requests where requester_hash=p_requester_hash and created_at>now()-interval '1 hour')>=5
    or (select count(*) from public.product_trial_requests where contact_hash=p_contact_hash and created_at>now()-interval '1 hour')>=2
    then raise exception 'TRIAL_RATE_LIMITED'; end if;
  insert into public.product_trial_requests(request_id,company_name,contact_name,email,phone,industry,company_size,needs,payload_hash,requester_hash,contact_hash)
    values(p_request_id,p_payload->>'companyName',p_payload->>'contactName',p_payload->>'email',p_payload->>'phone',p_payload->>'industry',p_payload->>'companySize',p_payload->>'needs',p_payload_hash,p_requester_hash,p_contact_hash);
  return jsonb_build_object('requestId',p_request_id,'received',true);
end $$;

create function public.review_product_trial_request(p_request_id uuid,p_expected_version integer,p_status text,p_reason text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before public.product_trial_requests%rowtype; v_version integer;
begin
  if p_request_id is null or p_expected_version is null or p_expected_version<1 or p_status is null
    or p_status not in ('contacted','qualified','closed') or p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'TRIAL_INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dtech:account-lifecycle-command',0));
  if not exists(select 1 from public.app_accounts where id=p_actor_id and status='active')
    or exists(select unnest(array['system_admin.access','trial_request.manage']) except
      select rp.permission_key from public.account_roles ar join public.role_permissions rp on rp.role_id=ar.role_id where ar.account_id=p_actor_id)
    then raise exception 'TRIAL_ACTOR_FORBIDDEN'; end if;
  select * into v_before from public.product_trial_requests where request_id=p_request_id for update;
  if not found then raise exception 'TRIAL_NOT_FOUND'; end if;
  if v_before.row_version<>p_expected_version then raise exception 'TRIAL_VERSION_CONFLICT'; end if;
  if not ((v_before.status='new' and p_status in ('contacted','closed'))
    or (v_before.status='contacted' and p_status in ('qualified','closed'))
    or (v_before.status='qualified' and p_status='closed')) then raise exception 'TRIAL_INVALID_TRANSITION'; end if;
  update public.product_trial_requests set status=p_status,row_version=row_version+1,review_note=btrim(p_reason),reviewed_by=p_actor_id,reviewed_at=now()
    where request_id=p_request_id returning row_version into v_version;
  insert into public.audit_logs(actor_account_id,action,entity_type,entity_id,before_data,after_data,reason)
    values(p_actor_id,'trial_request.review','product_trial_request',p_request_id::text,
      jsonb_build_object('status',v_before.status,'rowVersion',v_before.row_version),jsonb_build_object('status',p_status,'rowVersion',v_version),btrim(p_reason));
  return jsonb_build_object('requestId',p_request_id,'status',p_status,'rowVersion',v_version);
end $$;

revoke all on function public.submit_product_trial_request(uuid,jsonb,text,text,text) from public,anon,authenticated,service_role;
revoke all on function public.review_product_trial_request(uuid,integer,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_product_trial_request(uuid,jsonb,text,text,text) to service_role;
grant execute on function public.review_product_trial_request(uuid,integer,text,text,uuid) to service_role;
