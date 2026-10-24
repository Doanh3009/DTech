create function public.business_guard_operational_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.business_items%rowtype;l public.business_lots%rowtype;balance numeric;future_min numeric;change numeric;
begin
 if new.status<>'posted' or tg_op='UPDATE' and old.status='posted' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||new.tenant_id,0));
 if exists(select 1 from public.business_stock_counts c where c.tenant_id=new.tenant_id and c.warehouse_id=new.warehouse_id and c.status='draft' and c.calculation_snapshot is not null and not(new.source_kind='stock_count' and exists(select 1 from public.business_stock_count_lines where tenant_id=c.tenant_id and count_id=c.id and id=new.source_id))) then raise exception 'BUSINESS_STOCK_COUNT_FROZEN';end if;
 if new.document_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 select * into i from public.business_items where tenant_id=new.tenant_id and id=new.item_id and status='active';if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if not exists(select 1 from public.business_warehouses where tenant_id=new.tenant_id and id=new.warehouse_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if i.tracking<>'none' and new.lot_id is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
 if new.lot_id is not null then
  select * into l from public.business_lots where tenant_id=new.tenant_id and id=new.lot_id and item_id=new.item_id and status='active';if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.document_date<l.manufactured_on then raise exception 'BUSINESS_INVALID_DATE';end if;
 end if;
 if i.tracking='serial' then
  if new.quantity<>1 then raise exception 'BUSINESS_SERIAL_QUANTITY';end if;
  if new.direction='in' and (select coalesce(sum(case direction when 'in' then quantity else -quantity end),0) from public.business_stock_moves where tenant_id=new.tenant_id and item_id=new.item_id and lot_id=new.lot_id and status='posted')<>0 then raise exception 'BUSINESS_SERIAL_DUPLICATE';end if;
 end if;
 change:=case new.direction when 'in' then new.quantity else -new.quantity end;
 with daily as (select document_date,sum(case direction when 'in' then quantity else -quantity end) qty from public.business_stock_moves where tenant_id=new.tenant_id and item_id=new.item_id and warehouse_id=new.warehouse_id and lot_id is not distinct from new.lot_id and status='posted' group by document_date),balances as (select document_date,sum(qty) over(order by document_date) qty from daily)
 select coalesce((select sum(qty) from daily where document_date<=new.document_date),0),coalesce((select min(qty) from balances where document_date>new.document_date),1e30) into balance,future_min;
 if least(balance,future_min)+change<0 then raise exception 'BUSINESS_INSUFFICIENT_STOCK';end if;
 return new;
end $$;
revoke all on function public.business_guard_operational_stock() from public,anon,authenticated,service_role;
create trigger business_operational_stock_guard before insert or update on public.business_stock_moves for each row execute function public.business_guard_operational_stock();

create function public.business_guard_project_operating() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb:=to_jsonb(new);project uuid;parent record;qty numeric;
begin
 if v->>'status' not in ('posted','released','completed') or tg_op='UPDATE' and to_jsonb(old)->>'status'=v->>'status' then return new;end if;
 project:=(v->>'project_id')::uuid;
 if project is null and tg_table_name='business_overhead_pools' then
  if exists(select 1 from public.business_overhead_allocations a join public.business_projects p on p.tenant_id=a.tenant_id and p.id=a.project_id and p.operational_state<>'active' where a.tenant_id=new.tenant_id and a.pool_id=new.id and a.status='active') then raise exception 'BUSINESS_PROJECT_CLOSED';end if;
 end if;
 if project is not null and not exists(select 1 from public.business_projects where tenant_id=new.tenant_id and id=project and status='active' and operational_state='active') then raise exception 'BUSINESS_PROJECT_CLOSED';end if;
 if tg_table_name='business_project_materials' and v->>'purchase_line_id' is not null then
  select l.*,h.project_id into parent from public.business_purchase_lines l join public.business_purchase_orders h on h.tenant_id=l.tenant_id and h.id=l.purchase_order_id and h.status in ('released','completed') where l.tenant_id=new.tenant_id and l.id=(v->>'purchase_line_id')::uuid and l.item_id=new.item_id and h.project_id=project;
  if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  select coalesce(sum(quantity),0) into qty from public.business_purchase_receipts where tenant_id=new.tenant_id and purchase_order_id=parent.purchase_order_id and item_id=new.item_id and warehouse_id=new.warehouse_id and lot_id is not distinct from new.lot_id and status='posted';
  if qty<(select coalesce(sum(quantity),0) from public.business_project_materials where tenant_id=new.tenant_id and purchase_line_id=parent.id and status='posted' and id<>new.id)+new.quantity then raise exception 'BUSINESS_DELIVERY_EXCEEDED';end if;
 end if;
 return new;
end $$;
revoke all on function public.business_guard_project_operating() from public,anon,authenticated,service_role;
do $$ declare kind text;begin foreach kind in array array['purchase_orders','project_costs','project_materials','project_updates','timecards','advances','cost_source_links','payroll_cost_allocations','overhead_pools','costing_runs'] loop execute format('create trigger business_project_operating_guard before insert or update on public.%I for each row execute function public.business_guard_project_operating()',public.business_entity_table(kind));end loop;end $$;

create function public.business_guard_budget_consumption() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb:=to_jsonb(new);project uuid;budget jsonb;a record;
begin
 if v->>'status' not in ('posted','released','completed','active') then return new;end if;
 project:=(v->>'project_id')::uuid;
 if tg_table_name='business_purchase_lines' then select project_id into project from public.business_purchase_orders where tenant_id=new.tenant_id and id=(v->>'purchase_order_id')::uuid and status in ('released','completed');end if;
 if tg_table_name='business_overhead_pools' and v->>'status'='posted' then
  for a in select distinct project_id from public.business_overhead_allocations where tenant_id=new.tenant_id and pool_id=new.id and project_id is not null and status='active' loop budget:=public.business_project_budget(new.tenant_id,a.project_id);if (budget->>'remaining')::numeric<0 then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;end loop;
 end if;
 if project is not null and (select count(*) from public.business_budget_versions where tenant_id=new.tenant_id and project_id=project and status='posted')>0 then budget:=public.business_project_budget(new.tenant_id,project);if (budget->>'remaining')::numeric<0 then raise exception 'BUSINESS_BUDGET_EXCEEDED';end if;end if;
 return new;
end $$;
revoke all on function public.business_guard_budget_consumption() from public,anon,authenticated,service_role;
do $$ declare kind text;begin foreach kind in array array['purchase_orders','purchase_lines','project_materials','cost_source_links','payroll_cost_allocations','overhead_pools'] loop execute format('create trigger business_budget_consumption_guard after insert or update on public.%I for each row execute function public.business_guard_budget_consumption()',public.business_entity_table(kind));end loop;end $$;

-- Protect downstream references at their source reversal boundary.
do $$ declare body text;anchor text;begin
 select pg_get_functiondef('public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into body;anchor:='if not(d ? ''requiresApproval'') then';
 if strpos(body,anchor)=0 then raise exception 'Review operational source reversals';end if;
 body:=replace(body,anchor,$guard$if p_action='reverse' and p_kind='project_materials' and exists(select 1 from public.business_project_material_returns where tenant_id=a.tenant_id and material_issue_id=p_id and status='posted') or p_action='reverse' and p_kind='sales_invoices' and exists(select 1 from public.business_acceptance_billings where tenant_id=a.tenant_id and sales_invoice_id=p_id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 $guard$||anchor);execute body;
end $$;
