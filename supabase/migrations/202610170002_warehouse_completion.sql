-- Count only the warehouse's tracked items by default; selected scope can add newly discovered stock.
create or replace function public.create_stock_count(p_number text,p_warehouse_id uuid,p_count_date date,p_scope text,p_transaction_policy text,p_item_ids uuid[],p_note text,p_actor_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_count_id uuid; v_inserted integer;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_warehouse_id::text,0));
  if not exists(select 1 from warehouses where id=p_warehouse_id and status='active') then raise exception 'WAREHOUSE_INACTIVE'; end if;
  if p_scope not in ('all','selected') or p_transaction_policy not in ('freeze','reconcile') then raise exception 'COUNT_LINE_INVALID'; end if;
  if p_scope='selected' and coalesce(cardinality(p_item_ids),0)=0 then raise exception 'COUNT_ITEMS_REQUIRED'; end if;
  if p_scope='selected' and exists(select 1 from unnest(p_item_ids) x(id) where not exists(select 1 from inventory_items i where i.id=x.id and i.tracked_inventory and i.status='active')) then raise exception 'COUNT_LINE_INVALID'; end if;
  insert into stock_counts(count_number,warehouse_id,count_date,snapshot_at,scope,transaction_policy,note,created_by)
    values(p_number,p_warehouse_id,p_count_date,clock_timestamp(),p_scope,p_transaction_policy,p_note,p_actor_id) returning id into v_count_id;
  insert into stock_count_lines(stock_count_id,item_id,uom_id,expected_quantity)
    select v_count_id,i.id,i.base_uom_id,coalesce(b.on_hand,0) from inventory_items i
    left join inventory_balances b on b.warehouse_id=p_warehouse_id and b.item_id=i.id
    where i.tracked_inventory and i.status='active' and (p_scope='selected' and i.id=any(p_item_ids) or p_scope='all' and (b.item_id is not null or exists(select 1 from item_warehouse_settings s where s.warehouse_id=p_warehouse_id and s.item_id=i.id)));
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then raise exception 'COUNT_ITEMS_REQUIRED'; end if;
  return v_count_id;
end $$;
alter table public.stock_counts add column client_request_id uuid;
create unique index stock_counts_client_request_idx on public.stock_counts(client_request_id) where client_request_id is not null;
create function public.create_stock_count_once(p_number text,p_warehouse_id uuid,p_count_date date,p_scope text,p_transaction_policy text,p_item_ids uuid[],p_note text,p_actor_id uuid,p_client_request_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare existing stock_counts%rowtype; v_id uuid;
begin
  if p_client_request_id is null then raise exception 'CLIENT_REQUEST_REQUIRED'; end if;
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('stock-count-request:'||p_client_request_id::text,0));
  select * into existing from stock_counts where client_request_id=p_client_request_id;
  if found then
    if existing.created_by is distinct from p_actor_id or existing.warehouse_id<>p_warehouse_id then raise exception 'COUNT_REQUEST_CONFLICT'; end if;
    return existing.id;
  end if;
  v_id:=create_stock_count(p_number,p_warehouse_id,p_count_date,p_scope,p_transaction_policy,p_item_ids,p_note,p_actor_id);
  update stock_counts set client_request_id=p_client_request_id where id=v_id;
  return v_id;
