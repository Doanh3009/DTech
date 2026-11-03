-- Local provider simulation is available exclusively to explicitly marked demo
-- tenants. It never dispatches email, bank instructions or provider callbacks.
create table public.business_simulation_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 source_kind text not null references public.business_entity_definitions(kind),source_id uuid not null,source_version integer not null check(source_version>0),source_code text not null,source_name text not null,source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),
 service text not null check(service in ('einvoice','signature','bank','email')),scenario text not null check(scenario in ('success','transient','delayed','rejected')),recipient text not null default '' check(char_length(recipient)<=254),
 state text not null default 'queued' check(state in ('queued','retry','waiting','succeeded','rejected','cancelled')),attempts integer not null default 0 check(attempts between 0 and 5),row_version integer not null default 1,
 reference text not null,last_error text,facts jsonb not null default '{}',result jsonb not null default '{}',created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,
 unique(tenant_id,id),unique(tenant_id,reference),unique(tenant_id,source_kind,source_id,source_version,service,scenario,recipient,created_by),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id)
);
create index business_simulation_source_idx on public.business_simulation_requests(tenant_id,source_kind,source_id,created_at desc);
create table public.business_simulation_events(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,simulation_id uuid not null,sequence integer not null,operation text not null,state text not null,actor_id uuid not null,created_at timestamptz not null default now(),
 unique(tenant_id,simulation_id,sequence),foreign key(tenant_id,simulation_id) references public.business_simulation_requests(tenant_id,id),foreign key(tenant_id,actor_id) references public.business_accounts(tenant_id,id)
);
alter table public.business_simulation_requests enable row level security;alter table public.business_simulation_events enable row level security;
revoke all on public.business_simulation_requests,public.business_simulation_events from public,anon,authenticated,service_role;

create function public.business_simulation_receipt(p_hash text,p_slug text,p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r public.business_simulation_requests%rowtype;doc jsonb;t public.business_tenants%rowtype;events jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);select * into t from public.business_tenants where id=a.tenant_id;if not t.is_demo then raise exception 'BUSINESS_SIMULATION_ONLY';end if;
 select * into r from public.business_simulation_requests where tenant_id=a.tenant_id and id=p_id;if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 doc:=public.business_record_detail(p_hash,p_slug,r.source_kind,r.source_id);perform public.business_assert_access(a.id,r.source_kind,'report',doc);
 select coalesce(jsonb_agg(jsonb_build_object('sequence',e.sequence,'operation',e.operation,'state',e.state,'createdAt',e.created_at,'actor',u.display_name) order by e.sequence),'[]'::jsonb) into events from public.business_simulation_events e join public.business_accounts u on u.tenant_id=e.tenant_id and u.id=e.actor_id where e.tenant_id=a.tenant_id and e.simulation_id=r.id;
 return jsonb_build_object('id',r.id,'simulation',true,'tenantName',t.name,'service',r.service,'scenario',r.scenario,'sourceKind',r.source_kind,'sourceId',r.source_id,'sourceVersion',r.source_version,'sourceCode',r.source_code,'sourceName',r.source_name,'sourceSha256',r.source_sha256,'recipient',case when a.role='viewer' then null else nullif(r.recipient,'') end,'state',r.state,'attempts',r.attempts,'rowVersion',r.row_version,'reference',r.reference,'lastError',r.last_error,'result',r.result,'createdAt',r.created_at,'completedAt',r.completed_at,'events',events);
end $$;

create function public.business_simulation_snapshot(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;doc jsonb;rows jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);if not coalesce((select is_demo from public.business_tenants where id=a.tenant_id),false) then raise exception 'BUSINESS_SIMULATION_ONLY';end if;
 d:=public.business_assert_kind(a.tenant_id,p_kind);doc:=public.business_record_detail(p_hash,p_slug,p_kind,p_id);perform public.business_assert_access(a.id,p_kind,'report',doc);
 select coalesce(jsonb_agg(public.business_simulation_receipt(p_hash,p_slug,r.id) order by r.created_at desc,r.id),'[]'::jsonb) into rows from (select id,created_at from public.business_simulation_requests where tenant_id=a.tenant_id and source_kind=p_kind and source_id=p_id order by created_at desc,id limit 40) r;
 return jsonb_build_object('simulation',true,'services',coalesce(d->'simulationServices','[]'::jsonb),'requests',rows,'canStart',a.role<>'viewer' and public.business_access_allowed(a.id,p_kind,case when d->>'mode'='order' then 'release' else 'post' end,doc),'sourceVersion',doc->'row_version');
end $$;

