-- Atomic aggregate creation for import contracts and shipments.
create or replace function public.create_import_contract_command(
  p_client_request_id uuid,
  p_number text,
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
  v_contract_id uuid;
  v_line jsonb;
  v_line_number integer := 0;
begin
  select id into v_contract_id from public.import_contracts where client_request_id = p_client_request_id;
  if found then return v_contract_id; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode='P0001',message='CONTRACT_HAS_NO_LINES';
  end if;

  insert into public.import_contracts (
    client_request_id, contract_number, supplier_id, order_date, currency,
    incoterm, payment_term, expected_delivery_date, status, note, created_by
  ) values (
    p_client_request_id, p_number, (p_header->>'supplier_id')::uuid,
    (p_header->>'order_date')::date, p_header->>'currency',
    nullif(p_header->>'incoterm',''), nullif(p_header->>'payment_term',''),
    nullif(p_header->>'expected_delivery_date','')::date,
    (p_header->>'status')::public.import_contract_status,
    nullif(p_header->>'note',''), p_actor_id
  ) returning id into v_contract_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_number := v_line_number + 1;
    insert into public.import_contract_lines (
      contract_id, line_number, item_id, description_snapshot,
      ordered_quantity, uom_id, unit_price, currency,
      expected_delivery_date, note
    ) values (
      v_contract_id, v_line_number, (v_line->>'item_id')::uuid,
      v_line->>'description_snapshot', (v_line->>'ordered_quantity')::numeric,
      (v_line->>'uom_id')::uuid, nullif(v_line->>'unit_price','')::numeric,
      nullif(v_line->>'currency',''),
      nullif(v_line->>'expected_delivery_date','')::date,
      nullif(v_line->>'note','')
    );
  end loop;
  return v_contract_id;
exception
  when unique_violation then
    select id into v_contract_id from public.import_contracts where client_request_id = p_client_request_id;
    if found then return v_contract_id; end if;
    raise;
end
$$;

create or replace function public.create_shipment_command(
  p_client_request_id uuid,
  p_number text,
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
  v_shipment_id uuid;
  v_line jsonb;
  v_line_number integer := 0;
  v_status public.shipment_status;
begin
  select id into v_shipment_id from public.shipments where client_request_id = p_client_request_id;
  if found then return v_shipment_id; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception using errcode='P0001',message='SHIPMENT_HAS_NO_LINES';
  end if;
  v_status := (p_header->>'status')::public.shipment_status;

  insert into public.shipments (
    client_request_id, shipment_number, contract_id, supplier_id, carrier_id,
    forwarder_id, assigned_account_id, transport_mode, shipment_type,
    origin, destination, port_of_loading, port_of_discharge, booking_number,
    bill_of_lading_number, forwarder_reference, carrier_reference,
    planned_etd, current_etd, original_eta, current_eta,
    actual_departure, actual_arrival, status, incoterm_snapshot,
    currency, note, created_by
  ) values (
    p_client_request_id, p_number,
    nullif(p_header->>'contract_id','')::uuid,
    (p_header->>'supplier_id')::uuid,
    nullif(p_header->>'carrier_id','')::uuid,
    nullif(p_header->>'forwarder_id','')::uuid,
    nullif(p_header->>'assigned_account_id','')::uuid,
    p_header->>'transport_mode', p_header->>'shipment_type',
    nullif(p_header->>'origin',''), nullif(p_header->>'destination',''),
    nullif(p_header->>'port_of_loading',''), nullif(p_header->>'port_of_discharge',''),
    nullif(p_header->>'booking_number',''), nullif(p_header->>'bill_of_lading_number',''),
    nullif(p_header->>'forwarder_reference',''), nullif(p_header->>'carrier_reference',''),
    nullif(p_header->>'planned_etd','')::date, nullif(p_header->>'current_etd','')::date,
    nullif(p_header->>'original_eta','')::date, nullif(p_header->>'current_eta','')::date,
    nullif(p_header->>'actual_departure','')::date, nullif(p_header->>'actual_arrival','')::date,
    v_status, nullif(p_header->>'incoterm_snapshot',''),
    nullif(p_header->>'currency',''), nullif(p_header->>'note',''), p_actor_id
  ) returning id into v_shipment_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_line_number := v_line_number + 1;
    insert into public.shipment_lines (
      shipment_id, contract_line_id, line_number, item_id,
      item_code_snapshot, item_name_snapshot, specification_snapshot,
      expected_quantity, uom_id, package_count, gross_weight,
      net_weight, volume, marks_numbers, note
    ) values (
      v_shipment_id, nullif(v_line->>'contract_line_id','')::uuid,
      v_line_number, (v_line->>'item_id')::uuid,
      v_line->>'item_code_snapshot', v_line->>'item_name_snapshot',
      nullif(v_line->>'specification_snapshot',''),
      (v_line->>'expected_quantity')::numeric, (v_line->>'uom_id')::uuid,
      nullif(v_line->>'package_count','')::integer,
      nullif(v_line->>'gross_weight','')::numeric,
      nullif(v_line->>'net_weight','')::numeric,
      nullif(v_line->>'volume','')::numeric,
      nullif(v_line->>'marks_numbers',''), nullif(v_line->>'note','')
    );
  end loop;
  insert into public.shipment_customs (shipment_id) values (v_shipment_id);
  insert into public.shipment_status_history (shipment_id, new_status, changed_by)
  values (v_shipment_id, v_status, p_actor_id);
  return v_shipment_id;
exception
  when unique_violation then
    select id into v_shipment_id from public.shipments where client_request_id = p_client_request_id;
    if found then return v_shipment_id; end if;
    raise;
end
$$;

-- Serialize posting per shipment and enforce the configured over-receipt tolerance
-- at the authoritative warehouse status transition, not only in the UI/service precheck.
create or replace function public.enforce_shipment_receipt_posting_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tolerance numeric;
begin
  if new.status = 'posted'
    and old.status is distinct from new.status
    and new.type = 'receipt'
    and new.shipment_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('shipment:' || new.shipment_id::text, 0));
    select over_receipt_tolerance_percent into v_tolerance
    from public.import_export_settings where singleton = true;

    if exists (
      select 1
      from public.inventory_document_lines current_line
      left join public.shipment_lines shipment_line
        on shipment_line.id = current_line.shipment_line_id
      where current_line.document_id = new.id
        and (
          shipment_line.id is null
          or shipment_line.shipment_id <> new.shipment_id
          or shipment_line.item_id <> current_line.item_id
          or shipment_line.uom_id <> current_line.uom_id
        )
    ) then
      raise exception using errcode='P0001',message='INVALID_SHIPMENT_RECEIPT_LINE';
    end if;

    if exists (
      select 1
      from public.inventory_document_lines current_line
      join public.shipment_lines shipment_line on shipment_line.id = current_line.shipment_line_id
      where current_line.document_id = new.id
        and current_line.quantity + coalesce((
          select sum(previous_line.quantity)
          from public.inventory_document_lines previous_line
          join public.inventory_documents previous_document on previous_document.id = previous_line.document_id
          where previous_line.shipment_line_id = current_line.shipment_line_id
            and previous_document.type = 'receipt'
            and previous_document.status = 'posted'
            and previous_document.id <> new.id
        ), 0) > shipment_line.expected_quantity * (1 + coalesce(v_tolerance, 0) / 100)
    ) then
      raise exception using errcode='P0001',message='OVER_RECEIPT_LIMIT';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists inventory_document_shipment_receipt_limit on public.inventory_documents;
create trigger inventory_document_shipment_receipt_limit
before update of status on public.inventory_documents
for each row execute function public.enforce_shipment_receipt_posting_limit();

revoke all on function public.create_import_contract_command(uuid,text,jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.create_shipment_command(uuid,text,jsonb,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.enforce_shipment_receipt_posting_limit() from public;
grant execute on function public.create_import_contract_command(uuid,text,jsonb,jsonb,uuid) to service_role;
grant execute on function public.create_shipment_command(uuid,text,jsonb,jsonb,uuid) to service_role;
