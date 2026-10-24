-- A stock value is reconstructed from the immutable ledger, including actual production costs.
create function public.business_stock_value_at(p_tenant uuid,p_item uuid,p_warehouse uuid,p_lot uuid,p_date date) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.business_stock_moves%rowtype;q numeric:=0;value numeric:=0;rate numeric;amount numeric;rates jsonb:='{}';cost numeric;produced numeric;
begin
 for m in select * from public.business_stock_moves where tenant_id=p_tenant and item_id=p_item and warehouse_id=p_warehouse and lot_id is not distinct from p_lot and status='posted' and document_date<=p_date order by document_date,created_at,id loop
  rate:=null;
  if m.source_kind='reversal' then rate:=(rates->>m.source_id::text)::numeric;end if;
  if rate is null and m.direction='in' and m.source_kind='production_receipt' then
   select sum(c.amount),sum(c.quantity) into cost,produced from public.business_cost_receipt_values c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' where c.tenant_id=p_tenant and c.receipt_id=m.source_id;
   if produced is null or produced<=0 then raise exception 'BUSINESS_COSTING_REQUIRED';end if;rate:=cost/produced;
  end if;
  if rate is null and m.direction='in' and m.sales_order_id is not null then
   select sum(s.quantity*(rates->>s.id::text)::numeric)/nullif(sum(s.quantity),0) into rate from public.business_stock_moves s where s.tenant_id=p_tenant and s.sales_order_id=m.sales_order_id and s.item_id=m.item_id and s.warehouse_id=m.warehouse_id and s.lot_id is not distinct from m.lot_id and s.direction='out' and s.status='posted' and rates ? s.id::text;
  end if;
  rate:=coalesce(rate,case m.direction when 'in' then m.unit_cost else case when q>0 then value/q else 0 end end);amount:=round(m.quantity*rate,4);
  if m.direction='in' then q:=q+m.quantity;value:=value+amount;else q:=q-m.quantity;value:=value-amount;end if;
  if q<0 or value< -0.005 then raise exception 'BUSINESS_NEGATIVE_VALUATION';end if;
  if q=0 then value:=0;end if;rates:=rates||jsonb_build_object(m.id::text,rate);
 end loop;
 return jsonb_build_object('quantity',q,'value',value,'unitCost',case when q>0 then value/q else 0 end);
