create function public.business_approval_report(p_hash text,p_slug text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;pending_count integer;overdue_count integer;returned_count integer;closed_count integer;average_hours numeric;
begin
 a:=public.business_assert_session(p_hash,p_slug);if a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
 select * into t from public.business_tenants where id=a.tenant_id;
 select count(*) filter(where r.status='pending'),count(*) filter(where r.status='pending' and r.step_started_at+make_interval(hours=>(r.steps->r.current_step->>'slaHours')::integer)<now())
 into pending_count,overdue_count from public.business_approval_runs r join public.business_entity_definitions d on d.kind=r.kind
 where r.tenant_id=a.tenant_id and t.features ? (d.definition->>'feature') and (not(d.definition ? 'industries') or d.definition->'industries' ? t.industry) and (not(d.definition ? 'requiresFeatures') or t.features @> (d.definition->'requiresFeatures'));
 select count(*) into returned_count from public.business_approval_decisions x join public.business_approval_runs r on r.tenant_id=x.tenant_id and r.id=x.run_id join public.business_entity_definitions d on d.kind=r.kind
 where x.tenant_id=a.tenant_id and x.decision='return' and x.created_at>=now()-interval '30 days' and t.features ? (d.definition->>'feature') and (not(d.definition ? 'industries') or d.definition->'industries' ? t.industry) and (not(d.definition ? 'requiresFeatures') or t.features @> (d.definition->'requiresFeatures'));
 select count(*),round(avg(extract(epoch from (r.finished_at-r.created_at))/3600)::numeric,1) into closed_count,average_hours from public.business_approval_runs r join public.business_entity_definitions d on d.kind=r.kind
 where r.tenant_id=a.tenant_id and r.status in ('approved','rejected') and r.finished_at>=now()-interval '30 days' and t.features ? (d.definition->>'feature') and (not(d.definition ? 'industries') or d.definition->'industries' ? t.industry) and (not(d.definition ? 'requiresFeatures') or t.features @> (d.definition->'requiresFeatures'));
 return jsonb_build_object('pending',coalesce(pending_count,0),'overdue',coalesce(overdue_count,0),'returned30d',coalesce(returned_count,0),'closed30d',coalesce(closed_count,0),'averageHours30d',average_hours,'periodDays',30);
end $$;
revoke all on function public.business_approval_report(text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_approval_report(text,text) to service_role;
