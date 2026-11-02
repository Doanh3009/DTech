-- Immutable policy versions and tenant-local, time-bounded approval delegation.
create table public.business_approval_policies(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),kind text not null references public.business_entity_definitions(kind),
 version integer not null check(version>0),name text not null check(char_length(btrim(name)) between 2 and 120),active boolean not null,
 amount_field text not null,minimum_amount numeric(24,4) not null default 0 check(minimum_amount>=0),steps jsonb not null,
 created_by uuid not null,created_at timestamptz not null default now(),reason text not null,
 unique(tenant_id,id),unique(tenant_id,kind,version),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id)
);
create unique index business_active_approval_policy on public.business_approval_policies(tenant_id,kind) where active;
create table public.business_approval_delegations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),principal_id uuid not null,delegate_id uuid not null,
 kinds text[] not null,starts_at timestamptz not null,ends_at timestamptz not null,reason text not null,revoked_at timestamptz,
 created_by uuid not null,created_at timestamptz not null default now(),unique(tenant_id,id),
 foreign key(tenant_id,principal_id) references public.business_accounts(tenant_id,id),foreign key(tenant_id,delegate_id) references public.business_accounts(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),
 check(principal_id<>delegate_id),check(ends_at>starts_at),check(cardinality(kinds)>0)
);
create index business_approval_delegate_lookup on public.business_approval_delegations(tenant_id,delegate_id,principal_id,starts_at,ends_at) where revoked_at is null;
create table public.business_approval_runs(
 id uuid primary key default gen_random_uuid(),sequence_no bigint generated always as identity,tenant_id uuid not null,kind text not null references public.business_entity_definitions(kind),record_id uuid not null,policy_id uuid not null,
 policy_version integer not null,policy_name text not null,steps jsonb not null,fingerprint text not null,
 status text not null check(status in ('pending','approved','returned','rejected','recalled','superseded','posted','cancelled','reversed')),
 current_step integer not null default 0,step_started_at timestamptz not null default now(),document_version integer not null,
 submitted_by uuid not null,created_at timestamptz not null default now(),finished_at timestamptz,
 unique(tenant_id,id),foreign key(tenant_id,policy_id) references public.business_approval_policies(tenant_id,id),foreign key(tenant_id,submitted_by) references public.business_accounts(tenant_id,id)
);
create unique index business_current_approval_run on public.business_approval_runs(tenant_id,kind,record_id) where status in ('pending','approved');
create index business_approval_record_history on public.business_approval_runs(tenant_id,kind,record_id,created_at desc);
create table public.business_approval_decisions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,run_id uuid not null,step integer not null,actor_id uuid not null,principal_id uuid,
 decision text not null check(decision in ('approve','return','reject','recall')),reason text not null,actor_name text not null,principal_name text,
 delegation_id uuid,created_at timestamptz not null default clock_timestamp(),unique(tenant_id,id),
 foreign key(tenant_id,run_id) references public.business_approval_runs(tenant_id,id),foreign key(tenant_id,actor_id) references public.business_accounts(tenant_id,id),foreign key(tenant_id,principal_id) references public.business_accounts(tenant_id,id),foreign key(tenant_id,delegation_id) references public.business_approval_delegations(tenant_id,id)
);
create unique index business_one_approval_per_actor on public.business_approval_decisions(tenant_id,run_id,actor_id) where decision='approve';
create unique index business_one_approval_per_principal on public.business_approval_decisions(tenant_id,run_id,step,principal_id) where decision='approve';
do $$ declare t text;begin foreach t in array array['business_approval_policies','business_approval_delegations','business_approval_runs','business_approval_decisions'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;end $$;

create function public.business_approval_kind(p_tenant uuid,p_kind text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;
begin
 d:=public.business_assert_kind(p_tenant,p_kind);
 if d->>'mode'='master' or coalesce((d->>'generatedOnly')::boolean,false) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 return d;
end $$;
create function public.business_approval_account(p_tenant uuid,p_id uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.business_accounts a where a.tenant_id=p_tenant and a.id=p_id and a.status='active' and a.role in ('owner','editor') and (a.access_expires_at is null or a.access_expires_at>now()) and (a.staff_id is null or exists(select 1 from public.business_staff where tenant_id=a.tenant_id and id=a.staff_id and status='active'))) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
end $$;
revoke all on function public.business_approval_kind(uuid,text),public.business_approval_account(uuid,uuid) from public,anon,authenticated,service_role;

create function public.business_approval_policy_save(p_hash text,p_slug text,p_request_id uuid,p_expected_version integer,p_data jsonb,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;s jsonb;who uuid;seen uuid[]:='{}';version integer;policy uuid;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'approval.policy',p_payload_hash);if r is not null then return r;end if;
 d:=public.business_approval_kind(a.tenant_id,p_data->>'kind');
 if coalesce(char_length(btrim(p_data->>'name')),0) not between 2 and 120 or coalesce(char_length(btrim(p_data->>'reason')),0) not between 3 and 500 or coalesce(jsonb_typeof(p_data->'active'),'')<>'boolean'
 or coalesce(jsonb_typeof(p_data->'steps'),'')<>'array' or jsonb_array_length(p_data->'steps') not between 1 and 8 or coalesce((p_data->>'minimumAmount')::numeric,-1) not between 0 and 1e15 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_data->>'amountField'<>'calculated_total' and not exists(select 1 from jsonb_each(d->'fields') where key=p_data->>'amountField' and value->>'type'='number') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for s in select value from jsonb_array_elements(p_data->'steps') loop
  if coalesce(char_length(btrim(s->>'name')),0) not between 2 and 120 or coalesce(s->>'mode','') not in ('all','any') or coalesce(jsonb_typeof(s->'approverIds'),'')<>'array' or jsonb_array_length(s->'approverIds') not between 1 and 20 or coalesce((s->>'slaHours')::integer,0) not between 1 and 8760 then raise exception 'BUSINESS_INVALID_INPUT';end if;
  for who in select value::uuid from jsonb_array_elements_text(s->'approverIds') loop
   perform public.business_approval_account(a.tenant_id,who);perform public.business_assert_access(who,p_data->>'kind','approve');
   if who=any(seen) then raise exception 'BUSINESS_APPROVAL_DUPLICATE_REVIEWER';end if;seen:=array_append(seen,who);
  end loop;
 end loop;
 select coalesce(max(p.version),0) into version from public.business_approval_policies p where tenant_id=a.tenant_id and kind=p_data->>'kind';
 if p_expected_version is null or version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 update public.business_approval_policies set active=false where tenant_id=a.tenant_id and kind=p_data->>'kind' and active;
 insert into public.business_approval_policies(tenant_id,kind,version,name,active,amount_field,minimum_amount,steps,created_by,reason) values(a.tenant_id,p_data->>'kind',version+1,btrim(p_data->>'name'),(p_data->>'active')::boolean,p_data->>'amountField',(p_data->>'minimumAmount')::numeric,p_data->'steps',a.id,btrim(p_data->>'reason')) returning id into policy;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'approval.policy_version',p_data->>'kind',policy,jsonb_build_object('version',version+1,'configuration',p_data));
 r:=jsonb_build_object('policyId',policy,'version',version+1);insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'approval.policy',p_payload_hash,r);return r;
