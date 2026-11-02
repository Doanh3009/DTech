create function public.business_approval_fingerprint(p_tenant uuid,p_kind text,v jsonb) returns text language plpgsql stable security definer set search_path='' as $$
declare d jsonb;child_kind text;child_field text;children jsonb:='[]';form jsonb;
begin
 select definition into d from public.business_entity_definitions where kind=p_kind;
 child_kind:=coalesce(d->>'lineKind',case p_kind when 'journal_entries' then 'journal_lines' when 'salary_runs' then 'salary_lines' end);
 child_field:=case p_kind when 'journal_entries' then 'journal_id' when 'salary_runs' then 'salary_run_id' else (select definition->>'parentField' from public.business_entity_definitions where kind=child_kind) end;
 if child_kind is not null and child_field is not null then execute format('select coalesce(jsonb_agg(to_jsonb(x) order by x.id),''[]'') from public.%I x where tenant_id=$1 and %I=$2 and status=''active''',public.business_entity_table(child_kind),child_field) into children using p_tenant,(v->>'id')::uuid;end if;
 select jsonb_build_object('formId',form_id,'data',data,'version',row_version) into form from public.business_form_records where tenant_id=p_tenant and kind=p_kind and record_id=(v->>'id')::uuid;
 return encode(sha256(convert_to(jsonb_build_object('document',v-array['row_version','reviewed_by','updated_at','references','approval','workflowRequired'],'lines',children,'form',form)::text,'UTF8')),'hex');
end $$;

create function public.business_approval_policy_for(p_tenant uuid,p_kind text,v jsonb) returns public.business_approval_policies language plpgsql stable security definer set search_path='' as $$
declare policy public.business_approval_policies%rowtype;amount numeric;prior uuid;
begin
 select policy_id into prior from public.business_approval_runs where tenant_id=p_tenant and kind=p_kind and record_id=(v->>'id')::uuid order by sequence_no desc limit 1;
 if prior is not null then select * into policy from public.business_approval_policies where tenant_id=p_tenant and id=prior;return policy;end if;
 select * into policy from public.business_approval_policies where tenant_id=p_tenant and kind=p_kind and active;if not found then return null;end if;
 if policy.amount_field='calculated_total' and p_kind='journal_entries' then select coalesce(sum(debit),0) into amount from public.business_journal_lines where tenant_id=p_tenant and journal_id=(v->>'id')::uuid and status='active';
 elsif policy.amount_field='calculated_total' then amount:=coalesce((v->'calculation_snapshot'->>'total')::numeric,(v->>'total_amount')::numeric,(v->>'amount')::numeric,(v->>'base_amount')::numeric+(v->>'tax_amount')::numeric,0);
 else amount:=coalesce((v->>policy.amount_field)::numeric,0);end if;
 if abs(amount)<policy.minimum_amount then return null;end if;return policy;
end $$;

