create function public.business_quality_trend(p_hash text,p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;months jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,false);
 perform public.business_assert_kind(a.tenant_id,'safety_incidents');
 perform public.business_assert_kind(a.tenant_id,'quality_nonconformances');
 with period as (
  select month_start::date month_start from generate_series(date_trunc('month',today)::date-interval '11 months',date_trunc('month',today)::date,interval '1 month') month_start
 ), events as (
  select date_trunc('month',r.incident_date)::date month_start,'incident'::text kind,r.severity
  from public.business_safety_incidents r
  where r.tenant_id=a.tenant_id and r.incident_date>=date_trunc('month',today)::date-interval '11 months' and r.incident_date<date_trunc('month',today)::date+interval '1 month'
   and public.business_access_allowed(a.id,'safety_incidents','read',to_jsonb(r))
  union all
  select date_trunc('month',r.detected_on)::date month_start,'quality'::text kind,r.severity
  from public.business_quality_nonconformances r
  where r.tenant_id=a.tenant_id and r.detected_on>=date_trunc('month',today)::date-interval '11 months' and r.detected_on<date_trunc('month',today)::date+interval '1 month'
   and public.business_access_allowed(a.id,'quality_nonconformances','read',to_jsonb(r))
 ), totals as (
  select month_start,count(*) filter(where kind='incident')::integer incidents,
   count(*) filter(where kind='incident' and severity='critical')::integer critical,
   count(*) filter(where kind='quality')::integer nonconformances
  from events group by month_start
 )
 select coalesce(jsonb_agg(jsonb_build_object('month',to_char(p.month_start,'YYYY-MM'),'incidents',coalesce(t.incidents,0),'critical',coalesce(t.critical,0),'nonconformances',coalesce(t.nonconformances,0)) order by p.month_start),'[]'::jsonb)
 into months from period p left join totals t using(month_start);
 return jsonb_build_object('months',months,'periodMonths',12,'asOf',today);
end $$;
revoke all on function public.business_quality_trend(text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_quality_trend(text,text) to service_role;
