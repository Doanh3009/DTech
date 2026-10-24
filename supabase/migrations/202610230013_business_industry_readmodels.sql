-- Tenant-scoped operational workspaces. No synthetic data is returned by these RPCs.
create function public.business_trace_lot(p_hash text,p_slug text,p_lot_id uuid,p_direction text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;root public.business_lots%rowtype;edges jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,'lot_links');
 if p_direction is null or p_direction not in ('inputs','outputs') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into root from public.business_lots where tenant_id=a.tenant_id and id=p_lot_id;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 with recursive reachable(id) as (
  select root.id union
  select case p_direction when 'inputs' then l.component_lot_id else l.assembly_lot_id end
  from public.business_lot_links l join reachable r on r.id=case p_direction when 'inputs' then l.assembly_lot_id else l.component_lot_id end
  where l.tenant_id=a.tenant_id and l.status='posted'
 )
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into edges from (
  select l.id,l.code,p.code assembly_lot,p.name assembly_name,c.code component_lot,c.name component_name,l.quantity,i.unit
  from public.business_lot_links l join public.business_lots p on p.tenant_id=l.tenant_id and p.id=l.assembly_lot_id
  join public.business_lots c on c.tenant_id=l.tenant_id and c.id=l.component_lot_id
  join public.business_items i on i.tenant_id=c.tenant_id and i.id=c.item_id
  where l.tenant_id=a.tenant_id and l.status='posted' and
   case p_direction when 'inputs' then l.assembly_lot_id else l.component_lot_id end in (select id from reachable)
  order by p.code,c.code,l.id limit 501
 ) x;
 return jsonb_build_object('root',root.code,'edges',edges,'truncated',jsonb_array_length(edges)>500);
