-- Keep document header and lines in one transaction. The service role remains the only caller.
create or replace function public.create_inventory_document(
  p_number text,
  p_client_request_id uuid,
  p_type public.inventory_document_type,
  p_header jsonb,
  p_lines jsonb,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document_id uuid;
  v_line jsonb;
  v_line_number integer := 0;
begin
  if p_client_request_id is not null then
    select id into v_document_id
    from public.inventory_documents
    where client_request_id = p_client_request_id;
    if found then return v_document_id; end if;
  end if;
  if p_type = 'reversal' then
    raise exception using errcode = 'P0001', message = 'DIRECT_REVERSAL_NOT_ALLOWED';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode = 'P0001', message = 'DOCUMENT_HAS_NO_LINES';
  end if;

  insert into public.inventory_documents (
    client_request_id, document_number, type, document_date,
    source_warehouse_id, target_warehouse_id, transaction_type_code,
    supplier_reference, shipment_id, shipment_receipt_reference,
    project_id, worksite_id, delivered_by, received_by, recipient,
    receiving_department, note, created_by
  ) values (
    p_client_request_id, p_number, p_type, (p_header->>'document_date')::date,
    nullif(p_header->>'source_warehouse_id','')::uuid,
    nullif(p_header->>'target_warehouse_id','')::uuid,
    p_header->>'transaction_type_code',
    nullif(p_header->>'supplier_reference',''),
    nullif(p_header->>'shipment_id','')::uuid,
    nullif(p_header->>'shipment_receipt_reference',''),
    nullif(p_header->>'project_id','')::uuid,
    nullif(p_header->>'worksite_id','')::uuid,
    nullif(p_header->>'delivered_by',''),
    nullif(p_header->>'received_by',''),
    nullif(p_header->>'recipient',''),
    nullif(p_header->>'receiving_department',''),
    nullif(p_header->>'note',''),
    p_actor_id
  ) returning id into v_document_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_number := v_line_number + 1;
    insert into public.inventory_document_lines (
      document_id, line_number, item_id, quantity, adjustment_quantity,
      uom_id, unit_price, expected_quantity, shipment_line_id,
      reference, purpose, note
    ) values (
      v_document_id, v_line_number, (v_line->>'item_id')::uuid,
      (v_line->>'quantity')::numeric,
      nullif(v_line->>'adjustment_quantity','')::numeric,
      (v_line->>'uom_id')::uuid,
      nullif(v_line->>'unit_price','')::numeric,
      nullif(v_line->>'expected_quantity','')::numeric,
      nullif(v_line->>'shipment_line_id','')::uuid,
      nullif(v_line->>'reference',''),
      nullif(v_line->>'purpose',''),
      nullif(v_line->>'note','')
    );
  end loop;
  return v_document_id;
exception
  when unique_violation then
    if p_client_request_id is not null then
      select id into v_document_id
      from public.inventory_documents
      where client_request_id = p_client_request_id;
      if found then return v_document_id; end if;
    end if;
    raise;
end
$$;

-- Preserve shipment-line linkage when a draft shipment receipt is edited.
create or replace function public.save_inventory_document(
  p_document_id uuid,
  p_row_version integer,
  p_header jsonb,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.inventory_documents%rowtype;
  v_line jsonb;
  v_line_number integer := 0;
begin
  select * into v_doc from public.inventory_documents where id = p_document_id for update;
  if not found then raise exception using errcode='P0002',message='DOCUMENT_NOT_FOUND'; end if;
  if v_doc.status <> 'draft' then raise exception using errcode='P0001',message='DOCUMENT_IMMUTABLE'; end if;
  if v_doc.row_version <> p_row_version then raise exception using errcode='P0001',message='DOCUMENT_VERSION_CONFLICT'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode='P0001',message='DOCUMENT_HAS_NO_LINES';
  end if;

  update public.inventory_documents set
    document_date = (p_header->>'document_date')::date,
    source_warehouse_id = nullif(p_header->>'source_warehouse_id','')::uuid,
    target_warehouse_id = nullif(p_header->>'target_warehouse_id','')::uuid,
    transaction_type_code = p_header->>'transaction_type_code',
    supplier_reference = nullif(p_header->>'supplier_reference',''),
    project_id = nullif(p_header->>'project_id','')::uuid,
    worksite_id = nullif(p_header->>'worksite_id','')::uuid,
    delivered_by = nullif(p_header->>'delivered_by',''),
    received_by = nullif(p_header->>'received_by',''),
    recipient = nullif(p_header->>'recipient',''),
    receiving_department = nullif(p_header->>'receiving_department',''),
    note = nullif(p_header->>'note','')
  where id = p_document_id;

  delete from public.inventory_document_lines where document_id = p_document_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_number := v_line_number + 1;
    insert into public.inventory_document_lines (
      document_id, line_number, item_id, quantity, adjustment_quantity,
      uom_id, unit_price, expected_quantity, shipment_line_id,
      reference, purpose, note
    ) values (
      p_document_id, v_line_number, (v_line->>'item_id')::uuid,
      (v_line->>'quantity')::numeric,
      nullif(v_line->>'adjustment_quantity','')::numeric,
      (v_line->>'uom_id')::uuid,
      nullif(v_line->>'unit_price','')::numeric,
      nullif(v_line->>'expected_quantity','')::numeric,
      nullif(v_line->>'shipment_line_id','')::uuid,
      nullif(v_line->>'reference',''),
      nullif(v_line->>'purpose',''),
      nullif(v_line->>'note','')
    );
  end loop;
  return p_document_id;
end
$$;

revoke all on function public.create_inventory_document(text,uuid,public.inventory_document_type,jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.save_inventory_document(uuid,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_inventory_document(text,uuid,public.inventory_document_type,jsonb,jsonb,uuid) to service_role;
grant execute on function public.save_inventory_document(uuid,integer,jsonb,jsonb) to service_role;
