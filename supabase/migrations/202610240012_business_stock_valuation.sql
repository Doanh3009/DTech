-- Perpetual weighted average. Physical movements remain immutable; valuation has its own evidence.
create function public.business_stock_valuation_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m record;b record;valuation numeric;rate numeric;cost numeric;produced numeric;result jsonb:='[]';cogs numeric:=0;key text;sign numeric;fingerprint text;inventory_account uuid;inventory_accounts uuid[];
begin
 if exists(select 1 from public.business_stock_valuation_runs where tenant_id=p_tenant and status='posted' and starts_on<=(v->>'ends_on')::date and ends_on>=(v->>'starts_on')::date) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
 create temporary table if not exists dimixo_valuation_balances(k text primary key,quantity numeric not null,value numeric not null) on commit drop;
 create temporary table if not exists dimixo_valuation_movements(id uuid primary key,unit_cost numeric not null) on commit drop;
 truncate pg_temp.dimixo_valuation_balances,pg_temp.dimixo_valuation_movements;
 for m in select x.* from public.business_stock_moves x where x.tenant_id=p_tenant and x.status='posted' and x.document_date<=(v->>'ends_on')::date order by x.document_date,x.created_at,x.id loop
  key:=m.item_id::text||'/'||m.warehouse_id::text||'/'||coalesce(m.lot_id::text,'none');
  insert into pg_temp.dimixo_valuation_balances values(key,0,0) on conflict do nothing;
  select * into b from pg_temp.dimixo_valuation_balances where k=key;
  rate:=null;
  if m.source_kind='reversal' then select unit_cost into rate from pg_temp.dimixo_valuation_movements where id=m.source_id;end if;
  if rate is null and m.direction='in' and m.sales_order_id is not null then
   select case when sum(s.quantity)>0 then sum(s.quantity*u.unit_cost)/sum(s.quantity) end into rate from public.business_stock_moves s join pg_temp.dimixo_valuation_movements u on u.id=s.id where s.tenant_id=p_tenant and s.sales_order_id=m.sales_order_id and s.item_id=m.item_id and s.warehouse_id=m.warehouse_id and s.lot_id is not distinct from m.lot_id and s.direction='out' and s.status='posted';
  end if;
  if rate is null and m.direction='in' and m.source_kind='production_receipt' then
   select coalesce(sum(c.amount),0),coalesce(sum(c.quantity),0) into cost,produced from public.business_cost_receipt_values c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' and r.posting_date<=(v->>'posting_date')::date where c.tenant_id=p_tenant and c.receipt_id=m.source_id;
   if cost<=0 or produced<=0 then raise exception 'BUSINESS_COSTING_REQUIRED';end if;rate:=cost/produced;
  end if;
  rate:=coalesce(rate,case when m.direction='in' then m.unit_cost when b.quantity>0 then b.value/b.quantity else 0 end);
  sign:=case m.direction when 'in' then 1 else -1 end;valuation:=round(m.quantity*rate,4);
  if b.quantity+sign*m.quantity<0 or b.value+sign*valuation< -0.005 then raise exception 'BUSINESS_NEGATIVE_VALUATION';end if;
  update pg_temp.dimixo_valuation_balances set quantity=quantity+sign*m.quantity,value=case when quantity+sign*m.quantity=0 then 0 else greatest(0,value+sign*valuation) end where k=key;
  insert into pg_temp.dimixo_valuation_movements values(m.id,rate);
  if m.document_date>=(v->>'starts_on')::date then
   select array_agg(distinct r.inventory_account_id) into inventory_accounts from public.business_cost_receipt_values c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted' join public.business_production_receipts p on p.tenant_id=c.tenant_id and p.id=c.receipt_id join public.business_work_orders w on w.tenant_id=p.tenant_id and w.id=p.work_order_id where c.tenant_id=p_tenant and w.item_id=m.item_id;
   if cardinality(inventory_accounts)>1 then raise exception 'BUSINESS_INVENTORY_ACCOUNT_CONFLICT';end if;inventory_account:=inventory_accounts[1];
   result:=result||jsonb_build_array(jsonb_build_object('stockMoveId',m.id,'stockCode',m.code,'itemId',m.item_id,'itemName',(select name from public.business_items where tenant_id=p_tenant and id=m.item_id),'inventoryAccountId',coalesce(inventory_account,(v->>'inventory_account_id')::uuid),'quantity',sign*m.quantity,'unitCost',rate,'amount',sign*valuation,'salesOrderId',m.sales_order_id,'sourceVersion',m.row_version));
   if m.sales_order_id is not null then cogs:=cogs-sign*valuation;end if;
  end if;
 end loop;
 select md5(coalesce(string_agg(k||':'||quantity::text||':'||value::text,'|' order by k),'')) into fingerprint from pg_temp.dimixo_valuation_balances;
 return jsonb_build_object('rows',result,'total',round(cogs,2),'endingBalancesHash',fingerprint);
end $$;
revoke all on function public.business_stock_valuation_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_stock_valuation_effect(p_tenant uuid,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare total numeric:=(v->'calculation_snapshot'->>'total')::numeric;r record;lines jsonb:='[]';
begin
 if p_action='reverse' then
  if exists(select 1 from public.business_stock_valuation_runs where tenant_id=p_tenant and status='posted' and starts_on>(v->>'ends_on')::date) then raise exception 'BUSINESS_RECORD_LOCKED';end if;return '{}';
 end if;
 if total=0 then return '{}';end if;
 for r in select x->>'inventoryAccountId' account,-sum((x->>'amount')::numeric) value from jsonb_array_elements(v->'calculation_snapshot'->'rows') x where x->>'salesOrderId' is not null group by x->>'inventoryAccountId' having sum((x->>'amount')::numeric)<>0 loop
  lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'cogs_account_id','debit',greatest(r.value,0),'credit',greatest(-r.value,0)),jsonb_build_object('accountId',r.account,'credit',greatest(r.value,0),'debit',greatest(-r.value,0)));
 end loop;
 return jsonb_build_object('lines',lines);
end $$;
revoke all on function public.business_stock_valuation_effect(uuid,jsonb,text) from public,anon,authenticated,service_role;

create function public.business_guard_valued_stock() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') and exists(select 1 from public.business_stock_valuation_runs where tenant_id=new.tenant_id and status='posted' and ends_on>=new.document_date) then raise exception 'BUSINESS_STOCK_VALUATION_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_guard_valued_stock() from public,anon,authenticated,service_role;
create trigger business_guard_valued_stock before insert or update on public.business_stock_moves for each row execute function public.business_guard_valued_stock();