end $$;
revoke all on function public.create_stock_count(text,uuid,date,text,text,uuid[],text,uuid),public.create_stock_count_once(text,uuid,date,text,text,uuid[],text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_stock_count(text,uuid,date,text,text,uuid[],text,uuid),public.create_stock_count_once(text,uuid,date,text,text,uuid[],text,uuid,uuid) to service_role;

-- Save partial physical counts without interpreting an empty input as zero.
create or replace function public.save_stock_count(p_count_id uuid,p_row_version integer,p_actor_id uuid,p_lines jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare c stock_counts%rowtype; requested integer; changed integer;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into c from stock_counts where id=p_count_id for update;
  if not found then raise exception 'COUNT_NOT_FOUND'; end if;
  if c.row_version<>p_row_version then raise exception 'COUNT_VERSION_CONFLICT'; end if;
  if c.status not in ('counting','reviewed') then raise exception 'INVALID_COUNT_STATUS'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'COUNT_LINES_REQUIRED'; end if;
  select count(*) into requested from jsonb_to_recordset(p_lines) as x(id uuid,counted_quantity numeric,note text);
  if exists(select 1 from jsonb_to_recordset(p_lines) as x(id uuid,counted_quantity numeric,note text) where counted_quantity<0 or counted_quantity::text in ('NaN','Infinity','-Infinity'))
     or (select count(distinct id) from jsonb_to_recordset(p_lines) as x(id uuid))<>requested then raise exception 'COUNT_LINE_INVALID'; end if;
  with input as(select * from jsonb_to_recordset(p_lines) as x(id uuid,counted_quantity numeric,note text))
  update stock_count_lines l set counted_quantity=input.counted_quantity,note=input.note from input
    where l.id=input.id and l.stock_count_id=c.id;
  get diagnostics changed=row_count;
  if changed<>requested then raise exception 'COUNT_LINE_INVALID'; end if;
  if exists(select 1 from stock_count_lines where stock_count_id=c.id and counted_quantity is null) then
    update stock_counts set status='counting',reviewed_by=null,reviewed_at=null where id=c.id;
  else
    update stock_counts set status='reviewed',reviewed_by=p_actor_id,reviewed_at=now() where id=c.id;
  end if;
  return c.id;
end $$;

-- Cancelling an unposted count also releases its warehouse transaction freeze.
create function public.cancel_warehouse_record(p_id uuid,p_kind text,p_row_version integer,p_actor_id uuid,p_reason text)
returns void language plpgsql security invoker set search_path=public as $$
declare c stock_counts%rowtype; d inventory_documents%rowtype;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  if length(trim(coalesce(p_reason,'')))<3 then raise exception 'REASON_REQUIRED'; end if;
  if p_kind='stock_count' then
    select * into c from stock_counts where id=p_id for update;
    if not found or c.row_version<>p_row_version then raise exception 'COUNT_VERSION_CONFLICT'; end if;
    if c.status not in ('draft','counting','reviewed') then raise exception 'INVALID_COUNT_STATUS'; end if;
    perform pg_advisory_xact_lock(hashtextextended(c.warehouse_id::text,0));
    update stock_counts set status='cancelled',note=concat_ws(E'\n',nullif(note,''),'Hủy: '||trim(p_reason)) where id=c.id;
    insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload)
      values('warehouse.stock_count.cancelled',c.warehouse_id,c.id,jsonb_build_object('actorId',p_actor_id,'reason',trim(p_reason)));
  elsif p_kind='document' then
    select * into d from inventory_documents where id=p_id for update;
    if not found or d.row_version<>p_row_version then raise exception 'DOCUMENT_VERSION_CONFLICT'; end if;
    if d.status<>'draft' then raise exception 'DOCUMENT_IMMUTABLE'; end if;
    update inventory_documents set status='cancelled',note=concat_ws(E'\n',nullif(note,''),'Hủy: '||trim(p_reason)) where id=d.id;
    insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload)
      values('warehouse.document.cancelled',coalesce(d.target_warehouse_id,d.source_warehouse_id),d.id,jsonb_build_object('actorId',p_actor_id,'reason',trim(p_reason)));
  else raise exception 'INVALID_RECORD_KIND'; end if;
