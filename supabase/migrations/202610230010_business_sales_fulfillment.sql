-- Fulfillment is guarded at the ledger boundary, including manual stock commands.
create function public.business_guard_sales_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare o public.business_sales_orders%rowtype; ordered numeric; shipped numeric; delta numeric;
begin
 if tg_op='UPDATE' and old.status='posted' then
  if new.status<>'posted' or
   (new.tenant_id,new.item_id,new.warehouse_id,new.lot_id,new.direction,new.quantity,new.unit_cost,new.document_date,new.sales_order_id,new.source_kind,new.source_id)
   is distinct from
   (old.tenant_id,old.item_id,old.warehouse_id,old.lot_id,old.direction,old.quantity,old.unit_cost,old.document_date,old.sales_order_id,old.source_kind,old.source_id)
  then raise exception 'BUSINESS_RECORD_LOCKED'; end if;
  return new;
 end if;
 if new.status<>'posted' or new.sales_order_id is null then return new; end if;
 select * into o from public.business_sales_orders where tenant_id=new.tenant_id and id=new.sales_order_id for update;
 if not found or o.status not in ('released','completed') or (o.status='completed' and new.direction='out') then raise exception 'BUSINESS_RECORD_LOCKED'; end if;
 if new.document_date<o.order_date or new.document_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE'; end if;
 select coalesce(sum(quantity),0) into ordered from public.business_sales_lines
 where tenant_id=new.tenant_id and sales_order_id=o.id and item_id=new.item_id and status='active';
 if ordered<=0 then raise exception 'BUSINESS_SALES_ITEM_MISMATCH'; end if;
 select coalesce(sum(case direction when 'out' then quantity else -quantity end),0) into shipped
 from public.business_stock_moves where tenant_id=new.tenant_id and sales_order_id=o.id and item_id=new.item_id and status='posted' and id<>new.id;
 delta:=case new.direction when 'out' then new.quantity else -new.quantity end;
 if shipped+delta>ordered then raise exception 'BUSINESS_DELIVERY_EXCEEDED'; end if;
 if shipped+delta<0 then raise exception 'BUSINESS_RETURN_EXCEEDED'; end if;
 -- A return/reversal reopens a completed order; completion must reflect the net ledger.
 update public.business_sales_orders set row_version=row_version+1,updated_at=now(),
 status=case when status='completed' and delta<0 then 'released' else status end
 where tenant_id=new.tenant_id and id=o.id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details)
 values(new.tenant_id,new.created_by,'sales.fulfillment_changed','sales_orders',o.id,
 jsonb_build_object('stockMoveId',new.id,'quantity',delta,'rowVersion',o.row_version+1));
 return new;
end $$;
create trigger business_sales_stock_guard before insert or update on public.business_stock_moves
for each row execute function public.business_guard_sales_stock();
revoke all on function public.business_guard_sales_stock() from public,anon,authenticated,service_role;

