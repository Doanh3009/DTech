insert into public.business_industry_packs(key,label,features)
select key,label,features||'"collaboration"'::jsonb from public.business_industry_packs
on conflict(key) do update set features=excluded.features;
update public.business_tenants set features=features||'"collaboration"'::jsonb,row_version=row_version+1 where not(features ? 'collaboration') and industry in (select key from public.business_industry_packs where features ? 'collaboration');
update public.business_industry_packs set features=features||'"quality"'::jsonb where key in ('trading','construction') and not(features ? 'quality');
update public.business_tenants set features=features||'"quality"'::jsonb,row_version=row_version+1 where industry in ('trading','construction') and not(features ? 'quality');
insert into public.business_entity_definitions(kind,definition) values
('meeting_rooms','{"label":"Ph\u00f2ng h\u1ecdp","feature":"collaboration","mode":"master","fields":{"location":{"label":"V\u1ecb tr\u00ed","type":"text","max":160},"capacity":{"label":"S\u1ee9c ch\u1ee9a","type":"number","min":1,"integer":true},"room_state":{"label":"Tr\u1ea1ng th\u00e1i","type":"enum","values":{"active":"\u0110ang s\u1eed d\u1ee5ng","inactive":"Ng\u1eebng s\u1eed d\u1ee5ng"},"default":"active"}}}'::jsonb),
('meetings','{"label":"Cu\u1ed9c h\u1ecdp","feature":"collaboration","mode":"document","fields":{"meeting_date":{"label":"Ng\u00e0y h\u1ecdp","type":"date","required":true},"starts_at":{"label":"B\u1eaft \u0111\u1ea7u","type":"time","required":true},"ends_at":{"label":"K\u1ebft th\u00fac","type":"time","required":true},"timezone":{"label":"M\u00fai gi\u1edd","type":"text","required":true,"max":64,"default":"Asia/Ho_Chi_Minh"},"room_id":{"label":"Ph\u00f2ng h\u1ecdp","type":"ref","ref":"meeting_rooms"},"organizer_staff_id":{"label":"Ng\u01b0\u1eddi ch\u1ee7 tr\u00ec","type":"ref","ref":"staff"},"meeting_state":{"label":"Tr\u1ea1ng th\u00e1i","type":"enum","values":{"planned":"D\u1ef1 ki\u1ebfn","confirmed":"\u0110\u00e3 x\u00e1c nh\u1eadn","completed":"Ho\u00e0n th\u00e0nh","cancelled":"\u0110\u00e3 h\u1ee7y"},"default":"planned"}},"lineKind":"meeting_attendees"}'::jsonb),
('meeting_attendees','{"label":"Ng\u01b0\u1eddi tham d\u1ef1","feature":"collaboration","mode":"document","parentKind":"meetings","parentField":"meeting_id","fields":{"meeting_id":{"label":"Cu\u1ed9c h\u1ecdp","type":"ref","ref":"meetings","required":true},"staff_id":{"label":"Nh\u00e2n s\u1ef1","type":"ref","ref":"staff","required":true},"response_state":{"label":"Ph\u1ea3n h\u1ed3i","type":"enum","values":{"invited":"\u0110\u00e3 m\u1eddi","accepted":"Ch\u1ea5p nh\u1eadn","declined":"T\u1eeb ch\u1ed1i"},"default":"invited"}}}'::jsonb);
create table public.business_meeting_rooms(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),location text not null default '' check(char_length(location)<=160),capacity integer check(capacity is null or capacity between 1 and 100000),room_state text not null default 'active' check(room_state in ('active','inactive')),unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id));
create unique index business_meeting_rooms_code_idx on public.business_meeting_rooms(tenant_id,lower(code));
create table public.business_meetings(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),meeting_date date not null,starts_at time not null,ends_at time not null,timezone text not null default 'Asia/Ho_Chi_Minh' check(char_length(timezone)<=64),room_id uuid,organizer_staff_id uuid,meeting_state text not null default 'planned' check(meeting_state in ('planned','confirmed','completed','cancelled')),unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,room_id) references public.business_meeting_rooms(tenant_id,id),foreign key(tenant_id,organizer_staff_id) references public.business_staff(tenant_id,id),check(starts_at<ends_at));
create unique index business_meetings_code_idx on public.business_meetings(tenant_id,lower(code));
create table public.business_meeting_attendees(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),meeting_id uuid not null,staff_id uuid not null,response_state text not null default 'invited' check(response_state in ('invited','accepted','declined')),unique(tenant_id,id),unique(tenant_id,meeting_id,staff_id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,meeting_id) references public.business_meetings(tenant_id,id),foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id));
create unique index business_meeting_attendees_code_idx on public.business_meeting_attendees(tenant_id,lower(code));
create index business_meetings_tenant_date_idx on public.business_meetings(tenant_id,meeting_date,starts_at);
create index business_meeting_attendees_staff_idx on public.business_meeting_attendees(tenant_id,staff_id,meeting_id);
do $$ declare t text;begin foreach t in array array['business_meeting_rooms','business_meetings','business_meeting_attendees'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);execute format('create policy %I on public.%I for all using(false) with check(false)',t||'_deny_direct',t);end loop;end $$;
create table public.business_notifications(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id) on delete cascade,
 recipient_account_id uuid not null references public.business_accounts(id) on delete cascade,
 source_kind text not null check(source_kind='meetings'),source_record_id uuid not null,
 category text not null check(category in ('meeting_invitation')),
 state text not null default 'unread' check(state in ('unread','read')),
 created_at timestamptz not null default now(),read_at timestamptz,
 unique(tenant_id,recipient_account_id,source_kind,source_record_id,category)
);
create index business_notifications_recipient_idx on public.business_notifications(tenant_id,recipient_account_id,state,created_at desc);
alter table public.business_notifications enable row level security;
create policy business_notifications_deny_direct on public.business_notifications for all using(false) with check(false);

