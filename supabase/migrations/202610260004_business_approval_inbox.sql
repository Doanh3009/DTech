create function public.business_approval_inbox(p_hash text,p_slug text,p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 a public.business_accounts%rowtype;
 t public.business_tenants%rowtype;
 run public.business_approval_runs%rowtype;
 definition jsonb;
 document jsonb;
 assigned jsonb;
 step jsonb;
 due_at timestamptz;
 all_rows jsonb:='[]'::jsonb;
 page_rows jsonb;
 total integer;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if p_page is null or p_page not between 1 and 10000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if a.role='viewer' then return jsonb_build_object('rows','[]'::jsonb,'total',0,'page',p_page,'pageSize',25,'overdue',0);end if;
 select * into t from public.business_tenants where id=a.tenant_id;
 for run in
  select r.* from public.business_approval_runs r
  where r.tenant_id=a.tenant_id and r.status='pending'
  order by r.created_at desc,r.sequence_no desc
 loop
  select e.definition into definition from public.business_entity_definitions e where e.kind=run.kind;
  if definition is null or not(t.features ? (definition->>'feature'))
    or definition ? 'industries' and not(definition->'industries' ? t.industry)
    or definition ? 'requiresFeatures' and not(t.features @> (definition->'requiresFeatures')) then continue;end if;
  if (definition->>'feature' in ('assets','costing')) and not(t.features ? 'accounting') then continue;end if;
  execute format('select to_jsonb(x) from public.%I x where x.tenant_id=$1 and x.id=$2',public.business_entity_table(run.kind)) into document using a.tenant_id,run.record_id;
  if document is null or document->>'status'<>'draft' or a.id=(document->>'created_by')::uuid then continue;end if;
  if not public.business_access_allowed(a.id,run.kind,'read',document)
    or not public.business_access_allowed(a.id,run.kind,'approve',document) then continue;end if;
  assigned:=public.business_approval_actor(a.tenant_id,run.id,a.id,run.kind,run.current_step,run.steps,document);
  if assigned is null then continue;end if;
  step:=run.steps->run.current_step;
  due_at:=run.step_started_at+make_interval(hours=>(step->>'slaHours')::integer);
  all_rows:=all_rows||jsonb_build_array(jsonb_build_object(
   'id',run.record_id,'kind',run.kind,'kindLabel',definition->>'label',
   'code',document->>'code','name',document->>'name','stepName',step->>'name',
   'stepIndex',run.current_step,'dueAt',due_at,'overdue',due_at<now(),
   'submittedAt',run.created_at,'policyVersion',run.policy_version
  ));
 end loop;
 total:=jsonb_array_length(all_rows);
 select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
 into page_rows
 from jsonb_array_elements(all_rows) with ordinality x(value,ordinality)
 where x.ordinality>(p_page-1)*25 and x.ordinality<=p_page*25;
 return jsonb_build_object(
  'rows',page_rows,'total',total,'page',p_page,'pageSize',25,
  'overdue',(select count(*) from jsonb_array_elements(all_rows) x where (x.value->>'overdue')::boolean)
 );
end $$;
revoke all on function public.business_approval_inbox(text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_approval_inbox(text,text,integer) to service_role;