create function public.business_approval_actor(p_tenant uuid,p_run uuid,p_actor uuid,p_kind text,p_step integer,p_steps jsonb,p_document jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid;delegation public.business_approval_delegations%rowtype;
begin
 if exists(select 1 from public.business_approval_decisions where tenant_id=p_tenant and run_id=p_run and actor_id=p_actor and decision='approve') then return null;end if;
 for who in select value::uuid from jsonb_array_elements_text(p_steps->p_step->'approverIds') loop
  if not public.business_access_allowed(who,p_kind,'approve',p_document) or not public.business_access_allowed(who,p_kind,'read',p_document) or not exists(select 1 from public.business_accounts a where a.tenant_id=p_tenant and a.id=who and a.status='active' and (a.access_expires_at is null or a.access_expires_at>now()) and (a.staff_id is null or exists(select 1 from public.business_staff where tenant_id=p_tenant and id=a.staff_id and status='active'))) then continue;end if;
  if exists(select 1 from public.business_approval_decisions where tenant_id=p_tenant and run_id=p_run and step=p_step and principal_id=who and decision='approve') then continue;end if;
  if who=p_actor then return jsonb_build_object('principalId',who);end if;
  select * into delegation from public.business_approval_delegations where tenant_id=p_tenant and principal_id=who and delegate_id=p_actor and p_kind=any(kinds) and revoked_at is null and now()>=starts_at and now()<ends_at order by created_at desc limit 1;
  if found then return jsonb_build_object('principalId',who,'delegationId',delegation.id);end if;
 end loop;
 return null;
end $$;
revoke all on function public.business_approval_fingerprint(uuid,text,jsonb),public.business_approval_policy_for(uuid,text,jsonb),public.business_approval_actor(uuid,uuid,uuid,text,integer,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_approval_advance(p_tenant uuid,p_kind text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare review text:='';
begin
 if exists(select 1 from pg_catalog.pg_attribute where attrelid=('public.'||public.business_entity_table(p_kind))::regclass and attname='reviewed_by' and not attisdropped) then review:=',reviewed_by=null';end if;
 execute format('update public.%I set row_version=row_version+1,updated_at=now()%s where tenant_id=$1 and id=$2',public.business_entity_table(p_kind),review) using p_tenant,p_id;
end $$;
revoke all on function public.business_approval_advance(uuid,text,uuid) from public,anon,authenticated,service_role;

alter function public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) rename to business_record_action_before_workflow;
revoke all on function public.business_record_action_before_workflow(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
create function public.business_record_action(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_action text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;v jsonb;r jsonb;policy public.business_approval_policies%rowtype;run public.business_approval_runs%rowtype;fingerprint text;who jsonb;s jsonb;person uuid;principal_name text;step_complete boolean;voted integer;next_step integer;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,p_kind,case when p_action in ('submit','recall','deactivate','activate') then 'update' when p_action in ('return','reject') then 'approve' else p_action end,v);
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if p_expected_version is null or (v->>'row_version')::integer<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_action in ('post','release') then perform public.business_form_assert(a.tenant_id,p_kind,p_id);end if;
 policy:=public.business_approval_policy_for(a.tenant_id,p_kind,v);
 select * into run from public.business_approval_runs where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id order by sequence_no desc limit 1;
 if policy.id is null then
  if p_action in ('submit','recall','return','reject') then raise exception 'BUSINESS_APPROVAL_POLICY_REQUIRED';end if;
  return public.business_record_action_before_workflow(p_hash,p_slug,p_kind,p_id,p_expected_version,p_action,p_reason,p_request_id,p_payload_hash);
 end if;
 if p_action in ('submit','approve','recall','return','reject','post','release') then
  perform public.business_assert_access(a.id,p_kind,'read',v);fingerprint:=public.business_approval_fingerprint(a.tenant_id,p_kind,v);
 end if;
 if p_action='submit' then
  if v->>'status'<>'draft' or a.id<>(v->>'created_by')::uuid and a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
  if run.id is not null and run.status in ('pending','approved') and run.document_version=p_expected_version and run.fingerprint=fingerprint then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  perform public.business_form_assert(a.tenant_id,p_kind,p_id);
  if coalesce((d->>'calculable')::boolean,false) and (v->'calculation_snapshot' is null or v->'calculation_snapshot'='null'::jsonb or v->'calculation_snapshot'<>public.business_misa_calculate(a.tenant_id,p_kind,v)) then raise exception 'BUSINESS_CALCULATION_STALE';end if;
  for s in select jsonb_array_elements(policy.steps) loop
   for person in select value::uuid from jsonb_array_elements_text(s->'approverIds') loop
    perform public.business_approval_account(a.tenant_id,person);
    if person=(v->>'created_by')::uuid then raise exception 'BUSINESS_APPROVAL_MAKER_IN_STEPS';end if;
   end loop;
  end loop;
  update public.business_approval_runs set status='superseded',finished_at=now() where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id and status in ('pending','approved');
  insert into public.business_approval_runs(tenant_id,kind,record_id,policy_id,policy_version,policy_name,steps,fingerprint,status,submitted_by,document_version) values(a.tenant_id,p_kind,p_id,policy.id,policy.version,policy.name,policy.steps,fingerprint,'pending',a.id,p_expected_version+1) returning * into run;
  perform public.business_approval_advance(a.tenant_id,p_kind,p_id);
 elsif p_action in ('approve','return','reject','recall') then
  if v->>'status'<>'draft' or run.id is null or run.status not in ('pending','approved') then raise exception 'BUSINESS_APPROVAL_SUBMIT_REQUIRED';end if;
  if run.document_version<>p_expected_version or run.fingerprint<>fingerprint then raise exception 'BUSINESS_APPROVAL_RESUBMIT_REQUIRED';end if;
  if p_action='recall' then
   if a.id<>(v->>'created_by')::uuid and a.role<>'owner' then raise exception 'BUSINESS_FORBIDDEN';end if;
  else
   if run.status<>'pending' or a.id=(v->>'created_by')::uuid then raise exception 'BUSINESS_REVIEW_REQUIRED';end if;
   perform public.business_assert_access(a.id,p_kind,'approve',v);
   who:=public.business_approval_actor(a.tenant_id,run.id,a.id,p_kind,run.current_step,run.steps,v);
   if who is null then raise exception 'BUSINESS_APPROVAL_NOT_ASSIGNED';end if;
   if coalesce((d->>'calculable')::boolean,false) and (v->'calculation_snapshot' is null or v->'calculation_snapshot'='null'::jsonb or v->'calculation_snapshot'<>public.business_misa_calculate(a.tenant_id,p_kind,v)) then raise exception 'BUSINESS_CALCULATION_STALE';end if;
   select display_name into principal_name from public.business_accounts where tenant_id=a.tenant_id and id=(who->>'principalId')::uuid;
  end if;
  insert into public.business_approval_decisions(tenant_id,run_id,step,actor_id,principal_id,decision,reason,actor_name,principal_name,delegation_id) values(a.tenant_id,run.id,run.current_step,a.id,(who->>'principalId')::uuid,p_action,btrim(p_reason),a.display_name,principal_name,(who->>'delegationId')::uuid);
  if p_action='approve' then
   select count(*) into voted from public.business_approval_decisions where tenant_id=a.tenant_id and run_id=run.id and step=run.current_step and decision='approve';
   step_complete:=run.steps->run.current_step->>'mode'='any' or voted=jsonb_array_length(run.steps->run.current_step->'approverIds');
   next_step:=run.current_step+case when step_complete then 1 else 0 end;
   if next_step=jsonb_array_length(run.steps) then
    if coalesce((d->>'requiresApproval')::boolean,false) or p_kind in ('journal_entries','cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs') or p_kind='payments' and (select features ? 'accounting' from public.business_tenants where id=a.tenant_id) then
     r:=public.business_record_action_before_workflow(p_hash,p_slug,p_kind,p_id,p_expected_version,'approve',p_reason,p_request_id,p_payload_hash);
    else perform public.business_approval_advance(a.tenant_id,p_kind,p_id);end if;
    update public.business_approval_runs set status='approved',document_version=p_expected_version+1,finished_at=now() where tenant_id=a.tenant_id and id=run.id;
   else
    perform public.business_approval_advance(a.tenant_id,p_kind,p_id);
    update public.business_approval_runs set current_step=next_step,document_version=p_expected_version+1,step_started_at=case when step_complete then now() else step_started_at end where tenant_id=a.tenant_id and id=run.id;
   end if;
  else
   perform public.business_approval_advance(a.tenant_id,p_kind,p_id);
   update public.business_approval_runs set status=case p_action when 'return' then 'returned' when 'reject' then 'rejected' else 'recalled' end,document_version=p_expected_version+1,finished_at=now() where tenant_id=a.tenant_id and id=run.id;
  end if;
 else
  if p_action in ('post','release') and (run.id is null or run.status<>'approved' or run.document_version<>p_expected_version or run.fingerprint<>fingerprint) then raise exception 'BUSINESS_APPROVAL_INCOMPLETE';end if;
  r:=public.business_record_action_before_workflow(p_hash,p_slug,p_kind,p_id,p_expected_version,p_action,p_reason,p_request_id,p_payload_hash);
  if p_action in ('post','release','cancel','reverse') then update public.business_approval_runs set status=case p_action when 'post' then 'posted' when 'release' then 'posted' when 'cancel' then 'cancelled' else 'reversed' end,finished_at=now() where tenant_id=a.tenant_id and id=run.id;end if;
 end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'approval.'||p_action,p_kind,p_id,jsonb_build_object('runId',run.id,'policyVersion',policy.version,'reason',btrim(p_reason),'step',run.current_step));
 if r is null then
  r:=jsonb_build_object('recordId',p_id,'rowVersion',p_expected_version+1,'approvalRunId',run.id);
  insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);
 end if;return r;
end $$;
revoke all on function public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) to service_role;

