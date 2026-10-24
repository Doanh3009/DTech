create function public.business_costing_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb:='[]';outputs jsonb:='[]';x record;amount numeric;opening numeric;total numeric;completed numeric;finished numeric:=0;unreceived numeric;percent numeric;wo uuid:=(v->>'work_order_id')::uuid;project uuid:=(v->>'project_id')::uuid;
begin
 if v->>'target_type'='production' and not exists(select 1 from public.business_work_orders where tenant_id=p_tenant and id=wo and status in ('released','completed')) or v->>'target_type'='project' and not exists(select 1 from public.business_projects where tenant_id=p_tenant and id=project and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 for x in
  select 'material_issues' kind,m.id,'material' category,m.quantity*m.unit_cost amount,(v->>'material_account_id')::uuid account_id,m.row_version,m.code,m.name from public.business_material_issues m where m.tenant_id=p_tenant and m.work_order_id=wo and m.status='posted' and m.document_date between (v->>'starts_on')::date and (v->>'ends_on')::date
  union all select 'project_materials',m.id,'material',m.quantity*m.unit_cost,(v->>'material_account_id')::uuid,m.row_version,m.code,m.name from public.business_project_materials m where m.tenant_id=p_tenant and m.project_id=project and m.status='posted' and m.document_date between (v->>'starts_on')::date and (v->>'ends_on')::date
  order by kind,id
 loop
  if not exists(select 1 from public.business_cost_source_links where tenant_id=p_tenant and source_kind=x.kind and source_record_id=x.id::text and status='posted') and not exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind=x.kind and l.source_id=x.id::text) and x.amount>0 then
   rows:=rows||jsonb_build_array(jsonb_build_object('sourceKind',x.kind,'sourceId',x.id,'sourceCode',x.code,'sourceName',x.name,'category',x.category,'amount',x.amount,'sourceAccountId',x.account_id,'sourceVersion',x.row_version));
  end if;
 end loop;
 for x in select c.*,j.account_id from public.business_cost_source_links c join public.business_journal_lines j on j.tenant_id=c.tenant_id and j.id=c.journal_line_id join public.business_journal_entries h on h.tenant_id=j.tenant_id and h.id=j.journal_id and h.status='posted' and h.reversed_by is null where c.tenant_id=p_tenant and c.status='posted' and (c.work_order_id=wo or c.project_id=project) and c.document_date between (v->>'starts_on')::date and (v->>'ends_on')::date and not exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind='cost_source_links' and l.source_id=c.id::text) order by c.id loop
  rows:=rows||jsonb_build_array(jsonb_build_object('sourceKind','cost_source_links','sourceId',x.id,'sourceCode',x.code,'sourceName',x.name,'category',x.category,'amount',x.amount,'sourceAccountId',x.account_id,'sourceVersion',x.row_version));
 end loop;
 for x in select l.*,p.source_account_id from public.business_overhead_allocations l join public.business_overhead_pools p on p.tenant_id=l.tenant_id and p.id=l.pool_id and p.status='posted' where l.tenant_id=p_tenant and l.status='active' and (l.work_order_id=wo or l.project_id=project) and p.ends_on between (v->>'starts_on')::date and (v->>'ends_on')::date and not exists(select 1 from public.business_costing_lines c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' where c.tenant_id=p_tenant and c.source_kind='overhead_allocations' and c.source_id=l.id::text) order by l.id loop
  rows:=rows||jsonb_build_array(jsonb_build_object('sourceKind','overhead_allocations','sourceId',x.id,'sourceCode',x.code,'sourceName',x.name,'category','overhead','amount',x.amount,'sourceAccountId',x.source_account_id,'sourceVersion',x.row_version));
 end loop;
 for x in select a.* from public.business_payroll_cost_allocations a where a.tenant_id=p_tenant and a.status='posted' and (a.work_order_id=wo or a.project_id=project) and a.document_date between (v->>'starts_on')::date and (v->>'ends_on')::date and not exists(select 1 from public.business_costing_lines c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' where c.tenant_id=p_tenant and c.source_kind='payroll_cost_allocations' and c.source_id=a.id::text) order by a.id loop
  rows:=rows||coalesce((select jsonb_agg(part||jsonb_build_object('sourceKind','payroll_cost_allocations','sourceId',x.id,'sourceCode',x.code,'sourceVersion',x.row_version)) from jsonb_array_elements(x.calculation_snapshot->'rows') part where (part->>'amount')::numeric>0),'[]'::jsonb);
 end loop;
 select coalesce(sum(total_amount-completed_amount),0) into opening from public.business_costing_runs where tenant_id=p_tenant and status='posted' and (work_order_id=wo or project_id=project);
 select coalesce(sum((l->>'amount')::numeric),0) into total from jsonb_array_elements(rows) l;
 if wo is not null then
  select coalesce(jsonb_agg(jsonb_build_object('receiptId',p.id,'code',p.code,'quantity',p.quantity) order by p.document_date,p.id),'[]'),coalesce(sum(p.quantity),0) into outputs,finished from public.business_production_receipts p where p.tenant_id=p_tenant and p.work_order_id=wo and p.status='posted' and p.document_date between (v->>'starts_on')::date and (v->>'ends_on')::date and not exists(select 1 from public.business_cost_receipt_values c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' where c.tenant_id=p_tenant and c.receipt_id=p.id);
  select w.quantity-(select coalesce(sum(quantity),0) from public.business_production_receipts where tenant_id=p_tenant and work_order_id=wo and status='posted') into unreceived from public.business_work_orders w where w.tenant_id=p_tenant and w.id=wo;
  if (v->>'wip_equivalent_quantity')::numeric>greatest(0,unreceived) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  percent:=case when finished>0 then finished/(finished+(v->>'wip_equivalent_quantity')::numeric)*100 else 0 end;
 else percent:=(v->>'completion_percent')::numeric;
 end if;
 completed:=round((opening+total)*percent/100,2);
 return jsonb_build_object('rows',rows,'total',total,'openingWip',opening,'completed',completed,'closingWip',opening+total-completed,'outputs',outputs,'finishedQuantity',finished,'completionPercent',percent);
end $$;
revoke all on function public.business_costing_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_costing_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare lines jsonb:='[]';x jsonb;remaining numeric;allocation_value numeric;rowdata record;total_basis numeric;assigned numeric:=0;last_id uuid;source public.business_journal_lines%rowtype;source_doc public.business_journal_entries%rowtype;physical jsonb;
begin
 if p_kind='cost_source_links' then
  if p_action='reverse' then
   if exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind='cost_source_links' and l.source_id=v->>'id') then raise exception 'BUSINESS_RECORD_LOCKED';end if;return '{}';
  end if;
  if (v->>'work_order_id' is null)=(v->>'project_id' is null) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  select * into source from public.business_journal_lines where tenant_id=p_tenant and id=(v->>'journal_line_id')::uuid and status='active';
  select * into source_doc from public.business_journal_entries where tenant_id=p_tenant and id=source.journal_id and status='posted' and reversed_by is null;
  if source_doc.id is null or source_doc.source_kind='salary_runs' or source.debit<=0 or source_doc.posting_date>(v->>'document_date')::date or source.project_id is not null and source.project_id is distinct from (v->>'project_id')::uuid then raise exception 'BUSINESS_COST_SOURCE_REQUIRED';end if;
  if exists(select 1 from public.business_overhead_pools where tenant_id=p_tenant and source_journal_id=source_doc.id and source_account_id=source.account_id and status='posted') then raise exception 'BUSINESS_COST_SOURCE_EXCEEDED';end if;
  select source.debit-coalesce(sum(amount),0) into remaining from public.business_cost_source_links where tenant_id=p_tenant and journal_line_id=source.id and status='posted';
  if (v->>'amount')::numeric>remaining then raise exception 'BUSINESS_COST_SOURCE_EXCEEDED';end if;
  if v->>'source_kind'<>'journal' then
   if coalesce(v->>'source_record_id','') !~ '^[0-9a-f-]{36}$' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 and status=''posted''',public.business_entity_table(v->>'source_kind')) into physical using p_tenant,(v->>'source_record_id')::uuid;
   if physical is null or coalesce(physical->>'work_order_id',physical->>'project_id') is distinct from coalesce(v->>'work_order_id',v->>'project_id') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   if exists(select 1 from public.business_cost_source_links where tenant_id=p_tenant and status='posted' and source_kind=v->>'source_kind' and source_record_id=v->>'source_record_id') or exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind=v->>'source_kind' and l.source_id=v->>'source_record_id') then raise exception 'BUSINESS_COST_SOURCE_EXCEEDED';end if;
   if v->>'source_kind' in ('material_issues','project_materials') and (v->>'amount')::numeric<>(physical->>'quantity')::numeric*(physical->>'unit_cost')::numeric then raise exception 'BUSINESS_COST_SOURCE_REQUIRED';end if;
  end if;
  return jsonb_build_object('snapshot',jsonb_build_object('sourceAccountId',source.account_id,'sourceJournalId',source_doc.id));
 elsif p_kind='overhead_pools' then
  if p_action='reverse' then
   if exists(select 1 from public.business_overhead_allocations a join public.business_costing_lines l on l.tenant_id=a.tenant_id and l.source_kind='overhead_allocations' and l.source_id=a.id::text join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where a.tenant_id=p_tenant and a.pool_id=(v->>'id')::uuid) then raise exception 'BUSINESS_RECORD_LOCKED';end if;return '{}';
  end if;
  if exists(select 1 from public.business_journal_entries where tenant_id=p_tenant and id=(v->>'source_journal_id')::uuid and source_kind='salary_runs') or exists(select 1 from public.business_cost_source_links c join public.business_journal_lines l on l.tenant_id=c.tenant_id and l.id=c.journal_line_id where c.tenant_id=p_tenant and c.status='posted' and l.journal_id=(v->>'source_journal_id')::uuid and l.account_id=(v->>'source_account_id')::uuid) then raise exception 'BUSINESS_COST_SOURCE_EXCEEDED';end if;
  select coalesce(sum(l.debit-l.credit),0) into remaining from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.reversed_by is null and j.posting_date<=(v->>'ends_on')::date where l.tenant_id=p_tenant and l.journal_id=(v->>'source_journal_id')::uuid and l.account_id=(v->>'source_account_id')::uuid and l.status='active' and l.project_id is null;
  select remaining-coalesce(sum(amount),0) into remaining from public.business_overhead_pools where tenant_id=p_tenant and source_journal_id=(v->>'source_journal_id')::uuid and source_account_id=(v->>'source_account_id')::uuid and status='posted';
  if remaining<(v->>'amount')::numeric then raise exception 'BUSINESS_COST_SOURCE_EXCEEDED';end if;
  select sum(basis),(array_agg(id order by id desc))[1] into total_basis,last_id from public.business_overhead_allocations where tenant_id=p_tenant and pool_id=(v->>'id')::uuid and status='active';
  if total_basis is null or total_basis<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  for rowdata in select id,basis from public.business_overhead_allocations where tenant_id=p_tenant and pool_id=(v->>'id')::uuid and status='active' order by id loop
   allocation_value:=case when rowdata.id=last_id then (v->>'amount')::numeric-assigned else round((v->>'amount')::numeric*rowdata.basis/total_basis,2) end;assigned:=assigned+allocation_value;
   update public.business_overhead_allocations a set amount=case when rowdata.id=last_id then (v->>'amount')::numeric-(assigned-allocation_value) else round((v->>'amount')::numeric*rowdata.basis/total_basis,2) end,row_version=row_version+1 where a.tenant_id=p_tenant and a.id=rowdata.id;
  end loop;
  return '{}';
 elsif p_kind='costing_runs' then
  if p_action='reverse' then
   if exists(select 1 from public.business_costing_runs r where r.tenant_id=p_tenant and r.status='posted' and r.id<>(v->>'id')::uuid and (r.work_order_id=(v->>'work_order_id')::uuid or r.project_id=(v->>'project_id')::uuid) and (r.posting_date>(v->>'posting_date')::date or r.posting_date=(v->>'posting_date')::date and r.created_at>(v->>'created_at')::timestamptz)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   return '{}';
  end if;
  for x in select value from jsonb_array_elements(v->'calculation_snapshot'->'rows') loop
   if x->>'sourceAccountId'<>v->>'wip_account_id' then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'wip_account_id','debit',(x->>'amount')::numeric,'projectId',v->>'project_id'),jsonb_build_object('accountId',x->>'sourceAccountId','credit',(x->>'amount')::numeric,'projectId',v->>'project_id'));end if;
  end loop;
  allocation_value:=(v->'calculation_snapshot'->>'completed')::numeric;
  if allocation_value>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',case v->>'target_type' when 'production' then v->>'inventory_account_id' else v->>'cogs_account_id' end,'debit',allocation_value,'projectId',v->>'project_id'),jsonb_build_object('accountId',v->>'wip_account_id','credit',allocation_value,'projectId',v->>'project_id'));end if;
  if jsonb_array_length(lines)=0 and (v->'calculation_snapshot'->>'total')::numeric<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  return jsonb_build_object('lines',lines);
 else raise exception 'BUSINESS_INVALID_INPUT';end if;
end $$;
revoke all on function public.business_costing_effect(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
