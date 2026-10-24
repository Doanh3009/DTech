-- Approved operating prices remain historical inputs. Actual costing uses the
-- same moving-average basis as the inventory valuation ledger.
create function public.business_material_actual_cost(p_tenant uuid,p_source uuid,p_kind text) returns numeric language plpgsql security definer set search_path='' as $$
declare target public.business_stock_moves%rowtype;m public.business_stock_moves%rowtype;quantity numeric:=0;value numeric:=0;rate numeric;amount numeric;rate_cache jsonb:='{}';cost numeric;produced numeric;
begin
 select * into target from public.business_stock_moves where tenant_id=p_tenant and source_id=p_source and source_kind=case p_kind when 'material_issues' then 'material_issue' else 'project_material' end and direction='out' and status='posted';
 if not found then raise exception 'BUSINESS_COST_SOURCE_REQUIRED';end if;
 for m in select * from public.business_stock_moves where tenant_id=p_tenant and item_id=target.item_id and warehouse_id=target.warehouse_id and lot_id is not distinct from target.lot_id and status='posted' and (document_date,created_at,id)<(target.document_date,target.created_at,target.id) order by document_date,created_at,id loop
  rate:=null;
  if m.source_kind='reversal' then rate:=(rate_cache->>m.source_id::text)::numeric;end if;
  if rate is null and m.direction='in' and m.source_kind='production_receipt' then
   select coalesce(sum(c.amount),0),coalesce(sum(c.quantity),0) into cost,produced from public.business_cost_receipt_values c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' where c.tenant_id=p_tenant and c.receipt_id=m.source_id;
   if cost<=0 or produced<=0 then raise exception 'BUSINESS_COSTING_REQUIRED';end if;rate:=cost/produced;
  end if;
  if rate is null and m.direction='in' and m.sales_order_id is not null then
   select sum(s.quantity*(rate_cache->>s.id::text)::numeric)/nullif(sum(s.quantity),0) into rate from public.business_stock_moves s where s.tenant_id=p_tenant and s.sales_order_id=m.sales_order_id and s.item_id=m.item_id and s.warehouse_id=m.warehouse_id and s.lot_id is not distinct from m.lot_id and s.direction='out' and s.status='posted' and rate_cache ? s.id::text;
  end if;
  rate:=coalesce(rate,case m.direction when 'in' then m.unit_cost else case when quantity>0 then value/quantity else 0 end end);amount:=round(m.quantity*rate,4);
  if m.direction='in' then quantity:=quantity+m.quantity;value:=value+amount;else quantity:=quantity-m.quantity;value:=value-amount;end if;
  if quantity<0 or value< -0.005 then raise exception 'BUSINESS_NEGATIVE_VALUATION';end if;
  if quantity=0 then value:=0;end if;rate_cache:=rate_cache||jsonb_build_object(m.id::text,rate);
 end loop;
 if quantity<target.quantity then raise exception 'BUSINESS_INSUFFICIENT_STOCK';end if;
 return round(target.quantity*case when quantity>0 then value/quantity else 0 end,4);
end $$;
revoke all on function public.business_material_actual_cost(uuid,uuid,text) from public,anon,authenticated,service_role;

do $$ declare body text;begin
 select pg_get_functiondef('public.business_costing_calculation(uuid,jsonb)'::regprocedure) into body;
 if strpos(body,'m.quantity*m.unit_cost amount')=0 then raise exception 'Review costing material values before upgrading';end if;
 body:=replace(body,'m.quantity*m.unit_cost amount','public.business_material_actual_cost(p_tenant,m.id,''material_issues'') amount');
 body:=replace(body,'''material'',m.quantity*m.unit_cost,(v->>''material_account_id'')','''material'',public.business_material_actual_cost(p_tenant,m.id,''project_materials''),(v->>''material_account_id'')');execute body;
 select pg_get_functiondef('public.business_costing_effect(uuid,uuid,text,jsonb,text)'::regprocedure) into body;
 if strpos(body,'(physical->>''quantity'')::numeric*(physical->>''unit_cost'')::numeric')=0 then raise exception 'Review matched material valuation before upgrading';end if;
 execute replace(body,'(physical->>''quantity'')::numeric*(physical->>''unit_cost'')::numeric','public.business_material_actual_cost(p_tenant,(v->>''source_record_id'')::uuid,v->>''source_kind'')');
end $$;