create function public.business_approval_snapshot(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;policy public.business_approval_policies%rowtype;run public.business_approval_runs%rowtype;history jsonb;steps jsonb:='[]';s jsonb;who uuid;names jsonb;decisions jsonb;actions jsonb:='[]';i integer:=0;stale boolean;assigned jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',v);
 policy:=public.business_approval_policy_for(a.tenant_id,p_kind,v);
 if policy.id is null then return jsonb_build_object('documentVersion',v->'row_version','required',false,'actions','[]'::jsonb,'runs','[]'::jsonb);end if;
 select * into run from public.business_approval_runs where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id order by sequence_no desc limit 1;
 stale:=run.id is not null and (run.document_version<>(v->>'row_version')::integer or run.fingerprint<>public.business_approval_fingerprint(a.tenant_id,p_kind,v));
 for s in select jsonb_array_elements(coalesce(run.steps,policy.steps)) loop
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name) order by x.display_name),'[]') into names from public.business_accounts x where x.tenant_id=a.tenant_id and x.id=any(array(select value::uuid from jsonb_array_elements_text(s->'approverIds')));
  select coalesce(jsonb_agg(to_jsonb(x)-'tenant_id' order by created_at,id),'[]') into decisions from public.business_approval_decisions x where tenant_id=a.tenant_id and run_id=run.id and step=i;
  steps:=steps||jsonb_build_array(jsonb_build_object('index',i,'name',s->'name','mode',s->'mode','slaHours',s->'slaHours','approvers',names,'decisions',decisions,'current',run.status='pending' and run.current_step=i,'dueAt',case when run.status='pending' and run.current_step=i then run.step_started_at+make_interval(hours=>(s->>'slaHours')::integer) end));i:=i+1;
 end loop;
 if v->>'status'='draft' then
  if (a.id=(v->>'created_by')::uuid or a.role='owner') and public.business_access_allowed(a.id,p_kind,'update',v) then
   if run.id is null or stale or run.status not in ('pending','approved') then actions:=actions||'"submit"'::jsonb;else actions:=actions||'"recall"'::jsonb;end if;
  end if;
  if run.status='pending' and not stale and a.id<>(v->>'created_by')::uuid and public.business_access_allowed(a.id,p_kind,'approve',v) and a.role<>'viewer' then
   assigned:=public.business_approval_actor(a.tenant_id,run.id,a.id,p_kind,run.current_step,run.steps,v);
   if assigned is not null then actions:=actions||'["approve","return","reject"]'::jsonb;end if;
  end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(x)-'tenant_id'-'fingerprint'-'steps' order by sequence_no desc),'[]') into history from public.business_approval_runs x where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id;
 return jsonb_build_object('documentVersion',v->'row_version','required',true,'policyName',policy.name,'policyVersion',policy.version,'runId',run.id,'status',coalesce(run.status,'not_submitted'),'stale',stale,'steps',steps,'actions',actions,'runs',history);
end $$;
revoke all on function public.business_approval_snapshot(text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_approval_snapshot(text,text,text,uuid) to service_role;
