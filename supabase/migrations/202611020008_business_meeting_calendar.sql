create function public.business_meeting_calendar(p_hash text,p_slug text,p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,false);perform public.business_assert_kind(a.tenant_id,'meetings');
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>41 then raise exception 'BUSINESS_INVALID_DATE';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'code',q.code,'name',q.name,'date',q.meeting_date,'startsAt',q.starts_at,'endsAt',q.ends_at,'timezone',q.timezone,'state',q.meeting_state,'room',q.room_name) order by q.meeting_date,q.starts_at,q.code),'[]'::jsonb)
 into rows from (
  select m.id,m.code,m.name,m.meeting_date,m.starts_at,m.ends_at,m.timezone,m.meeting_state,r.name room_name
  from public.business_meetings m left join public.business_meeting_rooms r on r.tenant_id=m.tenant_id and r.id=m.room_id
  where m.tenant_id=a.tenant_id and m.status='active' and m.meeting_state<>'cancelled' and m.meeting_date between p_from and p_to
   and public.business_access_allowed(a.id,'meetings','read',to_jsonb(m))
  order by m.meeting_date,m.starts_at,m.code limit 500
 )q;
 return jsonb_build_object('from',p_from,'to',p_to,'rows',rows);
end $$;
revoke all on function public.business_meeting_calendar(text,text,date,date) from public,anon,authenticated,service_role;
grant execute on function public.business_meeting_calendar(text,text,date,date) to service_role;
