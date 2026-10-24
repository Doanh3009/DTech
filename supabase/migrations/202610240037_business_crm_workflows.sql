create function public.business_crm_source(p_tenant uuid,p_kind text,p_id uuid,p_status text default 'active') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 and status=$3',public.business_entity_table(p_kind)) into r using p_tenant,p_id,p_status;
 if r is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;return r;
end $$;
revoke all on function public.business_crm_source(uuid,text,uuid,text) from public,anon,authenticated,service_role;

create function public.business_crm_validate(p_tenant uuid,p_kind text,p_id uuid,v jsonb,old jsonb) returns void language plpgsql security definer set search_path='' as $$
declare d jsonb;k text;parent_kind text;parent_field text;parent uuid;previous uuid;source jsonb;
begin
 select definition into d from public.business_entity_definitions where kind=p_kind;if not(d ? 'crmDomain') then return;end if;
 for k in select key from jsonb_each(d->'fields') where key in ('owner_staff_id','responder_id') loop perform public.business_crm_source(p_tenant,'staff',(v->>k)::uuid);end loop;
 if v->>'partner_id' is not null then source:=public.business_crm_source(p_tenant,'partners',(v->>'partner_id')::uuid);if source->>'partner_type' not in ('customer','both') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;end if;
 parent_kind:=d->>'parentKind';parent_field:=d->>'parentField';
 if parent_kind is not null and not coalesce((d->>'generatedOnly')::boolean,false) then
  parent:=(v->>parent_field)::uuid;previous:=(old->>parent_field)::uuid;
  source:=public.business_crm_source(p_tenant,parent_kind,parent,'draft');
  if previous is not null then perform public.business_crm_source(p_tenant,parent_kind,previous,'draft');end if;
  execute format('update public.%I set reviewed_by=null,calculation_snapshot=null,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id in ($2,$3)',public.business_entity_table(parent_kind)) using p_tenant,parent,previous;
 end if;
 if p_kind='campaigns' and (v->>'starts_on')::date>(v->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';
 elsif p_kind='leads' then
  if nullif(regexp_replace(coalesce(v->>'phone',''),'[^0-9]','','g'),'') is null and nullif(btrim(v->>'email'),'') is null then raise exception 'BUSINESS_CONTACT_REQUIRED';end if;
  if old->>'stage'='converted' then for k in select jsonb_object_keys(v) loop if k<>'notes' and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;end if;
 elsif p_kind='opportunities' then
  if old->>'stage' in ('won','lost') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if exists(select 1 from public.business_customer_quotes where tenant_id=p_tenant and opportunity_id=p_id and status='posted') and v->>'partner_id' is distinct from old->>'partner_id' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 elsif p_kind='customer_quotes' then
  source:=public.business_crm_source(p_tenant,'opportunities',(v->>'opportunity_id')::uuid);
  if source->>'partner_id'<>v->>'partner_id' or source->>'stage' in ('won','lost') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if (v->>'valid_until')::date<(v->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if (v->>'revision')::integer=1 and v->>'previous_id' is not null or (v->>'revision')::integer>1 and v->>'previous_id' is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if v->>'previous_id' is not null then source:=public.business_crm_source(p_tenant,'customer_quotes',(v->>'previous_id')::uuid,'posted');if source->>'opportunity_id'<>v->>'opportunity_id' or source->>'partner_id'<>v->>'partner_id' or (source->>'revision')::integer+1<>(v->>'revision')::integer then raise exception 'BUSINESS_INVALID_REFERENCE';end if;end if;
 elsif p_kind='sales_contracts' then
  if (v->>'starts_on')::date>(v->>'ends_on')::date or (v->>'signed_on')::date>(v->>'starts_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 elsif p_kind='contract_order_releases' and (v->>'due_date')::date<(v->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';
 elsif p_kind='support_tickets' then
  if (v->>'opened_on')::date>(v->>'response_due_on')::date or (v->>'response_due_on')::date>(v->>'resolve_due_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if exists(select 1 from public.business_ticket_events where tenant_id=p_tenant and ticket_id=p_id and status='posted') then for k in select jsonb_object_keys(v) loop if k not in ('name','notes') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;end if;
 end if;
end $$;
revoke all on function public.business_crm_validate(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_contract_ordered(p_tenant uuid,p_line uuid) returns numeric language sql stable security definer set search_path='' as $$
 select coalesce(sum(l.quantity),0) from public.business_contract_order_lines l join public.business_contract_order_releases h on h.tenant_id=l.tenant_id and h.id=l.release_id and h.status='posted' where l.tenant_id=p_tenant and l.contract_line_id=p_line and l.status='active'
$$;
revoke all on function public.business_contract_ordered(uuid,uuid) from public,anon,authenticated,service_role;

create function public.business_crm_calculation(p_tenant uuid,p_kind text,v jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare source jsonb;parent jsonb;context jsonb:='{}';rows jsonb:='[]';x record;total numeric:=0;amount numeric;used numeric;date_on date:=(v->>'document_date')::date;next_stage text;
begin
 if date_on is null or date_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 case p_kind
 when 'lead_events','lead_conversions' then
  source:=public.business_crm_source(p_tenant,'leads',(v->>'lead_id')::uuid);
  if source->>'stage'='converted' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if exists(select 1 from public.business_lead_events where tenant_id=p_tenant and lead_id=(v->>'lead_id')::uuid and status='posted' and document_date>date_on) then raise exception 'BUSINESS_INVALID_DATE';end if;
  if p_kind='lead_conversions' then
   if source->>'stage'<>'qualified' or (v->>'expected_close_on')::date<date_on then raise exception 'BUSINESS_LEAD_NOT_QUALIFIED';end if;
   perform public.business_crm_source(p_tenant,'staff',(v->>'owner_staff_id')::uuid);
   if v->>'existing_partner_id' is not null then parent:=public.business_crm_source(p_tenant,'partners',(v->>'existing_partner_id')::uuid);if parent->>'partner_type' not in ('customer','both') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   elsif exists(select 1 from public.business_tenant_partners p where p.tenant_id=p_tenant and p.status='active' and (nullif(btrim(source->>'email'),'') is not null and lower(btrim(p.email))=lower(btrim(source->>'email')) or nullif(regexp_replace(coalesce(source->>'phone',''),'[^0-9]','','g'),'') is not null and regexp_replace(p.phone,'[^0-9]','','g')=regexp_replace(source->>'phone','[^0-9]','','g'))) then raise exception 'BUSINESS_CUSTOMER_EXISTS';end if;
   context:=context||jsonb_build_object('partnerVersion',parent->'row_version');
  elsif source->>'stage'=v->>'next_stage' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  context:=context||jsonb_build_object('sourceId',source->'id','sourceVersion',source->'row_version','previousStage',source->'stage');
  rows:=jsonb_build_array(jsonb_build_object('sourceName',source->'name','previousState',source->'stage','nextState',coalesce(v->>'next_stage','converted')));
 when 'opportunity_events' then
  source:=public.business_crm_source(p_tenant,'opportunities',(v->>'opportunity_id')::uuid);next_stage:=v->>'next_stage';
  if source->>'stage' in ('won','lost') or source->>'stage'=next_stage then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if exists(select 1 from public.business_opportunity_events where tenant_id=p_tenant and opportunity_id=(v->>'opportunity_id')::uuid and status='posted' and document_date>date_on) then raise exception 'BUSINESS_INVALID_DATE';end if;
  if next_stage='won' and not exists(select 1 from public.business_sales_contracts c join public.business_customer_quotes q on q.tenant_id=c.tenant_id and q.id=c.quote_id where c.tenant_id=p_tenant and c.status='posted' and q.opportunity_id=(v->>'opportunity_id')::uuid and c.signed_on<=date_on) then raise exception 'BUSINESS_CONTRACT_REQUIRED';end if;
  context:=jsonb_build_object('sourceVersion',source->'row_version','previousStage',source->'stage','previousProbability',source->'probability');rows:=jsonb_build_array(jsonb_build_object('sourceName',source->'name','previousState',source->'stage','nextState',next_stage));
 when 'customer_quotes' then
  source:=public.business_crm_source(p_tenant,'opportunities',(v->>'opportunity_id')::uuid);if source->>'stage' in ('won','lost') or source->>'partner_id'<>v->>'partner_id' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  for x in select l.*,i.name item_name,i.row_version item_version from public.business_customer_quote_lines l join public.business_items i on i.tenant_id=l.tenant_id and i.id=l.item_id and i.status='active' where l.tenant_id=p_tenant and l.quote_id=(v->>'id')::uuid and l.status='active' order by l.id loop
   amount:=round(x.quantity*round(x.unit_price*(1-x.discount_percent/100),4),4);total:=total+amount;
   rows:=rows||jsonb_build_array(jsonb_build_object('sourceId',x.id,'sourceVersion',x.row_version,'sourceName',x.item_name,'itemId',x.item_id,'itemVersion',x.item_version,'quantity',x.quantity,'unitCost',round(x.unit_price*(1-x.discount_percent/100),4),'amount',amount));
  end loop;
  if jsonb_array_length(rows)=0 or total<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  context:=jsonb_build_object('opportunityVersion',source->'row_version');
 when 'quote_decisions' then
  source:=public.business_crm_source(p_tenant,'customer_quotes',(v->>'quote_id')::uuid,'posted');
  if source->>'commercial_state'<>'prepared' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if date_on<(source->>'document_date')::date or date_on>(source->>'valid_until')::date then raise exception 'BUSINESS_QUOTE_EXPIRED';end if;
  context:=jsonb_build_object('sourceVersion',source->'row_version','previousState',source->'commercial_state');total:=(source->>'total_amount')::numeric;
  rows:=jsonb_build_array(jsonb_build_object('sourceName',source->'name','nextState',v->'decision','amount',total));
 when 'sales_contracts' then
  source:=public.business_crm_source(p_tenant,'customer_quotes',(v->>'quote_id')::uuid,'posted');
  if source->>'commercial_state'<>'accepted' or (v->>'signed_on')::date<(source->>'accepted_on')::date or (v->>'signed_on')::date>(source->>'valid_until')::date or (v->>'signed_on')::date>date_on then raise exception 'BUSINESS_QUOTE_EXPIRED';end if;
  if exists(select 1 from public.business_sales_contracts where tenant_id=p_tenant and quote_id=(v->>'quote_id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  rows:=source->'calculation_snapshot'->'rows';total:=(source->>'total_amount')::numeric;
  context:=jsonb_build_object('sourceVersion',source->'row_version','partnerId',source->'partner_id','opportunityId',source->'opportunity_id');
 when 'contract_amendments' then
  source:=public.business_crm_source(p_tenant,'sales_contract_lines',(v->>'contract_line_id')::uuid);parent:=public.business_crm_source(p_tenant,'sales_contracts',(source->>'contract_id')::uuid,'posted');
  used:=public.business_contract_ordered(p_tenant,(source->>'id')::uuid);
  if date_on<(parent->>'signed_on')::date or (v->>'new_quantity')::numeric<used then raise exception 'BUSINESS_CONTRACT_EXCEEDED';end if;
  if used>0 and (v->>'new_unit_price')::numeric<>(source->>'unit_price')::numeric then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if exists(select 1 from public.business_contract_amendments where tenant_id=p_tenant and contract_line_id=(source->>'id')::uuid and status='posted' and document_date>date_on) then raise exception 'BUSINESS_INVALID_DATE';end if;
  context:=jsonb_build_object('sourceVersion',source->'row_version','contractId',source->'contract_id','oldQuantity',source->'quantity','oldUnitPrice',source->'unit_price','used',used);
  total:=round((v->>'new_quantity')::numeric*(v->>'new_unit_price')::numeric-(source->>'quantity')::numeric*(source->>'unit_price')::numeric,4);
  rows:=jsonb_build_array(jsonb_build_object('sourceName',source->'name','previousQuantity',source->'quantity','quantity',v->'new_quantity','unitCost',v->'new_unit_price','amount',total));
 when 'contract_order_releases' then
  source:=public.business_crm_source(p_tenant,'sales_contracts',(v->>'contract_id')::uuid,'posted');
  if date_on not between (source->>'starts_on')::date and (source->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  for x in select l.*,c.contract_id,c.item_id,c.quantity contract_quantity,c.unit_price,c.row_version source_version,i.name item_name from public.business_contract_order_lines l join public.business_sales_contract_lines c on c.tenant_id=l.tenant_id and c.id=l.contract_line_id and c.status='active' join public.business_items i on i.tenant_id=c.tenant_id and i.id=c.item_id and i.status='active' where l.tenant_id=p_tenant and l.release_id=(v->>'id')::uuid and l.status='active' order by l.id loop
   used:=public.business_contract_ordered(p_tenant,x.contract_line_id);if x.contract_id<>(v->>'contract_id')::uuid or x.quantity+used>x.contract_quantity then raise exception 'BUSINESS_CONTRACT_EXCEEDED';end if;
   amount:=round(x.quantity*x.unit_price,4);total:=total+amount;
   rows:=rows||jsonb_build_array(jsonb_build_object('sourceId',x.id,'sourceName',x.item_name,'contractLineId',x.contract_line_id,'sourceVersion',x.source_version,'itemId',x.item_id,'quantity',x.quantity,'unitCost',x.unit_price,'remaining',x.contract_quantity-used,'amount',amount));
  end loop;
  if jsonb_array_length(rows)=0 or total<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  context:=jsonb_build_object('sourceVersion',source->'row_version','partnerId',source->'partner_id');
 when 'ticket_events' then
  source:=public.business_crm_source(p_tenant,'support_tickets',(v->>'ticket_id')::uuid);perform public.business_crm_source(p_tenant,'staff',(v->>'responder_id')::uuid);
  if date_on<(source->>'opened_on')::date or exists(select 1 from public.business_ticket_events where tenant_id=p_tenant and ticket_id=(v->>'ticket_id')::uuid and status='posted' and document_date>date_on) then raise exception 'BUSINESS_INVALID_DATE';end if;
  if source->>'stage'='closed' and v->>'event_type'<>'reopen' or v->>'event_type'='close' and source->>'stage'<>'resolved' or v->>'event_type'='reopen' and source->>'stage' not in ('closed','resolved') or source->>'stage'='resolved' and v->>'event_type' not in ('close','reopen','respond') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if v->>'event_type'='escalate' and date_on<=(source->>'resolve_due_on')::date and (source->>'first_response_on' is not null or date_on<=(source->>'response_due_on')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
  context:=jsonb_build_object('sourceVersion',source->'row_version','previousStage',source->'stage','previousOwner',source->'owner_staff_id','previousResponse',source->'first_response_on','previousResolved',source->'resolved_on','previousClosed',source->'closed_on','previousEscalated',source->'escalated');
  rows:=jsonb_build_array(jsonb_build_object('sourceName',source->'name','previousState',source->'stage','nextState',v->'event_type'));
 else raise exception 'BUSINESS_INVALID_INPUT';end case;
 return jsonb_build_object('rows',rows,'context',context)||case when p_kind in ('customer_quotes','quote_decisions','sales_contracts','contract_amendments','contract_order_releases') then jsonb_build_object('total',total) else '{}'::jsonb end;
end $$;
revoke all on function public.business_crm_calculation(uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.business_crm_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare source jsonb;context jsonb:=v->'calculation_snapshot'->'context';x jsonb;partner uuid;opportunity uuid;order_id uuid;line_id uuid;state text;parent uuid;
begin
 if p_action='reverse' then
  case p_kind
  when 'lead_events' then
   if exists(select 1 from public.business_lead_events where tenant_id=p_tenant and lead_id=(v->>'lead_id')::uuid and status='posted' and id<>(v->>'id')::uuid and sequence_no>(v->>'sequence_no')::bigint) or exists(select 1 from public.business_lead_conversions where tenant_id=p_tenant and lead_id=(v->>'lead_id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_leads set stage=context->>'previousStage',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'lead_id')::uuid;
  when 'lead_conversions' then
   if exists(select 1 from public.business_customer_quotes where tenant_id=p_tenant and opportunity_id=(v->>'opportunity_id')::uuid and status<>'cancelled') or exists(select 1 from public.business_opportunity_events where tenant_id=p_tenant and opportunity_id=(v->>'opportunity_id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_opportunities set status='inactive',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'opportunity_id')::uuid;
   update public.business_leads set stage='qualified',partner_id=null,opportunity_id=null,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'lead_id')::uuid;
  when 'opportunity_events' then
   if exists(select 1 from public.business_opportunity_events where tenant_id=p_tenant and opportunity_id=(v->>'opportunity_id')::uuid and status='posted' and sequence_no>(v->>'sequence_no')::bigint) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_opportunities set stage=context->>'previousStage',probability=(context->>'previousProbability')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'opportunity_id')::uuid;
  when 'customer_quotes' then
   if exists(select 1 from public.business_quote_decisions where tenant_id=p_tenant and quote_id=(v->>'id')::uuid and status='posted') or exists(select 1 from public.business_customer_quotes where tenant_id=p_tenant and previous_id=(v->>'id')::uuid and status<>'cancelled') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'quote_decisions' then
   if exists(select 1 from public.business_sales_contracts where tenant_id=p_tenant and quote_id=(v->>'quote_id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_customer_quotes set commercial_state='prepared',accepted_on=null,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'quote_id')::uuid;
  when 'sales_contracts' then
   if exists(select 1 from public.business_contract_order_releases where tenant_id=p_tenant and contract_id=(v->>'id')::uuid and status='posted') or exists(select 1 from public.business_contract_amendments a join public.business_sales_contract_lines l on l.tenant_id=a.tenant_id and l.id=a.contract_line_id where a.tenant_id=p_tenant and l.contract_id=(v->>'id')::uuid and a.status='posted') or exists(select 1 from public.business_opportunity_events where tenant_id=p_tenant and opportunity_id=(context->>'opportunityId')::uuid and status='posted' and next_stage='won') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_sales_contract_lines set status='inactive',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and contract_id=(v->>'id')::uuid;
  when 'contract_amendments' then
   if public.business_contract_ordered(p_tenant,(v->>'contract_line_id')::uuid)>(context->>'used')::numeric and (v->>'new_unit_price')::numeric<>(context->>'oldUnitPrice')::numeric then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if exists(select 1 from public.business_contract_amendments where tenant_id=p_tenant and contract_line_id=(v->>'contract_line_id')::uuid and status='posted' and sequence_no>(v->>'sequence_no')::bigint) or public.business_contract_ordered(p_tenant,(v->>'contract_line_id')::uuid)>(context->>'oldQuantity')::numeric then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_sales_contract_lines set quantity=(context->>'oldQuantity')::numeric,unit_price=(context->>'oldUnitPrice')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'contract_line_id')::uuid;
   parent:=(context->>'contractId')::uuid;
  when 'contract_order_releases' then
   if exists(select 1 from public.business_stock_moves where tenant_id=p_tenant and sales_order_id=(v->>'sales_order_id')::uuid and status='posted') or exists(select 1 from public.business_sales_invoices where tenant_id=p_tenant and sales_order_id=(v->>'sales_order_id')::uuid and status='posted') or exists(select 1 from public.business_receivables where tenant_id=p_tenant and sales_order_id=(v->>'sales_order_id')::uuid and status<>'cancelled') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_sales_orders set status='cancelled',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'sales_order_id')::uuid and status='released';if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  when 'ticket_events' then
   if exists(select 1 from public.business_ticket_events where tenant_id=p_tenant and ticket_id=(v->>'ticket_id')::uuid and status='posted' and sequence_no>(v->>'sequence_no')::bigint) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_support_tickets set stage=context->>'previousStage',owner_staff_id=(context->>'previousOwner')::uuid,first_response_on=(context->>'previousResponse')::date,resolved_on=(context->>'previousResolved')::date,closed_on=(context->>'previousClosed')::date,escalated=context->>'previousEscalated',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'ticket_id')::uuid;
  else raise exception 'BUSINESS_INVALID_INPUT';end case;
 else
  case p_kind
  when 'lead_events' then update public.business_leads set stage=v->>'next_stage',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'lead_id')::uuid;
  when 'lead_conversions' then
   perform public.business_assert_access(p_actor,'opportunities','create');
   source:=public.business_crm_source(p_tenant,'leads',(v->>'lead_id')::uuid);partner:=(v->>'existing_partner_id')::uuid;
   if partner is null then
    perform public.business_assert_access(p_actor,'partners','create');partner:=gen_random_uuid();
    insert into public.business_tenant_partners(id,tenant_id,created_by,code,name,partner_type,phone,email) values(partner,p_tenant,p_actor,'KH-'||(v->>'id'),source->>'name','customer',source->>'phone',source->>'email');
   end if;
   opportunity:=gen_random_uuid();
   insert into public.business_opportunities(id,tenant_id,created_by,code,name,partner_id,owner_staff_id,expected_amount,probability,expected_close_on,stage) values(opportunity,p_tenant,p_actor,'CH-'||(v->>'id'),source->>'name',partner,(v->>'owner_staff_id')::uuid,(v->>'expected_amount')::numeric,(v->>'probability')::numeric,(v->>'expected_close_on')::date,'qualified');
   update public.business_leads set stage='converted',partner_id=partner,opportunity_id=opportunity,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'lead_id')::uuid;
   update public.business_lead_conversions set partner_id=partner,opportunity_id=opportunity where tenant_id=p_tenant and id=(v->>'id')::uuid;
   insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(p_tenant,p_actor,'crm.converted','leads',(v->>'lead_id')::uuid,jsonb_build_object('partnerId',partner,'opportunityId',opportunity,'conversionId',v->>'id'));
  when 'opportunity_events' then update public.business_opportunities set stage=v->>'next_stage',probability=case v->>'next_stage' when 'won' then 100 when 'lost' then 0 else probability end,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'opportunity_id')::uuid;
  when 'customer_quotes' then null;
  when 'quote_decisions' then update public.business_customer_quotes set commercial_state=v->>'decision',accepted_on=case when v->>'decision'='accepted' then (v->>'document_date')::date else null end,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'quote_id')::uuid;
  when 'sales_contracts' then
   for x in select value from jsonb_array_elements(v->'calculation_snapshot'->'rows') loop
    insert into public.business_sales_contract_lines(tenant_id,created_by,code,name,contract_id,quote_line_id,item_id,quantity,unit_price) values(p_tenant,p_actor,'HD-'||gen_random_uuid(),x->>'sourceName',(v->>'id')::uuid,(x->>'sourceId')::uuid,(x->>'itemId')::uuid,(x->>'quantity')::numeric,(x->>'unitCost')::numeric);
   end loop;
   update public.business_sales_contracts set partner_id=(context->>'partnerId')::uuid where tenant_id=p_tenant and id=(v->>'id')::uuid;
  when 'contract_amendments' then
   update public.business_sales_contract_lines set quantity=(v->>'new_quantity')::numeric,unit_price=(v->>'new_unit_price')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'contract_line_id')::uuid;parent:=(context->>'contractId')::uuid;
  when 'contract_order_releases' then
   perform public.business_assert_access(p_actor,'sales_orders','create');perform public.business_assert_access(p_actor,'sales_lines','create');order_id:=gen_random_uuid();
   insert into public.business_sales_orders(id,tenant_id,created_by,code,name,status,partner_id,order_date,due_date) values(order_id,p_tenant,p_actor,'DH-'||(v->>'id'),v->>'name','released',(context->>'partnerId')::uuid,(v->>'document_date')::date,(v->>'due_date')::date);
   for x in select value from jsonb_array_elements(v->'calculation_snapshot'->'rows') loop
    insert into public.business_sales_lines(tenant_id,created_by,code,name,sales_order_id,item_id,quantity,unit_price) values(p_tenant,p_actor,'CT-'||(x->>'sourceId'),x->>'sourceName',order_id,(x->>'itemId')::uuid,(x->>'quantity')::numeric,(x->>'unitCost')::numeric);
   end loop;
   update public.business_contract_order_releases set sales_order_id=order_id where tenant_id=p_tenant and id=(v->>'id')::uuid;
   insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(p_tenant,p_actor,'crm.order_generated','sales_orders',order_id,jsonb_build_object('releaseId',v->>'id','contractId',v->>'contract_id'));
  when 'ticket_events' then
   state:=case v->>'event_type' when 'assign' then 'assigned' when 'start' then 'working' when 'resolve' then 'resolved' when 'close' then 'closed' when 'reopen' then 'working' end;
   update public.business_support_tickets set stage=coalesce(state,stage),owner_staff_id=case when v->>'event_type' in ('assign','escalate') then (v->>'responder_id')::uuid else owner_staff_id end,
    first_response_on=case when v->>'event_type' in ('respond','resolve') then coalesce(first_response_on,(v->>'document_date')::date) else first_response_on end,
    resolved_on=case when v->>'event_type'='resolve' then (v->>'document_date')::date when v->>'event_type'='reopen' then null else resolved_on end,
    closed_on=case when v->>'event_type'='close' then (v->>'document_date')::date when v->>'event_type'='reopen' then null else closed_on end,
    escalated=case when v->>'event_type'='escalate' then 'yes' else escalated end,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(v->>'ticket_id')::uuid;
  else raise exception 'BUSINESS_INVALID_INPUT';end case;
 end if;
 if parent is not null then update public.business_sales_contracts set total_amount=(select coalesce(sum(quantity*unit_price),0) from public.business_sales_contract_lines where tenant_id=p_tenant and contract_id=parent and status='active'),row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=parent;end if;
 return '{}';
end $$;
revoke all on function public.business_crm_effect(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;

do $$ declare body text;begin
 select pg_get_functiondef('public.business_misa_validate_save(uuid,text,uuid,jsonb,jsonb)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n perform public.business_crm_validate(p_tenant,p_kind,p_id,v,old);\n');
 select pg_get_functiondef('public.business_misa_calculate(uuid,text,jsonb)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n if coalesce((select (definition->>''crmDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return public.business_crm_calculation(p_tenant,p_kind,v);end if;\n');
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n if coalesce((select (definition->>''crmDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return public.business_crm_effect(p_tenant,p_actor,p_kind,v,p_action);end if;\n');
 select pg_get_functiondef('public.business_misa_store_calculation(uuid,uuid,text,jsonb,jsonb)'::regprocedure) into body;
 execute replace(body,E'begin\n',E'begin\n if p_kind in (''customer_quotes'',''sales_contracts'',''contract_order_releases'') then execute format(''update public.%I set total_amount=$3 where tenant_id=$1 and id=$2'',public.business_entity_table(p_kind)) using p_tenant,(v->>''id'')::uuid,(c->>''total'')::numeric;return;elsif coalesce((select (definition->>''crmDomain'')::boolean from public.business_entity_definitions where kind=p_kind),false) then return;end if;\n');
end $$;