create function public.business_simulation_command(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_service text,p_scenario text,p_recipient text,p_operation text,p_simulation_id uuid,p_simulation_version integer,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;v jsonb;r public.business_simulation_requests%rowtype;receipt jsonb;facts jsonb:='{}'::jsonb;source_hash text;source jsonb;bank_rows jsonb;bank_row jsonb;bank_id uuid;bank_ids jsonb:='[]'::jsonb;next_state text;next_error text;next_result jsonb;request_uuid uuid;line_no integer:=0;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);if not coalesce((select is_demo from public.business_tenants where id=a.tenant_id),false) then raise exception 'BUSINESS_SIMULATION_ONLY';end if;
 d:=public.business_assert_kind(a.tenant_id,p_kind);
 if p_service not in ('einvoice','signature','bank','email') or not(coalesce(d->'simulationServices','[]'::jsonb) ? p_service) or p_scenario not in ('success','transient','delayed','rejected') or p_operation not in ('create','retry','callback','cancel') or p_expected_version is null or p_expected_version<1 or p_simulation_version is null or p_simulation_version<0 or p_recipient is null or char_length(p_recipient)>254 or (p_service='email' and p_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') or (p_service<>'email' and p_recipient<>'') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 receipt:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'simulation:'||p_service,p_payload_hash);if receipt is not null then return receipt;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,p_kind,'read',v);perform public.business_assert_access(a.id,p_kind,'report',v);perform public.business_assert_access(a.id,p_kind,case when d->>'mode'='order' then 'release' else 'post' end,v);
 if (v->>'row_version')::integer is distinct from p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_operation<>'cancel' and v->>'status' not in ('posted','released','completed') then raise exception 'BUSINESS_SOURCE_NOT_READY';end if;
 if p_operation='create' then
  if p_simulation_id is not null or p_simulation_version<>0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
  select * into r from public.business_simulation_requests where tenant_id=a.tenant_id and source_kind=p_kind and source_id=p_id and source_version=p_expected_version and service=p_service and scenario=p_scenario and recipient=p_recipient and created_by=a.id;
  if found then
   receipt:=jsonb_build_object('simulationId',r.id,'rowVersion',r.row_version,'state',r.state,'simulation',true);
   insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'simulation:'||p_service,p_payload_hash,receipt);return receipt;
  end if;
  source_hash:=encode(sha256(convert_to(v::text,'UTF8')),'hex');
  if p_service='einvoice' then facts:=jsonb_build_object('grossAmount',coalesce((v->>'base_amount')::numeric,0)+coalesce((v->>'tax_amount')::numeric,0),'invoiceNumber',v->>'invoice_number');
  elsif p_service='signature' then
   if v->>'provider_key'<>'simulation' then raise exception 'BUSINESS_SIMULATION_ONLY';end if;
   perform public.business_assert_reference_access(a.id,p_kind,v);
   execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(v->>'source_kind')) into source using a.tenant_id,(v->>'source_record_id')::uuid;
   if (source->>'row_version')::integer is distinct from (v->>'source_version')::integer then raise exception 'BUSINESS_SIGNING_SOURCE_VERSION_MISMATCH';end if;
   if not exists(select 1 from public.business_attachments where tenant_id=a.tenant_id and id=(v->>'source_attachment_id')::uuid and kind=v->>'source_kind' and record_id=(v->>'source_record_id')::uuid and ready and sha256=v->>'source_sha256') then raise exception 'BUSINESS_SIGNING_ATTACHMENT_REQUIRED';end if;
   facts:=jsonb_build_object('documentSha256',v->>'source_sha256','signerStaffId',v->>'signer_staff_id','sourceCode',source->>'code');
  elsif p_service='bank' then
   perform public.business_assert_kind(a.tenant_id,'bank_statement_lines');perform public.business_assert_access(a.id,'bank_statement_lines','create',jsonb_build_object('created_by',a.id));
   select jsonb_agg(to_jsonb(x) order by x.code) into bank_rows from (select g.id account_id,g.code,g.name,sum(l.debit-l.credit) change from public.business_journal_entries j join public.business_journal_lines l on l.tenant_id=j.tenant_id and l.journal_id=j.id and l.status='active' join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id and g.code like '112%' where j.tenant_id=a.tenant_id and j.source_kind=p_kind and j.source_id=p_id and j.status='posted' group by g.id,g.code,g.name having sum(l.debit-l.credit)<>0) x;
   if bank_rows is null then raise exception 'BUSINESS_BANK_SOURCE_REQUIRED';end if;
   facts:=jsonb_build_object('bankRows',bank_rows,'valueDate',coalesce(v->>'posting_date',v->>'document_date'));
  end if;
  request_uuid:=gen_random_uuid();
  insert into public.business_simulation_requests(id,tenant_id,source_kind,source_id,source_version,source_code,source_name,source_sha256,service,scenario,recipient,reference,facts,created_by) values(request_uuid,a.tenant_id,p_kind,p_id,p_expected_version,v->>'code',v->>'name',source_hash,p_service,p_scenario,p_recipient,'SIM-'||upper(p_service)||'-'||request_uuid,facts,a.id) returning * into r;
 else
  select * into r from public.business_simulation_requests where tenant_id=a.tenant_id and id=p_simulation_id and source_kind=p_kind and source_id=p_id and service=p_service for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
  if r.row_version<>p_simulation_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  if r.scenario<>p_scenario or r.recipient<>p_recipient then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  if p_operation<>'cancel' and r.source_version<>p_expected_version then raise exception 'BUSINESS_SIMULATION_SOURCE_CHANGED';end if;
  if (p_operation='retry' and (r.state<>'retry' or r.attempts>=5)) or (p_operation='callback' and r.state<>'waiting') or (p_operation='cancel' and r.state not in ('retry','waiting','queued')) then raise exception 'BUSINESS_INVALID_TRANSITION';end if;
 end if;
 if p_operation='cancel' then next_state:='cancelled';next_result:='{}'::jsonb;
 elsif p_operation='create' and r.scenario='transient' then next_state:='retry';next_error:='Lỗi kết nối mô phỏng';next_result:='{}'::jsonb;
 elsif p_operation='create' and r.scenario='delayed' then next_state:='waiting';next_result:='{}'::jsonb;
 elsif r.scenario='rejected' then next_state:='rejected';next_error:='Nhà cung cấp mô phỏng từ chối yêu cầu';next_result:='{}'::jsonb;
 else
  next_state:='succeeded';next_result:=jsonb_build_object('mode','simulation','reference',r.reference);
  if r.service='einvoice' then next_result:=next_result||jsonb_build_object('status','simulated_issued','grossAmount',r.facts->'grossAmount','invoiceNumber',r.facts->>'invoiceNumber');
  elsif r.service='signature' then
   -- Revalidate the actual signed source even when the request itself is unchanged.
   perform public.business_assert_reference_access(a.id,p_kind,v);
   execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(v->>'source_kind')) into source using a.tenant_id,(v->>'source_record_id')::uuid;
   if (source->>'row_version')::integer is distinct from (v->>'source_version')::integer then raise exception 'BUSINESS_SIGNING_SOURCE_VERSION_MISMATCH';end if;
   next_result:=next_result||jsonb_build_object('status','simulated_signed','documentSha256',r.facts->>'documentSha256','sourceCode',r.facts->>'sourceCode');
  elsif r.service='bank' then
   perform public.business_assert_access(a.id,'bank_statement_lines','create',jsonb_build_object('created_by',a.id));
   for bank_row in select value from jsonb_array_elements(r.facts->'bankRows') loop
    line_no:=line_no+1;bank_id:=gen_random_uuid();
    insert into public.business_bank_statement_lines(id,tenant_id,code,name,notes,status,created_by,bank_account_id,transaction_ref,value_date,direction,amount,counterparty) values(bank_id,a.tenant_id,'SIM-BS-'||r.id||'-'||line_no,left('Mô phỏng · '||r.source_code,180),'Dữ liệu ngân hàng mô phỏng','active',a.id,(bank_row->>'account_id')::uuid,r.reference||'-'||line_no,(r.facts->>'valueDate')::date,case when (bank_row->>'change')::numeric>0 then 'in' else 'out' end,abs((bank_row->>'change')::numeric),'Mô phỏng');
    bank_ids:=bank_ids||jsonb_build_array(bank_id);
    insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'simulation.bank_statement','bank_statement_lines',bank_id,jsonb_build_object('simulationId',r.id,'sourceKind',p_kind,'sourceId',p_id,'simulation',true));
   end loop;
   next_result:=next_result||jsonb_build_object('status','simulated_statement','statementIds',bank_ids,'bankRows',r.facts->'bankRows');
  elsif r.service='email' then next_result:=next_result||jsonb_build_object('status','simulated_delivered','subject',r.source_code||' · '||r.source_name);end if;
 end if;
 update public.business_simulation_requests set state=next_state,last_error=next_error,result=next_result,attempts=attempts+case when p_operation in ('create','retry') then 1 else 0 end,row_version=row_version+1,updated_at=now(),completed_at=case when next_state in ('succeeded','rejected','cancelled') then now() else null end where tenant_id=a.tenant_id and id=r.id returning * into r;
 insert into public.business_simulation_events(tenant_id,simulation_id,sequence,operation,state,actor_id) values(a.tenant_id,r.id,r.row_version,p_operation,r.state,a.id);
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'simulation.'||p_service||'.'||p_operation,p_kind,p_id,jsonb_build_object('simulationId',r.id,'state',r.state,'simulation',true));
 receipt:=jsonb_build_object('simulationId',r.id,'rowVersion',r.row_version,'state',r.state,'simulation',true);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'simulation:'||p_service,p_payload_hash,receipt);return receipt;
end $$;
revoke all on function public.business_simulation_receipt(text,text,uuid),public.business_simulation_snapshot(text,text,text,uuid),public.business_simulation_command(text,text,text,uuid,integer,text,text,text,text,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_simulation_receipt(text,text,uuid),public.business_simulation_snapshot(text,text,text,uuid),public.business_simulation_command(text,text,text,uuid,integer,text,text,text,text,uuid,integer,uuid,text) to service_role;
notify pgrst,'reload schema';
