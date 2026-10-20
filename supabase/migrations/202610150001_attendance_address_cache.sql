-- Reverse-geocoding cache with a shared provider lease. Runtime defaults to the Photon project API.
-- Cache keys are hashes of provider configuration + rounded coordinates; there are no employee names or raw GPS columns.
create table public.attendance_address_cache (
  provider_key text not null check (provider_key ~ '^[a-f0-9]{64}$'),
  cache_key text not null check (cache_key ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('resolved','not_found','unavailable')),
  address text check (length(address) between 1 and 800),
  matched_latitude double precision,
  matched_longitude double precision,
  expires_at timestamptz not null,
  primary key (provider_key,cache_key),
  check ((matched_latitude is null and matched_longitude is null) or (matched_latitude is not null and matched_longitude is not null and matched_latitude between -90 and 90 and matched_longitude between -180 and 180)),
  check ((status='resolved' and address is not null and matched_latitude is not null and matched_longitude is not null) or (status<>'resolved' and address is null and matched_latitude is null and matched_longitude is null))
);
create index attendance_address_cache_expiry_idx on public.attendance_address_cache(expires_at);

create table public.attendance_address_provider_gate (
  provider_key text primary key check (provider_key ~ '^[a-f0-9]{64}$'),
  not_before timestamptz not null default now(),
  lease_id uuid,
  lease_expires_at timestamptz
);
create table public.attendance_address_actor_limits (
  actor_id uuid primary key references public.app_accounts(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests between 0 and 30)
);
alter table public.attendance_address_cache enable row level security;
alter table public.attendance_address_provider_gate enable row level security;
alter table public.attendance_address_actor_limits enable row level security;
revoke all on public.attendance_address_cache,public.attendance_address_provider_gate,public.attendance_address_actor_limits from public,anon,authenticated;

create function public.claim_attendance_address_lookup(p_provider_key text,p_cache_key text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=clock_timestamp();
  v_cached attendance_address_cache%rowtype;
  v_gate attendance_address_provider_gate%rowtype;
  v_actor attendance_address_actor_limits%rowtype;
  v_lease uuid;
begin
  if p_provider_key is null or p_provider_key !~ '^[a-f0-9]{64}$' or p_cache_key is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_actor_id is null then raise exception 'ADDRESS_LOOKUP_INPUT_INVALID';end if;
  perform 1 from app_accounts where id=p_actor_id and status='active';
  if not found then raise exception 'ADDRESS_LOOKUP_ACTOR_DENIED';end if;
  select * into v_cached from attendance_address_cache where provider_key=p_provider_key and cache_key=p_cache_key and expires_at>v_now;
  if found then return jsonb_build_object('status',v_cached.status,'address',v_cached.address,'matchedLatitude',v_cached.matched_latitude,'matchedLongitude',v_cached.matched_longitude);end if;

  -- One distributed provider lease across every application instance, at most one new request per 1.1 seconds.
  insert into attendance_address_provider_gate(provider_key) values(p_provider_key) on conflict do nothing;
  select * into v_gate from attendance_address_provider_gate where provider_key=p_provider_key for update;
  if v_gate.not_before>v_now or v_gate.lease_expires_at>v_now then
    return jsonb_build_object('status','busy','retryAfterMs',greatest(1100,ceil(extract(epoch from (greatest(v_gate.not_before,coalesce(v_gate.lease_expires_at,v_now))-v_now))*1000)));
  end if;
  insert into attendance_address_actor_limits(actor_id,window_start,requests) values(p_actor_id,date_trunc('minute',v_now),0) on conflict do nothing;
  select * into v_actor from attendance_address_actor_limits where actor_id=p_actor_id for update;
  if v_actor.window_start=date_trunc('minute',v_now) and v_actor.requests>=30 then
    return jsonb_build_object('status','rate_limited','retryAfterMs',ceil(extract(epoch from (v_actor.window_start+interval '1 minute'-v_now))*1000));
  end if;
  update attendance_address_actor_limits set window_start=date_trunc('minute',v_now),requests=case when window_start=date_trunc('minute',v_now) then requests+1 else 1 end where actor_id=p_actor_id;
  v_lease:=gen_random_uuid();
  update attendance_address_provider_gate set lease_id=v_lease,lease_expires_at=v_now+interval '12 seconds',not_before=v_now+interval '1100 milliseconds' where provider_key=p_provider_key;
  delete from attendance_address_cache where (provider_key,cache_key) in (select provider_key,cache_key from attendance_address_cache where expires_at<v_now-interval '1 day' limit 100);
  return jsonb_build_object('status','claimed','leaseId',v_lease);
end $$;

create function public.finish_attendance_address_lookup(
  p_provider_key text,p_cache_key text,p_lease_id uuid,p_status text,p_address text,
  p_matched_latitude double precision,p_matched_longitude double precision,p_retry_seconds integer default 0
) returns boolean language plpgsql security definer set search_path=public as $$
declare v_now timestamptz:=clock_timestamp();v_lease uuid;
begin
  if p_status is null or p_status not in ('resolved','not_found','unavailable') or p_retry_seconds is null or p_retry_seconds not between 0 and 3600 then raise exception 'ADDRESS_LOOKUP_INPUT_INVALID';end if;
  select lease_id into v_lease from attendance_address_provider_gate where provider_key=p_provider_key for update;
  if v_lease is distinct from p_lease_id or p_lease_id is null then return false;end if;
  insert into attendance_address_cache(provider_key,cache_key,status,address,matched_latitude,matched_longitude,expires_at)
  values(p_provider_key,p_cache_key,p_status,p_address,p_matched_latitude,p_matched_longitude,
    v_now+case p_status when 'resolved' then interval '30 days' when 'not_found' then interval '1 day' else interval '1 minute' end)
  on conflict(provider_key,cache_key) do update set status=excluded.status,address=excluded.address,matched_latitude=excluded.matched_latitude,matched_longitude=excluded.matched_longitude,expires_at=excluded.expires_at;
  update attendance_address_provider_gate set lease_id=null,lease_expires_at=null,not_before=greatest(not_before,v_now+make_interval(secs=>greatest(1.1,p_retry_seconds))) where provider_key=p_provider_key;
  return true;
end $$;
revoke all on function public.claim_attendance_address_lookup(text,text,uuid) from public,anon,authenticated;
revoke all on function public.finish_attendance_address_lookup(text,text,uuid,text,text,double precision,double precision,integer) from public,anon,authenticated;
grant execute on function public.claim_attendance_address_lookup(text,text,uuid) to service_role;
grant execute on function public.finish_attendance_address_lookup(text,text,uuid,text,text,double precision,double precision,integer) to service_role;