end $$;
revoke all on function public.save_stock_count(uuid,integer,uuid,jsonb),public.cancel_warehouse_record(uuid,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.save_stock_count(uuid,integer,uuid,jsonb),public.cancel_warehouse_record(uuid,text,integer,uuid,text) to service_role;

create function public.post_inventory_document_versioned(p_document_id uuid,p_row_version integer,p_actor_id uuid,p_posting_date date,p_idempotency_key uuid,p_allow_negative boolean default false,p_override_reason text default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare d inventory_documents%rowtype;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into d from inventory_documents where id=p_document_id for update;
  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  if d.status<>'posted' and d.row_version<>p_row_version then raise exception 'DOCUMENT_VERSION_CONFLICT'; end if;
  return post_inventory_document(p_document_id,p_actor_id,p_posting_date,p_idempotency_key,p_allow_negative,p_override_reason);
end $$;
-- Physical counts cannot be safely applied against stock that moved after their snapshot.
create or replace function public.post_stock_count(p_count_id uuid,p_actor_id uuid,p_posting_date date,p_idempotency_key uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_count stock_counts%rowtype; v_document_id uuid; v_document_number text; v_line stock_count_lines%rowtype; v_line_number integer:=0; v_variances integer;
begin
  select * into v_count from stock_counts where id=p_count_id for update; if not found then raise exception using errcode='P0002',message='COUNT_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_count.warehouse_id::text,0));
  if v_count.status='posted' then return v_count.adjustment_document_id; end if;
  if v_count.status not in ('counting','reviewed') then raise exception using errcode='P0001',message='INVALID_COUNT_STATUS'; end if;
  if exists(select 1 from stock_count_lines where stock_count_id=p_count_id and counted_quantity is null) then raise exception using errcode='P0001',message='COUNT_INCOMPLETE'; end if;
  if v_count.transaction_policy='reconcile' and exists(select 1 from stock_ledger where warehouse_id=v_count.warehouse_id and created_at>v_count.snapshot_at) then
    raise exception 'COUNT_MOVEMENTS_DETECTED';
  end if;
  select count(*) into v_variances from stock_count_lines where stock_count_id=p_count_id and variance<>0;
  if v_variances>0 then
    v_document_number:=next_inventory_document_number('adjustment',p_posting_date);
    insert into inventory_documents(document_number,type,status,document_date,source_warehouse_id,transaction_type_code,note,created_by)
    values(v_document_number,'adjustment','draft',v_count.count_date,v_count.warehouse_id,'COUNT_VARIANCE','Điều chỉnh từ '||v_count.count_number,p_actor_id) returning id into v_document_id;
    for v_line in select * from stock_count_lines where stock_count_id=p_count_id and variance<>0 order by item_id loop
      v_line_number:=v_line_number+1;
      insert into inventory_document_lines(document_id,line_number,item_id,quantity,adjustment_quantity,uom_id,reference)
      values(v_document_id,v_line_number,v_line.item_id,abs(v_line.variance),v_line.variance,v_line.uom_id,v_count.count_number);
    end loop;
    perform post_inventory_document(v_document_id,p_actor_id,p_posting_date,p_idempotency_key,false,null);
  end if;
  update stock_counts set status='posted',posted_by=p_actor_id,posted_at=now(),post_idempotency_key=p_idempotency_key,adjustment_document_id=v_document_id where id=p_count_id;
  insert into warehouse_domain_events(event_type,warehouse_id,aggregate_id,payload) values('warehouse.stock_count.posted',v_count.warehouse_id,p_count_id,jsonb_build_object('adjustmentDocumentId',v_document_id));
  return v_document_id;
end $$;
revoke all on function public.post_stock_count(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.post_stock_count(uuid,uuid,date,uuid) to service_role;

create function public.post_stock_count_versioned(p_count_id uuid,p_row_version integer,p_actor_id uuid,p_posting_date date,p_idempotency_key uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare c stock_counts%rowtype;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  select * into c from stock_counts where id=p_count_id for update;
  if not found then raise exception 'COUNT_NOT_FOUND'; end if;
  if c.status<>'posted' and c.row_version<>p_row_version then raise exception 'COUNT_VERSION_CONFLICT'; end if;
  return post_stock_count(p_count_id,p_actor_id,p_posting_date,p_idempotency_key);
end $$;
revoke all on function public.post_inventory_document_versioned(uuid,integer,uuid,date,uuid,boolean,text),public.post_stock_count_versioned(uuid,integer,uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.post_inventory_document_versioned(uuid,integer,uuid,date,uuid,boolean,text),public.post_stock_count_versioned(uuid,integer,uuid,date,uuid) to service_role;

create function public.save_warehouse_record(p_id uuid,p_row_version integer,p_actor_id uuid,p_values jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare w warehouses%rowtype; v_id uuid; v_project uuid:=nullif(p_values->>'projectId','')::uuid; v_site uuid:=nullif(p_values->>'worksiteId','')::uuid;
begin
  if not exists(select 1 from app_accounts where id=p_actor_id and status='active') then raise exception 'ACTOR_REQUIRED'; end if;
  if v_site is not null and not exists(select 1 from worksites where id=v_site and project_id=v_project) then raise exception 'INVALID_PROJECT_WORKSITE'; end if;
  if p_id is null then
    insert into warehouses(code,name,type,address,manager_employee_id,project_id,worksite_id,status,note,created_by)
    values(p_values->>'code',p_values->>'name',(p_values->>'type')::warehouse_type,nullif(p_values->>'address',''),nullif(p_values->>'managerEmployeeId','')::uuid,v_project,v_site,(p_values->>'status')::warehouse_status,nullif(p_values->>'note',''),p_actor_id) returning id into v_id;
    insert into warehouse_user_scopes(account_id,warehouse_id,can_view,can_operate,granted_by) values(p_actor_id,v_id,true,true,p_actor_id);
  else
    select * into w from warehouses where id=p_id for update;
    if not found or w.row_version<>p_row_version then raise exception 'WAREHOUSE_VERSION_CONFLICT'; end if;
    perform pg_advisory_xact_lock(hashtextextended(w.id::text,0));
    if p_values->>'status'='inactive' and w.status='active' then
      if exists(select 1 from inventory_balances where warehouse_id=w.id and on_hand<>0) then raise exception 'WAREHOUSE_HAS_STOCK'; end if;
      if exists(select 1 from stock_counts where warehouse_id=w.id and status in ('counting','reviewed')) then raise exception 'WAREHOUSE_FROZEN'; end if;
    end if;
    update warehouses set code=p_values->>'code',name=p_values->>'name',type=(p_values->>'type')::warehouse_type,address=nullif(p_values->>'address',''),
      manager_employee_id=nullif(p_values->>'managerEmployeeId','')::uuid,project_id=v_project,worksite_id=v_site,status=(p_values->>'status')::warehouse_status,note=nullif(p_values->>'note','') where id=w.id;
    v_id:=w.id;
  end if;
  return v_id;
end $$;
revoke all on function public.save_warehouse_record(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_warehouse_record(uuid,integer,uuid,jsonb) to service_role;
