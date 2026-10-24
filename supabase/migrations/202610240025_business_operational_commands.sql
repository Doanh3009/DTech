alter function public.business_material_actual_cost(uuid,uuid,text) rename to business_material_actual_cost_before_returns;
create function public.business_material_actual_cost(p_tenant uuid,p_source uuid,p_kind text) returns numeric language plpgsql security definer set search_path='' as $$
declare cost numeric;returned numeric;
begin
 cost:=public.business_material_actual_cost_before_returns(p_tenant,p_source,p_kind);
 if p_kind='project_materials' then select coalesce(sum(amount),0) into returned from public.business_project_material_returns where tenant_id=p_tenant and material_issue_id=p_source and status='posted';cost:=cost-returned;end if;
 return greatest(0,cost);
end $$;
revoke all on function public.business_material_actual_cost(uuid,uuid,text),public.business_material_actual_cost_before_returns(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.business_operational_validate(p_tenant uuid,p_kind text,p_id uuid,v jsonb,old jsonb) returns void language plpgsql security definer set search_path='' as $$
declare parent uuid;previous uuid;parent_kind text;parent_field text;wbs public.business_project_wbs%rowtype;k text;source record;
begin
 parent_kind:=case p_kind when 'budget_lines' then 'budget_versions' when 'procurement_request_lines' then 'procurement_requests' when 'supplier_quote_lines' then 'supplier_quotes' when 'procurement_award_lines' then 'procurement_awards' when 'stock_count_lines' then 'stock_counts' end;
 parent_field:=case p_kind when 'budget_lines' then 'budget_id' when 'procurement_request_lines' then 'request_id' when 'supplier_quote_lines' then 'quote_id' when 'procurement_award_lines' then 'award_id' when 'stock_count_lines' then 'count_id' end;
 if parent_kind is not null then
  parent:=(v->>parent_field)::uuid;previous:=(old->>parent_field)::uuid;
  execute format('select count(*) count from public.%I where tenant_id=$1 and id in ($2,$3) and status<>''draft''',public.business_entity_table(parent_kind)) into source using p_tenant,parent,previous;
  if source.count>0 then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  execute format('update public.%I set reviewed_by=null,calculation_snapshot=null,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id in ($2,$3)',public.business_entity_table(parent_kind)) using p_tenant,parent,previous;
 end if;
 if p_kind='project_wbs' then
  if (v->>'starts_on')::date>(v->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if v->>'parent_id' is not null and not exists(select 1 from public.business_project_wbs where tenant_id=p_tenant and id=(v->>'parent_id')::uuid and project_id=(v->>'project_id')::uuid and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if p_id=(v->>'parent_id')::uuid or exists(with recursive walk(id,parent_id) as (select id,parent_id from public.business_project_wbs where tenant_id=p_tenant and id=(v->>'parent_id')::uuid union select p.id,p.parent_id from public.business_project_wbs p join walk w on w.parent_id=p.id where p.tenant_id=p_tenant) select 1 from walk where id=p_id) then raise exception 'BUSINESS_CYCLE';end if;
  if exists(select 1 from public.business_budget_lines l join public.business_budget_versions b on b.tenant_id=l.tenant_id and b.id=l.budget_id and b.status='posted' where l.tenant_id=p_tenant and l.wbs_id=p_id) or exists(select 1 from public.business_project_acceptances where tenant_id=p_tenant and wbs_id=p_id and status='posted') then
   for k in select jsonb_object_keys(v) loop if k not in ('name','notes') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;
  end if;
 elsif p_kind='budget_lines' then
  if not exists(select 1 from public.business_project_wbs w join public.business_budget_versions b on b.tenant_id=w.tenant_id and b.project_id=w.project_id where w.tenant_id=p_tenant and w.id=(v->>'wbs_id')::uuid and b.id=parent) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind='procurement_request_lines' and v->>'wbs_id' is not null then
  if not exists(select 1 from public.business_project_wbs w join public.business_procurement_requests r on r.tenant_id=w.tenant_id and r.project_id=w.project_id where w.tenant_id=p_tenant and w.id=(v->>'wbs_id')::uuid and r.id=parent) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind='supplier_quote_lines' then
  if not exists(select 1 from public.business_procurement_request_lines l join public.business_supplier_quotes q on q.tenant_id=l.tenant_id and q.request_id=l.request_id where l.tenant_id=p_tenant and l.id=(v->>'request_line_id')::uuid and q.id=parent and l.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind='procurement_award_lines' then
  if not exists(select 1 from public.business_supplier_quote_lines l join public.business_procurement_awards a on a.tenant_id=l.tenant_id and a.quote_id=l.quote_id where l.tenant_id=p_tenant and l.id=(v->>'quote_line_id')::uuid and a.id=parent and l.status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind='projects' and old is not null then
  if v->>'budget' is distinct from old->>'budget' and exists(select 1 from public.business_budget_versions where tenant_id=p_tenant and project_id=p_id and status='posted') then raise exception 'BUSINESS_BUDGET_VERSION_REQUIRED';end if;
 elsif p_kind='project_materials' and v->>'purchase_line_id' is not null then
  if not exists(select 1 from public.business_purchase_lines l join public.business_purchase_orders h on h.tenant_id=l.tenant_id and h.id=l.purchase_order_id where l.tenant_id=p_tenant and l.id=(v->>'purchase_line_id')::uuid and l.item_id=(v->>'item_id')::uuid and h.project_id=(v->>'project_id')::uuid and h.status in ('released','completed')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind in ('purchase_orders','purchase_lines') and old is not null then
  if p_kind='purchase_orders' and old->>'procurement_award_id' is not null or p_kind='purchase_lines' and old->>'award_line_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 end if;
end $$;
revoke all on function public.business_operational_validate(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_operational_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb:=v->'calculation_snapshot'->'rows';context jsonb:=v->'calculation_snapshot'->'context';x jsonb;lines jsonb:='[]';m public.business_stock_moves%rowtype;reversal uuid;order_id uuid;previous public.business_budget_versions%rowtype;budget jsonb;limit_amount numeric;amount numeric;source_id uuid;row_kind text;date_on date:=case when p_action='reverse' then (now() at time zone 'Asia/Ho_Chi_Minh')::date else (v->>'document_date')::date end;
begin
 if p_action='reverse' then
  case p_kind
  when 'budget_versions' then
   if exists(select 1 from public.business_budget_versions where tenant_id=p_tenant and project_id=(v->>'project_id')::uuid and status='posted' and revision>(v->>'revision')::integer) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   select * into previous from public.business_budget_versions where tenant_id=p_tenant and id=(v->>'previous_id')::uuid and status='posted';budget:=public.business_project_budget(p_tenant,(v->>'project_id')::uuid);
   limit_amount:=coalesce(previous.total_amount,(context->>'previousBudget')::numeric,0)+(select coalesce(sum(e.amount),0) from public.business_budget_exceptions e where e.tenant_id=p_tenant and e.budget_id=previous.id and e.status='posted');
   if (budget->>'consumed')::numeric>limit_amount then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;
   update public.business_projects set budget=coalesce(previous.total_amount,(context->>'previousBudget')::numeric,0),row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'project_id')::uuid;
  when 'budget_exceptions' then
   budget:=public.business_project_budget(p_tenant,(v->>'project_id')::uuid);if budget->>'budgetId'=v->>'budget_id' and (budget->>'remaining')::numeric<(v->>'amount')::numeric then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;
  when 'procurement_requests' then
   if exists(select 1 from public.business_supplier_quotes where tenant_id=p_tenant and request_id=(v->>'id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'supplier_quotes' then
   if exists(select 1 from public.business_procurement_awards where tenant_id=p_tenant and quote_id=(v->>'id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'procurement_awards' then
   order_id:=(v->>'purchase_order_id')::uuid;
   if exists(select 1 from public.business_purchase_receipts where tenant_id=p_tenant and purchase_order_id=order_id and status='posted') or exists(select 1 from public.business_vendor_invoices where tenant_id=p_tenant and purchase_order_id=order_id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_purchase_orders set status='cancelled',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=order_id;
  when 'project_acceptances' then
   if exists(select 1 from public.business_acceptance_billings where tenant_id=p_tenant and acceptance_id=(v->>'id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'project_variations' then
   if exists(select 1 from public.business_project_variations where tenant_id=p_tenant and wbs_id=(v->>'wbs_id')::uuid and status='posted' and created_at>(v->>'created_at')::timestamptz) or exists(select 1 from public.business_project_acceptances where tenant_id=p_tenant and wbs_id=(v->>'wbs_id')::uuid and status='posted' and created_at>(v->>'created_at')::timestamptz) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_project_wbs set contract_quantity=(rows->0->>'oldQuantity')::numeric,contract_unit_price=(rows->0->>'oldUnitPrice')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'wbs_id')::uuid;
  when 'project_lifecycle_events' then
   if rows->0->>'previousState'='closed' or exists(select 1 from public.business_project_lifecycle_events where tenant_id=p_tenant and project_id=(v->>'project_id')::uuid and status='posted' and created_at>(v->>'created_at')::timestamptz) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_projects set operational_state=rows->0->>'previousState',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'project_id')::uuid;
  when 'acceptance_billings' then null;
  when 'project_material_returns' then
   if exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind='project_materials' and l.source_id=v->>'material_issue_id') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'stock_transfers','stock_counts' then null;
  else raise exception 'BUSINESS_INVALID_INPUT';end case;
  if p_kind in ('stock_transfers','stock_counts','project_material_returns') then
   for m in select s.* from public.business_stock_moves s where s.tenant_id=p_tenant and s.status='posted' and s.reversed_by is null and ((p_kind='stock_transfers' and s.source_kind in ('stock_transfer_out','stock_transfer_in') and s.source_id=(v->>'id')::uuid) or (p_kind='project_material_returns' and s.source_kind='project_material_return' and s.source_id=(v->>'id')::uuid) or (p_kind='stock_counts' and s.source_kind='stock_count' and s.source_id in (select id from public.business_stock_count_lines where tenant_id=p_tenant and count_id=(v->>'id')::uuid))) order by s.direction,s.id loop
    reversal:=gen_random_uuid();
    insert into public.business_stock_moves(id,tenant_id,code,name,notes,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(reversal,p_tenant,'RV-'||m.id,'Đảo '||m.code,'Đảo chứng từ '||(v->>'code'),p_actor,'posted',m.item_id,m.warehouse_id,m.lot_id,case m.direction when 'in' then 'out' else 'in' end,m.quantity,m.unit_cost,date_on,'reversal',m.id);
    update public.business_stock_moves set reversed_by=reversal,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=m.id;
   end loop;
  end if;
  return '{}';
 end if;
 case p_kind
 when 'budget_versions' then update public.business_projects set budget=(v->'calculation_snapshot'->>'total')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'project_id')::uuid;
 when 'budget_exceptions','procurement_requests','supplier_quotes','project_acceptances','acceptance_billings' then null;
 when 'project_variations' then update public.business_project_wbs set contract_quantity=(v->>'new_quantity')::numeric,contract_unit_price=(v->>'new_unit_price')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'wbs_id')::uuid;
 when 'project_lifecycle_events' then update public.business_projects set operational_state=v->>'next_state',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'project_id')::uuid;
 when 'procurement_awards' then
  order_id:=gen_random_uuid();
  insert into public.business_purchase_orders(id,tenant_id,created_by,code,name,status,partner_id,order_date,expected_on,project_id,procurement_award_id) values(order_id,p_tenant,p_actor,'PO-'||(v->>'id'),left(v->>'name',180),'released',(context->>'partnerId')::uuid,date_on,(context->>'expectedOn')::date,(context->>'projectId')::uuid,(v->>'id')::uuid);
  for x in select value from jsonb_array_elements(rows) loop insert into public.business_purchase_lines(tenant_id,created_by,code,name,purchase_order_id,item_id,quantity,unit_price,award_line_id) values(p_tenant,p_actor,'PL-'||(x->>'sourceId'),left(x->>'sourceName',180),order_id,(x->>'itemId')::uuid,(x->>'quantity')::numeric,(x->>'unitCost')::numeric,(x->>'sourceId')::uuid);end loop;
  update public.business_procurement_awards set purchase_order_id=order_id where tenant_id=p_tenant and id=(v->>'id')::uuid;
  insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(p_tenant,p_actor,'procurement.order_generated','purchase_orders',order_id,jsonb_build_object('awardId',v->>'id','reviewedBy',v->>'reviewed_by'));
 when 'stock_transfers' then
  amount:=(rows->0->>'unitCost')::numeric;
  insert into public.business_stock_moves(tenant_id,created_by,code,name,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(p_tenant,p_actor,'TO-'||(v->>'id'),v->>'name','posted',(v->>'item_id')::uuid,(v->>'from_warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,amount,date_on,'stock_transfer_out',(v->>'id')::uuid),(p_tenant,p_actor,'TI-'||(v->>'id'),v->>'name','posted',(v->>'item_id')::uuid,(v->>'to_warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,amount,date_on,'stock_transfer_in',(v->>'id')::uuid);
 when 'stock_counts' then
  for x in select value from jsonb_array_elements(rows) where (value->>'quantity')::numeric<>0 loop
   insert into public.business_stock_moves(tenant_id,created_by,code,name,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(p_tenant,p_actor,'SC-'||(x->>'sourceId'),left(v->>'name',180),'posted',(x->>'itemId')::uuid,(v->>'warehouse_id')::uuid,(x->>'lotId')::uuid,case when (x->>'quantity')::numeric>0 then 'in' else 'out' end,abs((x->>'quantity')::numeric),(x->>'unitCost')::numeric,date_on,'stock_count',(x->>'sourceId')::uuid);
  end loop;
  amount:=(v->'calculation_snapshot'->>'total')::numeric;
  if amount<>0 and v->>'inventory_account_id' is not null then lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'inventory_account_id','debit',greatest(amount,0),'credit',greatest(-amount,0)),jsonb_build_object('accountId',v->>'difference_account_id','credit',greatest(amount,0),'debit',greatest(-amount,0)));end if;
 when 'project_material_returns' then
  x:=rows->0;
  insert into public.business_stock_moves(tenant_id,created_by,code,name,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(p_tenant,p_actor,'MR-'||(v->>'id'),v->>'name','posted',(x->>'itemId')::uuid,(x->>'warehouseId')::uuid,(x->>'lotId')::uuid,'in',(x->>'quantity')::numeric,(x->>'unitCost')::numeric,date_on,'project_material_return',(v->>'id')::uuid);
 else raise exception 'BUSINESS_INVALID_INPUT';end case;
 return jsonb_build_object('lines',lines);
end $$;
revoke all on function public.business_operational_effect(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;

-- Extend the shared command infrastructure instead of exposing another write path.
do $$ declare body text;anchor text;begin
 select pg_get_functiondef('public.business_misa_validate_save(uuid,text,uuid,jsonb,jsonb)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n perform public.business_operational_validate(p_tenant,p_kind,p_id,v,old);\n');
 select pg_get_functiondef('public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text)'::regprocedure) into body;
 anchor:='if d ? ''misaDomain'' then';if strpos(body,anchor)=0 then raise exception 'Review operational save validation';end if;
 execute replace(body,anchor,E'if not(d ? ''misaDomain'') then perform public.business_operational_validate(a.tenant_id,p_kind,p_id,p_data,old);end if;\n'||anchor);
 select pg_get_functiondef('public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into body;
 anchor:='calculable:=p_kind in';if strpos(body,anchor)=0 then raise exception 'Review operational calculations';end if;execute replace(body,anchor,'calculable:=coalesce((d->>''calculable'')::boolean,false) or p_kind in');
 select pg_get_functiondef('public.business_misa_calculate(uuid,text,jsonb)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n if coalesce((select (definition->>''operationDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return public.business_operational_calculation(p_tenant,p_kind,v);end if;\n');
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n if coalesce((select (definition->>''operationDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return public.business_operational_effect(p_tenant,p_actor,p_kind,v,p_action);end if;\n');
 select pg_get_functiondef('public.business_misa_store_calculation(uuid,uuid,text,jsonb,jsonb)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n if coalesce((select (definition->>''operationDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then perform public.business_operational_store(p_tenant,p_kind,v,c);return;end if;\n');
end $$;

create function public.business_operational_store(p_tenant uuid,p_kind text,v jsonb,c jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x jsonb;
begin
 if p_kind in ('budget_versions','procurement_requests','supplier_quotes','procurement_awards','stock_counts') then execute format('update public.%I set total_amount=$3 where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using p_tenant,(v->>'id')::uuid,(c->>'total')::numeric;
 elsif p_kind in ('project_acceptances','project_material_returns') then execute format('update public.%I set amount=$3 where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using p_tenant,(v->>'id')::uuid,(c->>'total')::numeric;
 elsif p_kind='stock_transfers' then update public.business_stock_transfers set unit_cost=(c->'rows'->0->>'unitCost')::numeric where tenant_id=p_tenant and id=(v->>'id')::uuid;
 end if;
 if p_kind='stock_counts' then for x in select value from jsonb_array_elements(c->'rows') loop update public.business_stock_count_lines set system_quantity=(x->>'systemQuantity')::numeric,difference_quantity=(x->>'quantity')::numeric,amount=(x->>'amount')::numeric where tenant_id=p_tenant and id=(x->>'sourceId')::uuid;end loop;end if;
end $$;
revoke all on function public.business_operational_store(uuid,text,jsonb,jsonb) from public,anon,authenticated,service_role;
