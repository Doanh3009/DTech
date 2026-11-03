do $$declare pair record;begin
 for pair in select * from (values ('purchase_orders','purchase_lines','purchase_order_id'),('sales_orders','sales_lines','sales_order_id'),('boms','bom_lines','bom_id'),('work_orders','operations','work_order_id'),('salary_runs','salary_lines','salary_run_id')) x(parent,child,field) loop
  update public.business_entity_definitions set definition=definition||jsonb_build_object('lineKind',pair.child) where kind=pair.parent;
  update public.business_entity_definitions set definition=definition||jsonb_build_object('parentKind',pair.parent,'parentField',pair.field) where kind=pair.child;
 end loop;
end $$;

alter function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) rename to business_save_record_before_base_lines;
revoke all on function public.business_save_record_before_base_lines(text,text,text,uuid,integer,jsonb,uuid,text) from public,anon,authenticated,service_role;
create function public.business_save_record(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;parent jsonb;old jsonb;previous uuid;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 if p_kind in ('purchase_lines','sales_lines','bom_lines','operations','salary_lines') then
  perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
  r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash);if r is not null then return r;end if;
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using a.tenant_id,(p_data->>(d->>'parentField'))::uuid;
  if parent is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  perform public.business_assert_access(a.id,d->>'parentKind','update',parent);
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into old using a.tenant_id,p_id;
  previous:=(old->>(d->>'parentField'))::uuid;
  if previous is not null and previous is distinct from (p_data->>(d->>'parentField'))::uuid then
   execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using a.tenant_id,previous;
   perform public.business_assert_access(a.id,d->>'parentKind','update',parent);
  end if;
  r:=public.business_save_record_before_base_lines(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data,p_request_id,p_payload_hash);
  insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'line.saved',d->>'parentKind',(p_data->>(d->>'parentField'))::uuid,jsonb_build_object('lineKind',p_kind,'lineId',p_id));return r;
 end if;
 return public.business_save_record_before_base_lines(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data,p_request_id,p_payload_hash);
end $$;

alter function public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) rename to business_record_action_before_base_lines;
revoke all on function public.business_record_action_before_base_lines(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
create function public.business_record_action(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_action text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;v jsonb;parent jsonb;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 if p_kind in ('purchase_lines','sales_lines','bom_lines','operations','salary_lines') and p_action in ('deactivate','activate') then
  perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
  r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
  if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
  perform public.business_assert_access(a.id,p_kind,'update',v);
  if (v->>'row_version')::integer is distinct from p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 500 or (p_action='deactivate' and v->>'status'<>'active') or (p_action='activate' and v->>'status'<>'inactive') then raise exception 'BUSINESS_INVALID_TRANSITION';end if;
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(d->>'parentKind')) into parent using a.tenant_id,(v->>(d->>'parentField'))::uuid;
  perform public.business_assert_access(a.id,d->>'parentKind','update',parent);
  if d->>'parentKind'<>'boms' and parent->>'status'<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  execute format('update public.%I set status=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2 returning to_jsonb(%I.*)',public.business_entity_table(p_kind),public.business_entity_table(p_kind)) into r using a.tenant_id,p_id,case p_action when 'activate' then 'active' else 'inactive' end;
  if p_kind='salary_lines' then update public.business_salary_runs set reviewed_by=null,calculation_snapshot=null,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'salary_run_id')::uuid;end if;
  r:=jsonb_build_object('recordId',p_id,'rowVersion',r->'row_version');
  insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'line.'||p_action,p_kind,p_id,jsonb_build_object('reason',p_reason,'parentId',v->>(d->>'parentField'))),(a.tenant_id,a.id,'line.'||p_action,d->>'parentKind',(v->>(d->>'parentField'))::uuid,jsonb_build_object('reason',p_reason,'lineId',p_id));
  insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);return r;
 end if;
 return public.business_record_action_before_base_lines(p_hash,p_slug,p_kind,p_id,p_expected_version,p_action,p_reason,p_request_id,p_payload_hash);
end $$;
revoke all on function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) to service_role;

create function public.business_base_line_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb;parent jsonb;previous jsonb;field text;parent_kind text;ignored text[]:=array['row_version','updated_at','labor_rate_snapshot','machine_rate_snapshot'];
begin
 select definition into d from public.business_entity_definitions where kind=TG_ARGV[0];field:=d->>'parentField';parent_kind:=d->>'parentKind';
 if TG_OP='UPDATE' and to_jsonb(new)-ignored=to_jsonb(old)-ignored then return new;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(parent_kind)) into parent using new.tenant_id,(to_jsonb(new)->>field)::uuid;
 if parent is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if TG_OP='UPDATE' and to_jsonb(old)->>field is distinct from to_jsonb(new)->>field then
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(parent_kind)) into previous using old.tenant_id,(to_jsonb(old)->>field)::uuid;
 end if;
 if parent_kind='boms' then
  if parent->>'status'<>'active' or previous->>'status' not in ('active') or exists(select 1 from public.business_work_orders where tenant_id=new.tenant_id and bom_id in ((parent->>'id')::uuid,(previous->>'id')::uuid) and status<>'cancelled') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 elsif parent->>'status'<>'draft' or previous->>'status'<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 return new;