end $$;
revoke all on function public.business_trace_lot(text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_trace_lot(text,text,uuid,text) to service_role;

create function public.business_operations_view(p_hash text,p_slug text,p_feature text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;rows jsonb:='[]';details jsonb:='[]';
begin
 a:=public.business_assert_session(p_hash,p_slug);
 select * into t from public.business_tenants where id=a.tenant_id;
 if p_feature is null or not(t.features ? p_feature) then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_feature='production' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select w.id,w.code,w.name,w.status,w.quantity planned,i.unit,w.due_date,w.mold_snapshot,
    public.business_terminal_quantity(a.tenant_id,w.id) good,
    (select coalesce(sum(quantity),0) from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') received,
    (select coalesce(sum(scrap_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') scrap,
    (select coalesce(sum(quantity*unit_cost),0) from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') material_cost,
    (select coalesce(sum(labor_cost+machine_cost),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') conversion_cost
   from public.business_work_orders w join public.business_items i on i.tenant_id=w.tenant_id and i.id=w.item_id
   where w.tenant_id=a.tenant_id order by w.updated_at desc,w.id limit 100
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from (
   select w.code,w.name,i.code item_code,i.name item_name,i.unit,
    sum((b->>'quantity')::numeric) required,
    round(sum((b->>'quantity')::numeric*(1+(b->>'wastePercent')::numeric/100)),4) allowed,
    (select coalesce(sum(quantity),0) from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=w.id and item_id=i.id and status='posted') issued
   from public.business_work_orders w cross join lateral jsonb_array_elements(w.bom_snapshot) b
   join public.business_items i on i.tenant_id=w.tenant_id and i.id=(b->>'itemId')::uuid
   where w.tenant_id=a.tenant_id and w.status='released'
   group by w.id,w.code,w.name,i.id,i.code,i.name,i.unit order by w.due_date,w.code,i.code limit 100
  ) x;
 elsif p_feature='mes' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select o.id,o.code,o.name,w.code order_code,c.name work_center,o.sequence,o.planned_hours,w.status,
    coalesce(sum(r.good_quantity),0) good,coalesce(sum(r.scrap_quantity),0) scrap,
    coalesce(sum(r.labor_hours),0) labor_hours,coalesce(sum(r.machine_hours),0) machine_hours
   from public.business_operations o join public.business_work_orders w on w.tenant_id=o.tenant_id and w.id=o.work_order_id
   join public.business_work_centers c on c.tenant_id=o.tenant_id and c.id=o.work_center_id
   left join public.business_production_reports r on r.tenant_id=o.tenant_id and r.operation_id=o.id and r.status='posted'
   where o.tenant_id=a.tenant_id group by o.id,w.code,w.status,c.name order by w.code,o.sequence limit 100
  ) x;
 elsif p_feature in ('quality','inventory') then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select i.id,i.code,i.name,i.unit,w.name warehouse,l.code lot_code,l.quality_state,l.expires_on,
    case when l.expires_on<(now() at time zone 'Asia/Ho_Chi_Minh')::date then 'expired'
     when t.features ? 'quality' and l.quality_state is distinct from 'released' and l.id is not null then 'blocked'
     when l.expires_on<=(now() at time zone 'Asia/Ho_Chi_Minh')::date+30 then 'expiring' else 'available' end availability,
    sum(case m.direction when 'in' then m.quantity else -m.quantity end) quantity
   from public.business_stock_moves m join public.business_items i on i.tenant_id=m.tenant_id and i.id=m.item_id
   join public.business_warehouses w on w.tenant_id=m.tenant_id and w.id=m.warehouse_id
   left join public.business_lots l on l.tenant_id=m.tenant_id and l.id=m.lot_id
   where m.tenant_id=a.tenant_id and m.status='posted'
   group by i.id,i.code,i.name,i.unit,w.name,l.id,l.code,l.quality_state,l.expires_on
   having sum(case m.direction when 'in' then m.quantity else -m.quantity end)<>0
   order by l.expires_on nulls last,i.code,w.name limit 100
  ) x;
  if p_feature='quality' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from (
    select l.id,l.code,l.name,i.name item_name,l.manufactured_on,l.expires_on,l.quality_state
    from public.business_lots l join public.business_items i on i.tenant_id=l.tenant_id and i.id=l.item_id
    where l.tenant_id=a.tenant_id and l.status='active' and l.quality_state<>'released'
    order by l.expires_on nulls last,l.code limit 100
   ) x;
  end if;
 elsif p_feature='traceability' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select r.id,r.code,r.name,l.code assembly_lot,c.code component_lot,r.quantity,i.unit,w.code order_code,r.source_receipt_id
   from public.business_lot_links r join public.business_lots l on l.tenant_id=r.tenant_id and l.id=r.assembly_lot_id
   join public.business_lots c on c.tenant_id=r.tenant_id and c.id=r.component_lot_id
   join public.business_items i on i.tenant_id=c.tenant_id and i.id=c.item_id
   left join public.business_production_receipts p on p.tenant_id=r.tenant_id and p.id=r.source_receipt_id
   left join public.business_work_orders w on w.tenant_id=p.tenant_id and w.id=p.work_order_id
   where r.tenant_id=a.tenant_id and r.status='posted' order by r.created_at desc,r.id limit 100
  ) x;
 elsif p_feature='sales' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select o.id,o.code,o.name,o.status,p.name customer,o.due_date,
    (select coalesce(sum(quantity*unit_price),0) from public.business_sales_lines where tenant_id=a.tenant_id and sales_order_id=o.id and status='active') amount,
    (select coalesce(sum(quantity),0) from public.business_sales_lines where tenant_id=a.tenant_id and sales_order_id=o.id and status='active') ordered,
    (select coalesce(sum(case direction when 'out' then quantity else -quantity end),0) from public.business_stock_moves where tenant_id=a.tenant_id and sales_order_id=o.id and status='posted') shipped,
    (select coalesce(sum(amount-paid_amount),0) from public.business_receivables where tenant_id=a.tenant_id and sales_order_id=o.id and status='posted') remaining
   from public.business_sales_orders o join public.business_tenant_partners p on p.tenant_id=o.tenant_id and p.id=o.partner_id
   where o.tenant_id=a.tenant_id order by o.updated_at desc,o.id limit 100
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from (
   select r.id,r.code,r.name,p.name customer,r.amount,r.paid_amount,r.amount-r.paid_amount remaining,r.due_date
   from public.business_receivables r join public.business_tenant_partners p on p.tenant_id=r.tenant_id and p.id=r.partner_id
   where r.tenant_id=a.tenant_id and r.status='posted' and r.amount>r.paid_amount order by r.due_date,r.id limit 100
  ) x;
 elsif p_feature='projects' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select p.id,p.code,p.name,p.budget,p.starts_on,p.ends_on,
    (select coalesce(sum(quantity*unit_cost),0) from public.business_project_materials where tenant_id=a.tenant_id and project_id=p.id and status='posted') material_cost,
    (select coalesce(sum(amount),0) from public.business_project_costs where tenant_id=a.tenant_id and project_id=p.id and status='posted') other_cost,
    (select completion_percent from public.business_project_updates where tenant_id=a.tenant_id and project_id=p.id and status='posted' order by reported_on desc,created_at desc limit 1) completion_percent
   from public.business_projects p where p.tenant_id=a.tenant_id order by p.updated_at desc,p.id limit 100
  ) x;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into details from (
   select p.code,p.name,c.category,sum(c.amount) amount from public.business_project_costs c
   join public.business_projects p on p.tenant_id=c.tenant_id and p.id=c.project_id
   where c.tenant_id=a.tenant_id and c.status='posted' group by p.code,p.name,c.category order by p.code,c.category limit 100
  ) x;
 elsif p_feature='crm' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select i.id,i.code,i.name,p.name customer,i.channel,i.next_contact_on from public.business_interactions i
   join public.business_tenant_partners p on p.tenant_id=i.tenant_id and p.id=i.partner_id
   where i.tenant_id=a.tenant_id and i.status='active' order by i.next_contact_on nulls last,i.code limit 100
  ) x;
 else raise exception 'BUSINESS_FORBIDDEN';end if;
 return jsonb_build_object('rows',rows,'details',details,'limit',100);
end $$;
revoke all on function public.business_operations_view(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_operations_view(text,text,text) to service_role;

create or replace function public.business_overview(p_hash text,p_slug text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;stock jsonb;production jsonb;projects jsonb;receivables jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into stock from (select i.code,i.name,w.name warehouse,l.code lot_code,sum(case m.direction when 'in' then m.quantity else -m.quantity end) quantity,i.unit from public.business_stock_moves m join public.business_items i on i.tenant_id=m.tenant_id and i.id=m.item_id join public.business_warehouses w on w.tenant_id=m.tenant_id and w.id=m.warehouse_id left join public.business_lots l on l.tenant_id=m.tenant_id and l.id=m.lot_id where m.tenant_id=a.tenant_id and m.status='posted' group by i.code,i.name,w.name,l.code,i.unit order by i.code limit 100) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into production from (select w.code,w.name,w.status,w.quantity target_quantity,w.bom_snapshot,public.business_terminal_quantity(a.tenant_id,w.id) good_quantity,(select coalesce(sum(scrap_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') scrap_quantity,(select coalesce(sum(labor_cost+machine_cost),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') conversion_cost,(select coalesce(sum(quantity*unit_cost),0) from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') material_cost from public.business_work_orders w where w.tenant_id=a.tenant_id order by w.updated_at desc limit 100) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into projects from (select p.code,p.name,p.budget,((select coalesce(sum(amount),0) from public.business_project_costs where tenant_id=a.tenant_id and project_id=p.id and status='posted')+(select coalesce(sum(quantity*unit_cost),0) from public.business_project_materials where tenant_id=a.tenant_id and project_id=p.id and status='posted')) actual_cost,(select completion_percent from public.business_project_updates where tenant_id=a.tenant_id and project_id=p.id and status='posted' order by reported_on desc,created_at desc limit 1) completion_percent from public.business_projects p where p.tenant_id=a.tenant_id order by p.updated_at desc limit 100) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]') into receivables from (select code,name,amount,paid_amount,amount-paid_amount remaining,due_date from public.business_receivables where tenant_id=a.tenant_id and status='posted' order by due_date limit 100) x;
 return jsonb_build_object('stock',stock,'production',production,'projects',projects,'receivables',receivables,'limit',100);
end $$;

