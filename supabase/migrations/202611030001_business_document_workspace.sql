-- Internal document numbers are allocated only inside a successful save transaction.
create table public.business_record_numbers (
 tenant_id uuid not null references public.business_tenants(id),kind text not null references public.business_entity_definitions(kind),
 year integer not null check(year between 2000 and 9999),last_value bigint not null check(last_value between 1 and 999999999999),
 primary key(tenant_id,kind,year)
);
alter table public.business_record_numbers enable row level security;
revoke all on public.business_record_numbers from public,anon,authenticated,service_role;

create function public.business_save_record_numbered(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;r jsonb;y integer;n bigint;prefix text;code text;taken boolean;attempt integer:=0;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 if p_expected_version is distinct from 0 or d->>'mode'='master' or coalesce(p_data->>'code','')<>'' or p_id is null or coalesce(jsonb_typeof(p_data),'')<>'object' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 perform public.business_assert_access(a.id,p_kind,'create',p_data||jsonb_build_object('id',p_id,'tenant_id',a.tenant_id,'created_by',a.id));
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 y:=extract(year from now() at time zone 'Asia/Ho_Chi_Minh');
 select string_agg(upper(left(part,1)),'') into prefix from unnest(string_to_array(p_kind,'_')) part;
 loop
  insert into public.business_record_numbers(tenant_id,kind,year,last_value) values(a.tenant_id,p_kind,y,1)
  on conflict(tenant_id,kind,year) do update set last_value=business_record_numbers.last_value+1 returning last_value into n;
  code:=prefix||'-'||y||'-'||lpad(n::text,greatest(6,length(n::text)),'0');
  execute format('select exists(select 1 from public.%I where tenant_id=$1 and lower(code)=lower($2))',public.business_entity_table(p_kind)) into taken using a.tenant_id,code;
  exit when not taken;attempt:=attempt+1;if attempt>=1000 then raise exception 'BUSINESS_NUMBERING_CONFLICT';end if;
 end loop;
 return public.business_save_record(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data||jsonb_build_object('code',code),p_request_id,p_payload_hash);
end $$;

create function public.business_record_history(p_hash text,p_slug text,p_kind text,p_id uuid,p_page integer default 1) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;doc jsonb;rows jsonb;n bigint;
begin
 a:=public.business_assert_session(p_hash,p_slug);doc:=public.business_record_detail(p_hash,p_slug,p_kind,p_id);
 if p_page is null or p_page not between 1 and 100000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select count(*) into n from public.business_audit where tenant_id=a.tenant_id and entity_kind=p_kind and entity_id=p_id;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into rows from (
  select h.id,h.action,coalesce(u.display_name,'Hệ thống') actor,h.created_at,
   case when a.role='viewer' then null else left(h.details->>'reason',500) end reason,
   h.details->'rowVersion' version
  from public.business_audit h left join public.business_accounts u on u.tenant_id=h.tenant_id and u.id=h.actor_id
  where h.tenant_id=a.tenant_id and h.entity_kind=p_kind and h.entity_id=p_id
  order by h.created_at desc,h.id desc limit 25 offset (p_page-1)*25
 ) x;
 return jsonb_build_object('rows',rows,'total',n,'page',p_page,'recordId',p_id,'code',doc->>'code');
end $$;
revoke all on function public.business_save_record_numbered(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_history(text,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_save_record_numbered(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_history(text,text,text,uuid,integer) to service_role;
notify pgrst,'reload schema';