create function public.business_sales_fulfillment(p_hash text,p_slug text,p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype; o public.business_sales_orders%rowtype; items jsonb; stock jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 perform public.business_assert_kind(a.tenant_id,'sales_orders');
 perform public.business_assert_kind(a.tenant_id,'stock_moves');
 select * into o from public.business_sales_orders where tenant_id=a.tenant_id and id=p_order_id for share;
 if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into items from (
  select i.id as "itemId",i.code,i.name,i.unit,i.tracking,i.standard_cost as "unitCost",
   sum(l.quantity) as ordered,
   (select coalesce(sum(case m.direction when 'out' then m.quantity else -m.quantity end),0)
    from public.business_stock_moves m where m.tenant_id=a.tenant_id and m.sales_order_id=o.id and m.item_id=i.id and m.status='posted') as shipped
  from public.business_sales_lines l join public.business_items i on i.tenant_id=l.tenant_id and i.id=l.item_id
  where l.tenant_id=a.tenant_id and l.sales_order_id=o.id and l.status='active'
  group by i.id,i.code,i.name,i.unit,i.tracking,i.standard_cost order by i.code
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into stock from (
  select m.item_id as "itemId",m.warehouse_id as "warehouseId",w.name as warehouse,
   m.lot_id as "lotId",l.code as lot,l.quality_state as quality,l.expires_on as "expiresOn",
   sum(case m.direction when 'in' then m.quantity else -m.quantity end) as available
  from public.business_stock_moves m
  join public.business_warehouses w on w.tenant_id=m.tenant_id and w.id=m.warehouse_id and w.status='active'
  left join public.business_lots l on l.tenant_id=m.tenant_id and l.id=m.lot_id
  where m.tenant_id=a.tenant_id and m.status='posted' and exists
   (select 1 from public.business_sales_lines s where s.tenant_id=a.tenant_id and s.sales_order_id=o.id and s.item_id=m.item_id and s.status='active')
  group by m.item_id,m.warehouse_id,w.name,m.lot_id,l.code,l.quality_state,l.expires_on
  having sum(case m.direction when 'in' then m.quantity else -m.quantity end)>0
  order by w.name,l.expires_on nulls last,l.code
 ) x;
 return jsonb_build_object('orderId',o.id,'code',o.code,'rowVersion',o.row_version,'status',o.status,'items',items,'stock',stock);
end $$;

create function public.business_deliver_sales_order(p_hash text,p_slug text,p_request_id uuid,p_order_id uuid,
 p_expected_version integer,p_document_date date,p_lines jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype; o public.business_sales_orders%rowtype; r jsonb; h text;
 line jsonb; move_id uuid; moves jsonb:='[]'; qty numeric; cost numeric; item uuid; warehouse uuid; lot uuid; n integer:=0; v integer;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);
 perform public.business_assert_kind(a.tenant_id,'sales_orders');
 perform public.business_assert_kind(a.tenant_id,'stock_moves');
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 h:=encode(sha256(convert_to(jsonb_build_object('orderId',p_order_id,'rowVersion',p_expected_version,'date',p_document_date,'lines',p_lines)::text,'UTF8')),'hex');
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'sales.deliver',h);
 if r is not null then return r; end if;
 if p_order_id is null or p_expected_version is null or p_expected_version<1 or p_document_date is null
 or p_document_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date
 or coalesce(jsonb_typeof(p_lines),'')<>'array' then raise exception 'BUSINESS_INVALID_INPUT'; end if;
 if jsonb_array_length(p_lines) not between 1 and 50 then raise exception 'BUSINESS_INVALID_INPUT'; end if;
 select * into o from public.business_sales_orders where tenant_id=a.tenant_id and id=p_order_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;
 if o.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT'; end if;
 if o.status<>'released' then raise exception 'BUSINESS_RECORD_LOCKED'; end if;
 if p_document_date<o.order_date then raise exception 'BUSINESS_INVALID_DATE'; end if;
 for line in select value from jsonb_array_elements(p_lines) loop
  if jsonb_typeof(line)<>'object' or not(line ?& array['itemId','warehouseId','lotId','quantity','unitCost'])
  or (select count(*) from jsonb_object_keys(line))<>5
  or jsonb_typeof(line->'quantity')<>'number' or jsonb_typeof(line->'unitCost')<>'number'
  then raise exception 'BUSINESS_INVALID_INPUT'; end if;
  item:=(line->>'itemId')::uuid; warehouse:=(line->>'warehouseId')::uuid; lot:=(line->>'lotId')::uuid;
  qty:=(line->>'quantity')::numeric; cost:=(line->>'unitCost')::numeric;
  if item is null or warehouse is null or qty not between 0.0001 and 1000000000000 or cost not between 0 and 1000000000000
  or round(qty,4)<>qty or round(cost,4)<>cost then raise exception 'BUSINESS_INVALID_INPUT'; end if;
  perform public.business_check_stock(a.tenant_id,item,warehouse,lot,'out',qty,p_document_date);
  n:=n+1; move_id:=gen_random_uuid();
  insert into public.business_stock_moves(id,tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,sales_order_id,source_kind)
  values(move_id,a.tenant_id,'DLV-'||p_request_id::text||'-'||n,'Giao hàng '||o.code,a.id,'posted',item,warehouse,lot,'out',qty,cost,p_document_date,o.id,'sales_delivery');
  moves:=moves||jsonb_build_array(move_id);
 end loop;
 select row_version into v from public.business_sales_orders where tenant_id=a.tenant_id and id=o.id;
 r:=jsonb_build_object('orderId',o.id,'rowVersion',v,'stockMoveIds',moves);
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details)
 values(a.tenant_id,a.id,'sales.delivered','sales_orders',o.id,jsonb_build_object('requestId',p_request_id,'stockMoveIds',moves));
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt)
 values(p_request_id,a.tenant_id,a.id,'sales.deliver',h,r);
 return r;
exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range or foreign_key_violation then raise exception 'BUSINESS_INVALID_INPUT';
end $$;

revoke all on function public.business_sales_fulfillment(text,text,uuid),public.business_deliver_sales_order(text,text,uuid,uuid,integer,date,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.business_sales_fulfillment(text,text,uuid),public.business_deliver_sales_order(text,text,uuid,uuid,integer,date,jsonb) to service_role;
