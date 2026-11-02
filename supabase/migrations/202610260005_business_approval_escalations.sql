create function public.business_approval_validate_escalations() returns trigger language plpgsql security definer set search_path='' as $$
declare s jsonb;assignment jsonb;principal uuid;backup uuid;backup_ids jsonb;
begin
 for s in select value from jsonb_array_elements(new.steps) loop
  for assignment in select value from jsonb_array_elements(coalesce(s->'escalationAssignments','[]'::jsonb)) loop
   principal:=(assignment->>'principalId')::uuid;backup_ids:=assignment->'approverIds';
   if not(s->'approverIds' ? principal::text) or coalesce(jsonb_typeof(backup_ids),'')<>'array' or jsonb_array_length(backup_ids) not between 1 and 20 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   for backup in select value::uuid from jsonb_array_elements_text(backup_ids) loop
    if backup=principal then raise exception 'BUSINESS_INVALID_INPUT';end if;
    perform public.business_approval_account(new.tenant_id,backup);
    perform public.business_assert_access(backup,new.kind,'approve');
   end loop;
  end loop;
 end loop;
 return new;
end $$;
revoke all on function public.business_approval_validate_escalations() from public,anon,authenticated,service_role;
create trigger business_approval_validate_escalations before insert on public.business_approval_policies
for each row execute function public.business_approval_validate_escalations();

create or replace function public.business_approval_actor(p_tenant uuid,p_run uuid,p_actor uuid,p_kind text,p_step integer,p_steps jsonb,p_document jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare who uuid;backup uuid;assignment jsonb;delegation public.business_approval_delegations%rowtype;deadline timestamptz;
begin
 if exists(select 1 from public.business_approval_decisions where tenant_id=p_tenant and run_id=p_run and actor_id=p_actor and decision='approve') then return null;end if;
 deadline:=(select step_started_at from public.business_approval_runs where tenant_id=p_tenant and id=p_run)+make_interval(hours=>((p_steps->p_step->>'slaHours')::integer));
 for who in select value::uuid from jsonb_array_elements_text(p_steps->p_step->'approverIds') loop
  if exists(select 1 from public.business_approval_decisions where tenant_id=p_tenant and run_id=p_run and step=p_step and principal_id=who and decision='approve') then continue;end if;
  if public.business_access_allowed(who,p_kind,'approve',p_document) and public.business_access_allowed(who,p_kind,'read',p_document)
   and exists(select 1 from public.business_accounts a where a.tenant_id=p_tenant and a.id=who and a.status='active' and (a.access_expires_at is null or a.access_expires_at>now()) and (a.staff_id is null or exists(select 1 from public.business_staff where tenant_id=p_tenant and id=a.staff_id and status='active'))) then
   if who=p_actor then return jsonb_build_object('principalId',who,'escalated',false);end if;
   select * into delegation from public.business_approval_delegations where tenant_id=p_tenant and principal_id=who and delegate_id=p_actor and p_kind=any(kinds) and revoked_at is null and now()>=starts_at and now()<ends_at order by created_at desc limit 1;
   if found then return jsonb_build_object('principalId',who,'delegationId',delegation.id,'escalated',false);end if;
  end if;
  if now()>=deadline then
   for assignment in select value from jsonb_array_elements(coalesce(p_steps->p_step->'escalationAssignments','[]'::jsonb)) where value->>'principalId'=who::text loop
    for backup in select value::uuid from jsonb_array_elements_text(assignment->'approverIds') loop
     if backup=p_actor and public.business_access_allowed(backup,p_kind,'approve',p_document) and public.business_access_allowed(backup,p_kind,'read',p_document)
      and exists(select 1 from public.business_accounts a where a.tenant_id=p_tenant and a.id=backup and a.status='active' and (a.access_expires_at is null or a.access_expires_at>now()) and (a.staff_id is null or exists(select 1 from public.business_staff where tenant_id=p_tenant and id=a.staff_id and status='active'))) then
      return jsonb_build_object('principalId',who,'escalated',true);
     end if;
    end loop;
   end loop;
  end if;
 end loop;
 return null;
end $$;

create or replace function public.business_approval_snapshot(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;policy public.business_approval_policies%rowtype;run public.business_approval_runs%rowtype;history jsonb;steps jsonb:='[]';s jsonb;names jsonb;escalations jsonb;decisions jsonb;actions jsonb:='[]';i integer:=0;stale boolean;assigned jsonb;due_at timestamptz;escalated boolean;
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
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.display_name) order by x.display_name),'[]') into escalations from public.business_accounts x where x.tenant_id=a.tenant_id and x.id=any(array(select ids.value::uuid from jsonb_array_elements(coalesce(s->'escalationAssignments','[]'::jsonb)) as ea(assignment) cross join lateral jsonb_array_elements_text(ea.assignment->'approverIds') as ids(value)));
  select coalesce(jsonb_agg(to_jsonb(x)-'tenant_id' order by created_at,id),'[]') into decisions from public.business_approval_decisions x where tenant_id=a.tenant_id and run_id=run.id and step=i;
  due_at:=case when run.status='pending' and run.current_step=i then run.step_started_at+make_interval(hours=>(s->>'slaHours')::integer) end;
  escalated:=due_at is not null and due_at<=now();
  steps:=steps||jsonb_build_array(jsonb_build_object('index',i,'name',s->'name','mode',s->'mode','slaHours',s->'slaHours','approvers',names,'escalationApprovers',escalations,'decisions',decisions,'current',run.status='pending' and run.current_step=i,'dueAt',due_at,'escalated',escalated));i:=i+1;
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