create function public.business_meeting_room_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare window_start timestamptz;window_end timestamptz;room_status text;
begin
 if new.meeting_state in ('planned','confirmed') and new.room_id is not null then
  if new.starts_at>=new.ends_at then raise exception 'BUSINESS_MEETING_TIME_INVALID';end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'BUSINESS_MEETING_TIMEZONE_INVALID';end if;
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||new.room_id::text,0));
  select room_state into room_status from public.business_meeting_rooms where tenant_id=new.tenant_id and id=new.room_id;
  if room_status is distinct from 'active' then raise exception 'BUSINESS_MEETING_ROOM_INACTIVE';end if;
  window_start:=(new.meeting_date+new.starts_at) at time zone new.timezone;
  window_end:=(new.meeting_date+new.ends_at) at time zone new.timezone;
  if exists(select 1 from public.business_meetings m where m.tenant_id=new.tenant_id and m.room_id=new.room_id and m.id<>new.id and m.meeting_state in ('planned','confirmed') and (m.meeting_date+m.starts_at) at time zone m.timezone < window_end and (m.meeting_date+m.ends_at) at time zone m.timezone > window_start) then raise exception 'BUSINESS_MEETING_ROOM_CONFLICT';end if;
 end if;
 return new;
end $$;
create trigger business_meeting_room_guard before insert or update of tenant_id,room_id,meeting_date,starts_at,ends_at,timezone,meeting_state on public.business_meetings for each row execute function public.business_meeting_room_guard();

create function public.business_meeting_invitation_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare acct uuid;
begin
 select a.id into acct from public.business_accounts a where a.tenant_id=new.tenant_id and a.staff_id=new.staff_id and a.status='active';
 if acct is not null and exists(select 1 from public.business_meetings m where m.tenant_id=new.tenant_id and m.id=new.meeting_id and m.meeting_state in ('planned','confirmed')) then insert into public.business_notifications(tenant_id,recipient_account_id,source_kind,source_record_id,category) values(new.tenant_id,acct,'meetings',new.meeting_id,'meeting_invitation') on conflict(tenant_id,recipient_account_id,source_kind,source_record_id,category) do nothing;end if;
 return new;
end $$;
create trigger business_meeting_invitation_notice after insert on public.business_meeting_attendees for each row execute function public.business_meeting_invitation_notice();
revoke all on function public.business_meeting_room_guard() from public,anon,authenticated,service_role;
revoke all on function public.business_meeting_invitation_notice() from public,anon,authenticated,service_role;

