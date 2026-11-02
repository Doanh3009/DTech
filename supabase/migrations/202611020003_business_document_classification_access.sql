create function public.business_document_classification_allowed(p_actor uuid,p_kind text,p_action text,v jsonb) returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor_account public.business_accounts%rowtype;document_id uuid;source jsonb;source_kind text;classification text;workflow_kind text;workflow_record uuid;is_assigned_reviewer boolean:=false;
begin
 if v is null then return true;end if;
 select * into actor_account from public.business_accounts where id=p_actor and status='active';if not found then return false;end if;
 if actor_account.role='owner' then return true;end if;
 if p_kind='document_repository' then document_id:=(v->>'id')::uuid;workflow_kind:=p_kind;workflow_record:=(v->>'id')::uuid;
 elsif p_kind='document_versions' then document_id:=(v->>'document_id')::uuid;workflow_kind:=p_kind;workflow_record:=(v->>'id')::uuid;
 elsif p_kind='document_signing_requests' then
  workflow_kind:=p_kind;workflow_record:=(v->>'id')::uuid;
  source_kind:=v->>'source_kind';
  if source_kind not in ('document_repository','document_versions') then return true;end if;
  if source_kind='document_repository' then document_id:=(v->>'source_record_id')::uuid;
  else
   execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(source_kind)) into source using actor_account.tenant_id,(v->>'source_record_id')::uuid;
   if source is null then return false;end if;document_id:=(source->>'document_id')::uuid;
  end if;
 else return true;
 end if;
 select d.confidentiality into classification from public.business_document_repository d where d.tenant_id=actor_account.tenant_id and d.id=document_id;
 if classification is null then return false;end if;
 if classification='restricted' then
  if p_action not in ('read','approve') then return false;end if;
  select exists(select 1 from public.business_approval_runs r cross join lateral jsonb_array_elements(r.steps) step where r.tenant_id=actor_account.tenant_id and r.kind=workflow_kind and r.record_id=workflow_record and r.status in ('pending','approved') and step->'approverIds' ? p_actor::text) into is_assigned_reviewer;
  if not is_assigned_reviewer then return false;end if;
 end if;
 if classification='confidential' and actor_account.role='viewer' then return false;end if;
 return true;
end $$;
revoke all on function public.business_document_classification_allowed(uuid,text,text,jsonb) from public,anon,authenticated,service_role;

do $$
declare body text;anchor text;replacement text;
begin
 select pg_get_functiondef('public.business_access_allowed(uuid,text,text,jsonb)'::regprocedure) into body;
 anchor:='select * into a from public.business_accounts where id=p_actor and status=''active'';if not found then return false;end if;';
 replacement:=anchor||E'\n'||' if p_kind in (''document_repository'',''document_versions'',''document_signing_requests'') and not public.business_document_classification_allowed(p_actor,p_kind,p_action,v) then return false;end if;';
 if strpos(body,anchor)=0 then raise exception 'Review business access control before adding document classification rules';end if;
 execute replace(body,anchor,replacement);
end $$;