end $$;
create function public.business_base_line_touch() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb;field text;previous uuid;ignored text[]:=array['row_version','updated_at','labor_rate_snapshot','machine_rate_snapshot'];assignments text:='row_version=row_version+1,updated_at=now()';parent_table text;
begin
 if TG_OP='UPDATE' and to_jsonb(new)-ignored=to_jsonb(old)-ignored then return new;end if;
 select definition into d from public.business_entity_definitions where kind=TG_ARGV[0];field:=d->>'parentField';if TG_OP='UPDATE' then previous:=(to_jsonb(old)->>field)::uuid;end if;
 parent_table:=public.business_entity_table(d->>'parentKind');
 if exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||parent_table) and attname='reviewed_by' and not attisdropped) then assignments:=assignments||',reviewed_by=null';end if;
 if exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||parent_table) and attname='calculation_snapshot' and not attisdropped) then assignments:=assignments||',calculation_snapshot=null';end if;
 execute format('update public.%I set %s where tenant_id=$1 and id in ($2,$3) and status in (''draft'',''active'')',parent_table,assignments) using new.tenant_id,(to_jsonb(new)->>field)::uuid,previous;
 return new;
end $$;
do $$declare kind text;begin
 foreach kind in array array['purchase_lines','sales_lines','bom_lines','operations'] loop
  execute format('create trigger business_base_line_guard before insert or update on public.%I for each row execute function public.business_base_line_guard(%L)',public.business_entity_table(kind),kind);
  execute format('create trigger business_base_line_touch after insert or update on public.%I for each row execute function public.business_base_line_touch(%L)',public.business_entity_table(kind),kind);
 end loop;
end $$;

-- Generated orders are assembled as drafts and released after their lines exist,
-- within the same transaction. No intermediate state is exposed to another session.
do $$declare body text;anchor text;begin
 select pg_get_functiondef('public.business_operational_effect(uuid,uuid,text,jsonb,text)'::regprocedure) into body;
 anchor:='left(v->>''name'',180),''released'',(context->>''partnerId'')';
 if strpos(body,anchor)=0 then raise exception 'Review generated purchase order assembly';end if;
 body:=replace(body,anchor,'left(v->>''name'',180),''draft'',(context->>''partnerId'')');
 anchor:='update public.business_procurement_awards set purchase_order_id=order_id';
 if strpos(body,anchor)=0 then raise exception 'Review purchase order release boundary';end if;
 body:=replace(body,anchor,'update public.business_purchase_orders set status=''released'',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=order_id;'||chr(10)||anchor);execute body;
 select pg_get_functiondef('public.business_crm_effect(uuid,uuid,text,jsonb,text)'::regprocedure) into body;
 anchor:='v->>''name'',''released'',(context->>''partnerId'')';
 if strpos(body,anchor)=0 then raise exception 'Review generated sales order assembly';end if;
 body:=replace(body,anchor,'v->>''name'',''draft'',(context->>''partnerId'')');
 anchor:='update public.business_contract_order_releases set sales_order_id=order_id';
 if strpos(body,anchor)=0 then raise exception 'Review sales order release boundary';end if;
 body:=replace(body,anchor,'update public.business_sales_orders set status=''released'',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=order_id;'||chr(10)||anchor);execute body;
end $$;

create or replace function public.business_document_lines(p_hash text,p_slug text,p_parent_kind text,p_parent_id uuid,p_page integer default 1) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;c jsonb;parent jsonb;rows jsonb;total bigint;refs text:='';k text;f jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_parent_kind);
 if d->>'lineKind' is null or p_page is null or p_page not between 1 and 100000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 c:=public.business_assert_kind(a.tenant_id,d->>'lineKind');if c->>'parentKind' is distinct from p_parent_kind then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_parent_kind)) into parent using a.tenant_id,p_parent_id;
 if parent is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,p_parent_kind,'read',parent);perform public.business_assert_access(a.id,d->>'lineKind','read');
 for k,f in select key,value from jsonb_each(c->'fields') where value->>'type'='ref' loop
  if coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb) ? a.role then refs:=refs||case when refs='' then '' else ',' end||format('%L,(select code||'' · ''||name from public.%I where tenant_id=r.tenant_id and id=r.%I)',k,public.business_entity_table(f->>'ref'),k);end if;
 end loop;
 execute format('select count(*) from public.%I x where tenant_id=$1 and %I=$2 and status not in (''inactive'',''cancelled'') and public.business_access_allowed($3,%L,''read'',to_jsonb(x))',public.business_entity_table(d->>'lineKind'),c->>'parentField',d->>'lineKind') into total using a.tenant_id,p_parent_id,a.id;
 execute format('select coalesce(jsonb_agg(public.business_entity_redact_fields(to_jsonb(r),$5,$6)||jsonb_build_object(''references'',jsonb_build_object(%s))),''[]''::jsonb) from (select * from public.%I x where tenant_id=$1 and %I=$2 and status not in (''inactive'',''cancelled'') and public.business_access_allowed($3,%L,''read'',to_jsonb(x)) order by created_at,id limit 25 offset $4) r',refs,public.business_entity_table(d->>'lineKind'),c->>'parentField',d->>'lineKind') into rows using a.tenant_id,p_parent_id,a.id,(p_page-1)*25,c,a.role;
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'pageSize',25,'parentVersion',parent->'row_version','parentReviewedBy',parent->'reviewed_by');
end $$;
revoke all on function public.business_base_line_guard(),public.business_base_line_touch(),public.business_document_lines(text,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_document_lines(text,text,text,uuid,integer) to service_role;
notify pgrst,'reload schema';