create function public.business_notifications_workspace(p_hash text,p_slug text,p_page integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;total integer;unread integer;
begin
 a:=public.business_assert_session(p_hash,p_slug);if p_page is null or p_page not between 1 and 10000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select count(*) into total from public.business_notifications n where n.tenant_id=a.tenant_id and n.recipient_account_id=a.id and exists(select 1 from public.business_meeting_attendees ma where ma.tenant_id=n.tenant_id and ma.meeting_id=n.source_record_id and ma.staff_id=a.staff_id) and public.business_access_allowed(a.id,'meetings','read',(select to_jsonb(m) from public.business_meetings m where m.tenant_id=n.tenant_id and m.id=n.source_record_id));
 select count(*) into unread from public.business_notifications n where n.tenant_id=a.tenant_id and n.recipient_account_id=a.id and n.state='unread' and exists(select 1 from public.business_meeting_attendees ma where ma.tenant_id=n.tenant_id and ma.meeting_id=n.source_record_id and ma.staff_id=a.staff_id) and public.business_access_allowed(a.id,'meetings','read',(select to_jsonb(m) from public.business_meetings m where m.tenant_id=n.tenant_id and m.id=n.source_record_id));
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'category',q.category,'state',q.state,'createdAt',q.created_at,'sourceKind',q.source_kind,'sourceRecordId',q.source_record_id) order by q.created_at desc),'[]'::jsonb) into rows from (select n.* from public.business_notifications n where n.tenant_id=a.tenant_id and n.recipient_account_id=a.id and exists(select 1 from public.business_meeting_attendees ma where ma.tenant_id=n.tenant_id and ma.meeting_id=n.source_record_id and ma.staff_id=a.staff_id) and public.business_access_allowed(a.id,'meetings','read',(select to_jsonb(m) from public.business_meetings m where m.tenant_id=n.tenant_id and m.id=n.source_record_id)) order by n.created_at desc offset (p_page-1)*25 limit 25)q;
 return jsonb_build_object('rows',rows,'total',total,'unread',unread,'page',p_page,'pageSize',25);
end $$;
revoke all on function public.business_notifications_workspace(text,text,integer) from public,anon,authenticated,service_role;grant execute on function public.business_notifications_workspace(text,text,integer) to service_role;
create function public.business_notification_read(p_hash text,p_slug text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;
begin a:=public.business_assert_session(p_hash,p_slug);update public.business_notifications set state='read',read_at=coalesce(read_at,now()) where id=p_id and tenant_id=a.tenant_id and recipient_account_id=a.id;return jsonb_build_object('ok',true);end $$;
revoke all on function public.business_notification_read(text,text,uuid) from public,anon,authenticated,service_role;grant execute on function public.business_notification_read(text,text,uuid) to service_role;

do $$ declare body text;anchor text;replacement text;begin
 select pg_get_functiondef('public.business_access_allowed(uuid,text,text,jsonb)'::regprocedure) into body;
 anchor:='select * into a from public.business_accounts where id=p_actor and status=''active'';if not found then return false;end if;';
 replacement:=anchor||E'\n'||' if p_kind=''meetings'' and p_action=''read'' and coalesce((v->>''organizer_staff_id'')::uuid,''00000000-0000-0000-0000-000000000000''::uuid) is distinct from a.staff_id and not exists(select 1 from public.business_meeting_attendees ma where ma.tenant_id=a.tenant_id and ma.meeting_id=(v->>''id'')::uuid and ma.staff_id=a.staff_id) and a.role<>''owner'' then return false;end if; if p_kind=''meetings'' and p_action in (''update'',''cancel'') and coalesce((v->>''organizer_staff_id'')::uuid,''00000000-0000-0000-0000-000000000000''::uuid) is distinct from a.staff_id and a.role<>''owner'' then return false;end if; if p_kind=''meeting_attendees'' and p_action=''read'' and not exists(select 1 from public.business_meetings m where m.tenant_id=a.tenant_id and m.id=(v->>''meeting_id'')::uuid and public.business_access_allowed(a.id,''meetings'',''read'',to_jsonb(m))) then return false;end if; if p_kind=''meeting_attendees'' and p_action<>''read'' and not exists(select 1 from public.business_meetings m where m.tenant_id=a.tenant_id and m.id=(v->>''meeting_id'')::uuid and (m.organizer_staff_id=a.staff_id or a.role=''owner'')) then return false;end if;';
 if strpos(body,anchor)=0 then raise exception 'Review business access control before adding meeting access rules';end if;execute replace(body,anchor,replacement);
end $$;