end $$;
revoke all on function public.business_stock_value_at(uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;

create function public.business_project_budget(p_tenant uuid,p_project uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.business_projects%rowtype;b public.business_budget_versions%rowtype;committed numeric;actual numeric;extra numeric;
begin
 select * into p from public.business_projects where tenant_id=p_tenant and id=p_project;
 select * into b from public.business_budget_versions where tenant_id=p_tenant and project_id=p_project and status='posted' order by revision desc limit 1;
 select coalesce(sum(l.quantity*l.unit_price),0) into committed from public.business_purchase_lines l join public.business_purchase_orders h on h.tenant_id=l.tenant_id and h.id=l.purchase_order_id and h.status in ('released','completed') where l.tenant_id=p_tenant and h.project_id=p_project and l.status='active';
 -- Count each matched source once, independent of subsequent WIP/finished/COGS transfers.
 select coalesce(sum(amount),0) into actual from (
  select c.amount from public.business_cost_source_links c where c.tenant_id=p_tenant and c.project_id=p_project and c.status='posted' and c.source_kind<>'project_materials'
  union all select a.amount from public.business_payroll_cost_allocations a where a.tenant_id=p_tenant and a.project_id=p_project and a.status='posted'
  union all select a.amount from public.business_overhead_allocations a join public.business_overhead_pools h on h.tenant_id=a.tenant_id and h.id=a.pool_id and h.status='posted' where a.tenant_id=p_tenant and a.project_id=p_project and a.status='active'
  union all select public.business_material_actual_cost(p_tenant,m.id,'project_materials') from public.business_project_materials m where m.tenant_id=p_tenant and m.project_id=p_project and m.status='posted' and m.purchase_line_id is null
 ) costs;
 select coalesce(sum(amount),0) into extra from public.business_budget_exceptions where tenant_id=p_tenant and budget_id=b.id and status='posted';
 return jsonb_build_object('budgetId',b.id,'revision',coalesce(b.revision,0),'limit',coalesce(b.total_amount,p.budget,0)+extra,'commitments',committed,'otherActual',actual,'consumed',committed+actual,'remaining',coalesce(b.total_amount,p.budget,0)+extra-committed-actual);
end $$;
revoke all on function public.business_project_budget(uuid,uuid) from public,anon,authenticated,service_role;

create function public.business_operational_calculation(p_tenant uuid,p_kind text,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb:='[]';rowdata record;value jsonb;total numeric:=0;remaining numeric;qty numeric;rate numeric;delta numeric;prior record;request public.business_procurement_requests%rowtype;quote public.business_supplier_quotes%rowtype;wbs public.business_project_wbs%rowtype;issue public.business_project_materials%rowtype;source_total numeric;
begin
 if p_kind<>'project_lifecycle_events' and v->>'project_id' is not null and not exists(select 1 from public.business_projects where tenant_id=p_tenant and id=(v->>'project_id')::uuid and status='active' and operational_state='active') then raise exception 'BUSINESS_PROJECT_CLOSED';end if;
 if p_kind='budget_versions' then
  select id,revision into prior from public.business_budget_versions where tenant_id=p_tenant and project_id=(v->>'project_id')::uuid and status='posted' order by revision desc limit 1;
  if (v->>'revision')::integer<>coalesce(prior.revision,0)+1 or (v->>'previous_id')::uuid is distinct from prior.id then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
  select coalesce(jsonb_agg(jsonb_build_object('sourceId',l.id,'sourceCode',l.code,'sourceName',w.name,'category',l.category,'amount',l.amount,'sourceVersion',l.row_version,'wbsVersion',w.row_version) order by l.id),'[]'),coalesce(sum(l.amount),0) into rows,total from public.business_budget_lines l join public.business_project_wbs w on w.tenant_id=l.tenant_id and w.id=l.wbs_id and w.project_id=(v->>'project_id')::uuid where l.tenant_id=p_tenant and l.budget_id=(v->>'id')::uuid and l.status='active';
  value:=public.business_project_budget(p_tenant,(v->>'project_id')::uuid);
  value:=value||jsonb_build_object('previousBudget',(select budget from public.business_projects where tenant_id=p_tenant and id=(v->>'project_id')::uuid));
  if total<(value->>'consumed')::numeric then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;
 elsif p_kind='budget_exceptions' then
  select * into prior from public.business_budget_versions where tenant_id=p_tenant and project_id=(v->>'project_id')::uuid and status='posted' order by revision desc limit 1;
  if prior.id is distinct from (v->>'budget_id')::uuid then raise exception 'BUSINESS_INVALID_REFERENCE';end if;total:=(v->>'amount')::numeric;rows:=jsonb_build_array(jsonb_build_object('sourceCode',prior.code,'sourceVersion',prior.row_version,'amount',total));
 elsif p_kind='project_acceptances' then
  select * into wbs from public.business_project_wbs where tenant_id=p_tenant and id=(v->>'wbs_id')::uuid and project_id=(v->>'project_id')::uuid and status='active';
  if not found or (v->>'unit_price')::numeric<>wbs.contract_unit_price then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  select wbs.contract_quantity-coalesce(sum(quantity),0) into remaining from public.business_project_acceptances where tenant_id=p_tenant and wbs_id=wbs.id and status='posted';
  if (v->>'quantity')::numeric>remaining then raise exception 'BUSINESS_ACCEPTANCE_EXCEEDED';end if;
  if (v->>'customer_approved_on')::date<(v->>'document_date')::date or (v->>'customer_approved_on')::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  total:=round((v->>'quantity')::numeric*wbs.contract_unit_price,4);rows:=jsonb_build_array(jsonb_build_object('sourceCode',wbs.code,'sourceName',wbs.name,'quantity',(v->>'quantity')::numeric,'remaining',remaining,'amount',total,'sourceVersion',wbs.row_version));
 elsif p_kind='project_variations' then
  select * into wbs from public.business_project_wbs where tenant_id=p_tenant and id=(v->>'wbs_id')::uuid and project_id=(v->>'project_id')::uuid and status='active';if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if (v->>'new_quantity')::numeric<(select coalesce(sum(quantity),0) from public.business_project_acceptances where tenant_id=p_tenant and wbs_id=wbs.id and status='posted') then raise exception 'BUSINESS_ACCEPTANCE_EXCEEDED';end if;
  total:=(v->>'new_quantity')::numeric*(v->>'new_unit_price')::numeric-wbs.contract_quantity*wbs.contract_unit_price;rows:=jsonb_build_array(jsonb_build_object('sourceCode',wbs.code,'sourceName',wbs.name,'oldQuantity',wbs.contract_quantity,'oldUnitPrice',wbs.contract_unit_price,'sourceVersion',wbs.row_version,'amount',total));
 elsif p_kind='project_lifecycle_events' then
  select * into prior from public.business_projects where tenant_id=p_tenant and id=(v->>'project_id')::uuid and status='active';if not found or prior.operational_state=v->>'next_state' then raise exception 'BUSINESS_INVALID_TRANSITION';end if;
  if v->>'next_state'='closed' and (exists(select 1 from public.business_purchase_orders where tenant_id=p_tenant and project_id=prior.id and status in ('draft','released')) or exists(select 1 from public.business_advances a where a.tenant_id=p_tenant and a.project_id=prior.id and a.status='posted' and a.amount>(select coalesce(sum(expense_amount+returned_amount),0) from public.business_advance_settlements where tenant_id=p_tenant and advance_id=a.id and status='posted')) or exists(select 1 from public.business_project_acceptances a where a.tenant_id=p_tenant and a.project_id=prior.id and a.status='posted' and a.amount>(select coalesce(sum(amount),0) from public.business_acceptance_billings where tenant_id=p_tenant and acceptance_id=a.id and status='posted'))) then raise exception 'BUSINESS_UNSETTLED_PROJECT';end if;
  rows:=jsonb_build_array(jsonb_build_object('sourceCode',prior.code,'sourceName',prior.name,'previousState',prior.operational_state,'sourceVersion',prior.row_version,'amount',0));
 elsif p_kind='acceptance_billings' then
  select * into prior from public.business_project_acceptances where tenant_id=p_tenant and id=(v->>'acceptance_id')::uuid and project_id=(v->>'project_id')::uuid and status='posted';if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  select prior.amount-coalesce(sum(amount),0) into remaining from public.business_acceptance_billings where tenant_id=p_tenant and acceptance_id=prior.id and status='posted';
  if (v->>'amount')::numeric>remaining or (v->>'document_date')::date<prior.customer_approved_on then raise exception 'BUSINESS_ACCEPTANCE_EXCEEDED';end if;
  select i.base_amount-coalesce((select sum(b.amount) from public.business_acceptance_billings b where b.tenant_id=i.tenant_id and b.sales_invoice_id=i.id and b.status='posted'),0) into remaining from public.business_sales_invoices i where i.tenant_id=p_tenant and i.id=(v->>'sales_invoice_id')::uuid and i.status='posted' and i.posting_date<=(v->>'document_date')::date;
  if remaining is null or (v->>'amount')::numeric>remaining then raise exception 'BUSINESS_CREDIT_EXCEEDED';end if;total:=(v->>'amount')::numeric;rows:=jsonb_build_array(jsonb_build_object('sourceCode',prior.code,'sourceVersion',prior.row_version,'amount',total));
 elsif p_kind='procurement_requests' then
  if (v->>'needed_on')::date<(v->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  select coalesce(jsonb_agg(jsonb_build_object('sourceId',l.id,'sourceCode',l.code,'sourceName',i.name,'quantity',l.quantity,'unitCost',l.estimated_price,'amount',l.quantity*l.estimated_price,'sourceVersion',l.row_version) order by l.id),'[]'),coalesce(sum(l.quantity*l.estimated_price),0) into rows,total from public.business_procurement_request_lines l join public.business_items i on i.tenant_id=l.tenant_id and i.id=l.item_id where l.tenant_id=p_tenant and l.request_id=(v->>'id')::uuid and l.status='active';
  if v->>'project_id' is not null then value:=public.business_project_budget(p_tenant,(v->>'project_id')::uuid);if total>(value->>'remaining')::numeric then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;end if;
 elsif p_kind='supplier_quotes' then
  select * into request from public.business_procurement_requests where tenant_id=p_tenant and id=(v->>'request_id')::uuid and status='posted';
  if not found or (v->>'document_date')::date<request.document_date or (v->>'valid_until')::date<(v->>'document_date')::date or (v->>'delivery_on')::date<(v->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if not exists(select 1 from public.business_tenant_partners where tenant_id=p_tenant and id=(v->>'partner_id')::uuid and partner_type in ('supplier','both') and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  for rowdata in select l.*,r.quantity requested,i.name item_name from public.business_supplier_quote_lines l join public.business_procurement_request_lines r on r.tenant_id=l.tenant_id and r.id=l.request_line_id and r.request_id=request.id and r.status='active' join public.business_items i on i.tenant_id=r.tenant_id and i.id=r.item_id where l.tenant_id=p_tenant and l.quote_id=(v->>'id')::uuid and l.status='active' order by l.id loop
   if (select sum(quantity) from public.business_supplier_quote_lines where tenant_id=p_tenant and quote_id=(v->>'id')::uuid and request_line_id=rowdata.request_line_id and status='active')>rowdata.requested then raise exception 'BUSINESS_PROCUREMENT_EXCEEDED';end if;
   total:=total+rowdata.quantity*rowdata.unit_price;rows:=rows||jsonb_build_array(jsonb_build_object('sourceId',rowdata.id,'sourceCode',rowdata.code,'sourceName',rowdata.item_name,'quantity',rowdata.quantity,'unitCost',rowdata.unit_price,'amount',rowdata.quantity*rowdata.unit_price,'sourceVersion',rowdata.row_version));
  end loop;
 elsif p_kind='procurement_awards' then
  select * into quote from public.business_supplier_quotes where tenant_id=p_tenant and id=(v->>'quote_id')::uuid and status='posted';
  if not found or (v->>'document_date')::date not between quote.document_date and quote.valid_until or quote.delivery_on<(v->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  select * into request from public.business_procurement_requests where tenant_id=p_tenant and id=quote.request_id and status='posted';
  for rowdata in select a.*,l.request_line_id,l.quantity offered,l.unit_price,l.row_version quote_line_version,r.quantity requested,r.item_id,i.name item_name from public.business_procurement_award_lines a join public.business_supplier_quote_lines l on l.tenant_id=a.tenant_id and l.id=a.quote_line_id and l.quote_id=quote.id and l.status='active' join public.business_procurement_request_lines r on r.tenant_id=l.tenant_id and r.id=l.request_line_id and r.request_id=request.id join public.business_items i on i.tenant_id=r.tenant_id and i.id=r.item_id where a.tenant_id=p_tenant and a.award_id=(v->>'id')::uuid and a.status='active' order by a.id loop
   select coalesce(sum(a.quantity),0) into qty from public.business_procurement_award_lines a join public.business_procurement_awards h on h.tenant_id=a.tenant_id and h.id=a.award_id and h.status='posted' join public.business_supplier_quote_lines q on q.tenant_id=a.tenant_id and q.id=a.quote_line_id where a.tenant_id=p_tenant and a.status='active' and q.request_line_id=rowdata.request_line_id;
   select coalesce(sum(a.quantity),0) into source_total from public.business_procurement_award_lines a join public.business_supplier_quote_lines q on q.tenant_id=a.tenant_id and q.id=a.quote_line_id where a.tenant_id=p_tenant and a.award_id=(v->>'id')::uuid and a.status='active' and q.request_line_id=rowdata.request_line_id;
   if qty+source_total>rowdata.requested or rowdata.quantity>rowdata.offered then raise exception 'BUSINESS_PROCUREMENT_EXCEEDED';end if;
   total:=total+rowdata.quantity*rowdata.unit_price;rows:=rows||jsonb_build_array(jsonb_build_object('sourceId',rowdata.id,'sourceCode',rowdata.code,'sourceName',rowdata.item_name,'itemId',rowdata.item_id,'quantity',rowdata.quantity,'unitCost',rowdata.unit_price,'amount',rowdata.quantity*rowdata.unit_price,'sourceVersion',rowdata.row_version,'quoteLineVersion',rowdata.quote_line_version));
  end loop;
  if request.project_id is not null then value:=public.business_project_budget(p_tenant,request.project_id);if total>(value->>'remaining')::numeric then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;end if;
  value:=coalesce(value,'{}')||jsonb_build_object('projectId',request.project_id,'partnerId',quote.partner_id,'quoteVersion',quote.row_version,'requestVersion',request.row_version,'expectedOn',quote.delivery_on);
 elsif p_kind='stock_transfers' then
  if v->>'from_warehouse_id'=v->>'to_warehouse_id' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  perform public.business_check_stock(p_tenant,(v->>'item_id')::uuid,(v->>'from_warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'document_date')::date);
  value:=public.business_stock_value_at(p_tenant,(v->>'item_id')::uuid,(v->>'from_warehouse_id')::uuid,(v->>'lot_id')::uuid,(v->>'document_date')::date);
  if (v->>'quantity')::numeric>(value->>'quantity')::numeric then raise exception 'BUSINESS_INSUFFICIENT_STOCK';end if;
  rate:=(value->>'unitCost')::numeric;total:=round((v->>'quantity')::numeric*rate,4);rows:=jsonb_build_array(jsonb_build_object('quantity',(v->>'quantity')::numeric,'unitCost',rate,'amount',total));
 elsif p_kind='stock_counts' then
  if exists(select 1 from public.business_stock_counts where tenant_id=p_tenant and warehouse_id=(v->>'warehouse_id')::uuid and id<>(v->>'id')::uuid and status='draft' and calculation_snapshot is not null) then raise exception 'BUSINESS_STOCK_COUNT_FROZEN';end if;
  for rowdata in select l.*,i.name item_name from public.business_stock_count_lines l join public.business_items i on i.tenant_id=l.tenant_id and i.id=l.item_id where l.tenant_id=p_tenant and l.count_id=(v->>'id')::uuid and l.status='active' order by l.id loop
   value:=public.business_stock_value_at(p_tenant,rowdata.item_id,(v->>'warehouse_id')::uuid,rowdata.lot_id,(v->>'document_date')::date);delta:=rowdata.counted_quantity-(value->>'quantity')::numeric;
   rate:=case when delta>0 then rowdata.gain_unit_cost else (value->>'unitCost')::numeric end;
   total:=total+round(delta*rate,4);rows:=rows||jsonb_build_array(jsonb_build_object('sourceId',rowdata.id,'sourceCode',rowdata.code,'sourceName',rowdata.item_name,'itemId',rowdata.item_id,'lotId',rowdata.lot_id,'systemQuantity',(value->>'quantity')::numeric,'countedQuantity',rowdata.counted_quantity,'quantity',delta,'unitCost',rate,'amount',round(delta*rate,4),'sourceVersion',rowdata.row_version));
  end loop;
  if exists(select 1 from public.business_tenants where id=p_tenant and features ? 'accounting') and (v->>'inventory_account_id' is null or v->>'difference_account_id' is null or v->>'inventory_account_id'=v->>'difference_account_id') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind='project_material_returns' then
  select * into issue from public.business_project_materials where tenant_id=p_tenant and id=(v->>'material_issue_id')::uuid and project_id=(v->>'project_id')::uuid and status='posted';
  if not found or (v->>'document_date')::date<issue.document_date then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind='project_materials' and l.source_id=issue.id::text) or exists(select 1 from public.business_cost_source_links where tenant_id=p_tenant and source_kind='project_materials' and source_record_id=issue.id::text and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  select issue.quantity-coalesce(sum(quantity),0) into remaining from public.business_project_material_returns where tenant_id=p_tenant and material_issue_id=issue.id and status='posted';if (v->>'quantity')::numeric>remaining then raise exception 'BUSINESS_RETURN_EXCEEDED';end if;
  source_total:=public.business_material_actual_cost_before_returns(p_tenant,issue.id,'project_materials');rate:=source_total/issue.quantity;total:=round(rate*(v->>'quantity')::numeric,4);
  rows:=jsonb_build_array(jsonb_build_object('sourceCode',issue.code,'sourceVersion',issue.row_version,'quantity',(v->>'quantity')::numeric,'unitCost',rate,'amount',total,'itemId',issue.item_id,'lotId',issue.lot_id,'warehouseId',issue.warehouse_id));
 else raise exception 'BUSINESS_INVALID_INPUT';end if;
 if jsonb_array_length(rows)=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
 return jsonb_build_object('rows',rows,'total',total,'context',coalesce(value,'{}'::jsonb));
end $$;
revoke all on function public.business_operational_calculation(uuid,text,jsonb) from public,anon,authenticated,service_role;