end $$;

create function public.business_approval_delegation_save(p_hash text,p_slug text,p_request_id uuid,p_id uuid,p_operation text,p_data jsonb,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;prior public.business_approval_delegations%rowtype;k text;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'approval.delegation',p_payload_hash);if r is not null then return r;end if;
 if p_id is null or p_operation is null or p_operation not in ('create','revoke') or coalesce(char_length(btrim(p_data->>'reason')),0) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_operation='create' then
  perform public.business_approval_account(a.tenant_id,(p_data->>'principalId')::uuid);perform public.business_approval_account(a.tenant_id,(p_data->>'delegateId')::uuid);
  if p_data->>'principalId'=p_data->>'delegateId' or coalesce(jsonb_typeof(p_data->'kinds'),'')<>'array' or jsonb_array_length(p_data->'kinds') not between 1 and 300 or (p_data->>'startsAt')::timestamptz>=(p_data->>'endsAt')::timestamptz or (p_data->>'endsAt')::timestamptz<=now() then raise exception 'BUSINESS_INVALID_INPUT';end if;
  for k in select jsonb_array_elements_text(p_data->'kinds') loop perform public.business_approval_kind(a.tenant_id,k);perform public.business_assert_access((p_data->>'delegateId')::uuid,k,'approve');end loop;
  if exists(select 1 from public.business_approval_delegations d where d.tenant_id=a.tenant_id and d.principal_id=(p_data->>'principalId')::uuid and d.revoked_at is null and d.starts_at<(p_data->>'endsAt')::timestamptz and d.ends_at>(p_data->>'startsAt')::timestamptz and d.kinds && array(select jsonb_array_elements_text(p_data->'kinds'))) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
  insert into public.business_approval_delegations(id,tenant_id,principal_id,delegate_id,kinds,starts_at,ends_at,reason,created_by) values(p_id,a.tenant_id,(p_data->>'principalId')::uuid,(p_data->>'delegateId')::uuid,array(select jsonb_array_elements_text(p_data->'kinds')),(p_data->>'startsAt')::timestamptz,(p_data->>'endsAt')::timestamptz,btrim(p_data->>'reason'),a.id);
 else
  select * into prior from public.business_approval_delegations where tenant_id=a.tenant_id and id=p_id and revoked_at is null for update;if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  update public.business_approval_delegations set revoked_at=now() where tenant_id=a.tenant_id and id=p_id;
 end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'approval.delegation_'||p_operation,'accounts',p_id,p_data);
 r:=jsonb_build_object('delegationId',p_id,'operation',p_operation);insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'approval.delegation',p_payload_hash,r);return r;
end $$;

create function public.business_approval_settings(p_hash text,p_slug text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;policies jsonb;accounts jsonb;delegations jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by kind,version desc),'[]') into policies from (select distinct on(kind) * from public.business_approval_policies where tenant_id=a.tenant_id order by kind,version desc)p;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'username',username) order by display_name),'[]') into accounts from public.business_accounts where tenant_id=a.tenant_id and status='active' and role in ('owner','editor');
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') into delegations from (select d.*,p.display_name principal_name,s.display_name delegate_name from public.business_approval_delegations d join public.business_accounts p on p.tenant_id=d.tenant_id and p.id=d.principal_id join public.business_accounts s on s.tenant_id=d.tenant_id and s.id=d.delegate_id where d.tenant_id=a.tenant_id order by d.created_at desc limit 100)x;
 return jsonb_build_object('policies',policies,'accounts',accounts,'delegations',delegations);
end $$;
revoke all on function public.business_approval_policy_save(text,text,uuid,integer,jsonb,text),public.business_approval_delegation_save(text,text,uuid,uuid,text,jsonb,text),public.business_approval_settings(text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_approval_policy_save(text,text,uuid,integer,jsonb,text),public.business_approval_delegation_save(text,text,uuid,uuid,text,jsonb,text),public.business_approval_settings(text,text) to service_role;
