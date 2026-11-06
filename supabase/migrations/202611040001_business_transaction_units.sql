-- Quantities/prices used by stock and finance remain in the item's base unit.
-- Entry values and the effective conversion are saved with the transaction.
-- Vietnamese casing must also work in the local C-locale PostgreSQL cluster.
-- NFC gives canonically equivalent unit labels the same identity.
create function public.business_unit_key(p_unit text) returns text language sql immutable strict set search_path='' as $$
 select lower(translate(normalize(btrim(p_unit),NFC),'ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ','àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ'))
$$;
revoke all on function public.business_unit_key(text) from public,anon,authenticated,service_role;
do $$declare body text;signature text;begin
 foreach signature in array array['public.business_item_unit_conversion_guard()','public.business_item_quantity_conversion(text,text,uuid,text,numeric,date)'] loop
  select pg_get_functiondef(signature::regprocedure) into body;
  if strpos(body,'lower(')=0 then raise exception 'Review unit identity normalization';end if;
  execute replace(body,'lower(','public.business_unit_key(');
 end loop;
 if exists(select 1 from public.business_item_unit_conversions a join public.business_item_unit_conversions b on a.tenant_id=b.tenant_id and a.item_id=b.item_id and a.id<b.id and a.status='active' and b.status='active' and public.business_unit_key(a.alternate_unit)=public.business_unit_key(b.alternate_unit) and daterange(a.effective_from,a.effective_to,'[]')&&daterange(b.effective_from,b.effective_to,'[]')) then raise exception 'BUSINESS_UOM_OVERLAP';end if;
end $$;
do $$<<unit_migration>> declare kind text;price_field text;triggers jsonb;t record;begin
 foreach kind in array array['stock_moves','purchase_receipts','purchase_lines','sales_lines'] loop
  price_field:=case when kind in ('purchase_lines','sales_lines') then 'unit_price' else 'unit_cost' end;
  execute format('alter table public.%I add column entry_unit text,add column entry_quantity numeric,add column entry_price numeric,add column base_unit text,add column unit_factor numeric,add column unit_effective_on date,add column unit_conversion_id uuid,add column unit_conversion_version integer,alter column %I type numeric',public.business_entity_table(kind),price_field);
  -- Backfill only the new columns under the migration's table lock. Preserve all
  -- document quantities, prices, statuses, versions, approvals and trigger states.
  select coalesce(jsonb_agg(jsonb_build_object('name',tgname,'mode',tgenabled)),'[]') into triggers from pg_trigger where tgrelid=to_regclass('public.'||public.business_entity_table(kind)) and not tgisinternal and tgenabled<>'D';
  execute format('alter table public.%I disable trigger user',public.business_entity_table(kind));
  execute format('update public.%I x set entry_unit=i.unit,entry_quantity=x.quantity,entry_price=x.%I,base_unit=i.unit,unit_factor=1,unit_effective_on=%s from public.business_items i where i.tenant_id=x.tenant_id and i.id=x.item_id',public.business_entity_table(kind),price_field,
   case kind when 'purchase_lines' then '(select order_date from public.business_purchase_orders p where p.tenant_id=x.tenant_id and p.id=x.purchase_order_id)' when 'sales_lines' then '(select order_date from public.business_sales_orders p where p.tenant_id=x.tenant_id and p.id=x.sales_order_id)' else 'x.document_date' end);
  for t in select * from jsonb_to_recordset(triggers) as x(name text,mode text) loop
   execute format('alter table public.%I enable %strigger %I',public.business_entity_table(kind),case t.mode when 'A' then 'always ' when 'R' then 'replica ' else '' end,t.name);
  end loop;
  execute format('alter table public.%I add constraint transaction_unit_snapshot_valid check(entry_unit is not null and char_length(btrim(entry_unit)) between 1 and 30 and entry_quantity is not null and entry_quantity>0 and entry_quantity<=1000000000000000 and entry_price is not null and entry_price>=0 and entry_price<=1000000000000000 and base_unit is not null and char_length(btrim(base_unit)) between 1 and 30 and unit_factor is not null and unit_factor>0 and unit_factor<=1000000000000 and unit_effective_on is not null and ((unit_conversion_id is null and unit_conversion_version is null and unit_factor=1) or (unit_conversion_id is not null and unit_conversion_version is not null and unit_conversion_version>0))),add foreign key(tenant_id,unit_conversion_id) references public.business_item_unit_conversions(tenant_id,id)',public.business_entity_table(kind));
  update public.business_entity_definitions set definition=jsonb_set(jsonb_set(definition,'{fields,quantity,label}','"Số lượng cơ sở"'),array['fields',price_field,'label'],'"Đơn giá cơ sở"')||jsonb_build_object('quantityEntry',jsonb_build_object('priceField',price_field)||case when unit_migration.kind in ('stock_moves','purchase_receipts') then '{"dateField":"document_date"}'::jsonb else '{}'::jsonb end) where business_entity_definitions.kind=unit_migration.kind;
  update public.business_entity_definitions set definition=jsonb_set(definition,'{fields}',definition->'fields'||'{"entry_unit":{"label":"Đơn vị nhập","type":"text","max":30,"uiHidden":true},"entry_quantity":{"label":"Số lượng nhập","type":"number","min":0.0001,"max":1000000000000000,"uiHidden":true},"entry_price":{"label":"Đơn giá theo đơn vị nhập","type":"number","min":0,"max":1000000000000000,"uiHidden":true},"base_unit":{"label":"Đơn vị cơ sở","type":"text","computed":true},"unit_factor":{"label":"Hệ số quy đổi","type":"number","computed":true,"uiHidden":true},"unit_effective_on":{"label":"Ngày quy đổi","type":"date","computed":true,"uiHidden":true}}'::jsonb) where business_entity_definitions.kind=unit_migration.kind;
 end loop;
end $$;

create function public.business_transaction_quantity(p_tenant uuid,p_kind text,p_data jsonb,p_old jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare item public.business_items%rowtype;c public.business_item_unit_conversions%rowtype;d jsonb;on_date date;unit text;qty numeric;price numeric;factor numeric;conversion uuid;version integer;result jsonb;parent jsonb;price_field text;
begin
 select definition into d from public.business_entity_definitions where kind=p_kind;
 if not(d ? 'quantityEntry') then raise exception 'BUSINESS_INVALID_INPUT';end if;
 price_field:=d->'quantityEntry'->>'priceField';
 select * into item from public.business_items where tenant_id=p_tenant and id=(p_data->>'item_id')::uuid for share;
 if item.id is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if d->'quantityEntry' ? 'dateField' then on_date:=(p_data->>(d->'quantityEntry'->>'dateField'))::date;
 else
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using p_tenant,(p_data->>(d->>'parentField'))::uuid;
  if parent is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;on_date:=(parent->>'order_date')::date;
 end if;
 if on_date is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 unit:=coalesce(nullif(btrim(p_data->>'entry_unit'),''),btrim(item.unit));
 qty:=coalesce((p_data->>'entry_quantity')::numeric,(p_data->>'quantity')::numeric);
 price:=coalesce((p_data->>'entry_price')::numeric,(p_data->>price_field)::numeric,0);
 if qty is null or qty<0.0001 or qty>1000000000000000 or price is null or price<0 or price>1000000000000000 or char_length(unit)>30 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if (p_old->>'item_id')::uuid=(p_data->>'item_id')::uuid and public.business_unit_key(unit)=public.business_unit_key(p_old->>'entry_unit') and on_date=(p_old->>'unit_effective_on')::date and p_old->>'unit_factor' is not null then
  factor:=(p_old->>'unit_factor')::numeric;conversion:=(p_old->>'unit_conversion_id')::uuid;version:=(p_old->>'unit_conversion_version')::integer;unit:=p_old->>'entry_unit';
 elsif public.business_unit_key(unit)=public.business_unit_key(item.unit) then factor:=1;unit:=item.unit;
 else
  select * into c from public.business_item_unit_conversions where tenant_id=p_tenant and item_id=item.id and status='active' and public.business_unit_key(alternate_unit)=public.business_unit_key(unit) and effective_from<=on_date and (effective_to is null or effective_to>=on_date) for share;
  if c.id is null then raise exception 'BUSINESS_UOM_NOT_FOUND';end if;
  factor:=c.factor;conversion:=c.id;version:=c.row_version;unit:=c.alternate_unit;
 end if;
 if round(qty*factor,4)<0.0001 or round(qty*factor,4)>1000000000000000 or price/factor>1000000000000000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if round(qty,4)<>qty then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if item.tracking='serial' and qty*factor<>trunc(qty*factor) then raise exception 'BUSINESS_UOM_SERIAL_QUANTITY';end if;
 result:=jsonb_build_object('entry_unit',unit,'entry_quantity',qty,'entry_price',price,'base_unit',item.unit,'unit_factor',factor,'unit_effective_on',on_date,'unit_conversion_id',conversion,'unit_conversion_version',version,'quantity',round(qty*factor,4),price_field,price/factor);
 return result;
end $$;

create function public.business_transaction_quantity_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v jsonb:=to_jsonb(new);previous jsonb;normalized jsonb;d jsonb;keys text[];parent_date date;snapshots text[]:=array['entry_unit','entry_quantity','entry_price','base_unit','unit_factor','unit_effective_on','unit_conversion_id','unit_conversion_version'];begin
 if tg_op='UPDATE' then
  previous:=to_jsonb(old);select definition into d from public.business_entity_definitions where kind=TG_ARGV[0];
  keys:=array['item_id','quantity',d->'quantityEntry'->>'priceField','entry_unit','entry_quantity','entry_price',coalesce(d->'quantityEntry'->>'dateField',d->>'parentField')];
  if d->>'parentKind' is not null then execute format('select order_date from public.%I where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent_date using new.tenant_id,(v->>(d->>'parentField'))::uuid;end if;
  if (d->>'parentKind' is null or parent_date=(previous->>'unit_effective_on')::date) and (select jsonb_object_agg(k,v->k) from unnest(keys) k)=(select jsonb_object_agg(k,previous->k) from unnest(keys) k) then
   new:=jsonb_populate_record(new,(select jsonb_object_agg(k,previous->k) from unnest(snapshots) k));return new;
  end if;
 end if;
 normalized:=public.business_transaction_quantity(new.tenant_id,TG_ARGV[0],v,previous);
 new:=jsonb_populate_record(new,normalized);return new;
end $$;
do $$declare kind text;begin
 foreach kind in array array['stock_moves','purchase_receipts','purchase_lines','sales_lines'] loop
  execute format('create trigger business_transaction_quantity_guard before insert or update on public.%I for each row execute function public.business_transaction_quantity_guard(%L)',public.business_entity_table(kind),kind);
 end loop;
end $$;

create function public.business_order_unit_date_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare used boolean;begin
 if new.order_date=old.order_date then return new;end if;
 execute format('select exists(select 1 from public.%I where tenant_id=$1 and %I=$2 and status=''active'')',TG_ARGV[0],TG_ARGV[1]) into used using old.tenant_id,old.id;
 if used then raise exception 'BUSINESS_UOM_DOCUMENT_DATE_LOCKED';end if;return new;
end $$;
create trigger business_order_unit_date_guard before update of order_date on public.business_purchase_orders for each row execute function public.business_order_unit_date_guard('business_purchase_lines','purchase_order_id');
create trigger business_order_unit_date_guard before update of order_date on public.business_sales_orders for each row execute function public.business_order_unit_date_guard('business_sales_lines','sales_order_id');

alter function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) rename to business_save_record_before_transaction_units;
revoke all on function public.business_save_record_before_transaction_units(text,text,text,uuid,integer,jsonb,uuid,text) from public,anon,authenticated,service_role;
create function public.business_save_record(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;previous jsonb;item jsonb;parent jsonb;normalized jsonb;r jsonb;conversion jsonb;k text;begin
 if p_kind not in ('stock_moves','purchase_receipts','purchase_lines','sales_lines') then return public.business_save_record_before_transaction_units(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data,p_request_id,p_payload_hash);end if;
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if p_id is null or p_expected_version is null or p_expected_version<0 or coalesce(jsonb_typeof(p_data),'')<>'object' or not(p_data ?& array['code','name','notes']) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for k in select jsonb_object_keys(p_data) loop
  if k not in ('code','name','notes') and (not(d->'fields' ? k) or coalesce((d->'fields'->k->>'computed')::boolean,false)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 end loop;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into previous using a.tenant_id,p_id;
 if previous is null then perform public.business_assert_access(a.id,p_kind,'create',p_data||jsonb_build_object('id',p_id,'tenant_id',a.tenant_id,'created_by',a.id));
 else perform public.business_assert_access(a.id,p_kind,'update',previous);end if;
 -- A child write requires access to both the destination and previous header.
 -- Preserve that authorization boundary before revealing CAS/state failures.
 if d->>'parentKind' is not null then
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using a.tenant_id,(p_data->>(d->>'parentField'))::uuid;
  if parent is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;perform public.business_assert_access(a.id,d->>'parentKind','update',parent);
  if previous->>(d->>'parentField') is not null and (previous->>(d->>'parentField'))::uuid is distinct from (p_data->>(d->>'parentField'))::uuid then
   execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(d->>'parentKind')) into parent using a.tenant_id,(previous->>(d->>'parentField'))::uuid;
   if parent is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;perform public.business_assert_access(a.id,d->>'parentKind','update',parent);
  end if;
 end if;
 if p_expected_version=0 and previous is not null then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_expected_version>0 and previous is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 if previous is not null and (previous->>'row_version')::integer<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if previous is not null and previous->>'status' not in ('active','inactive','draft') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 select to_jsonb(x) into item from public.business_items x where tenant_id=a.tenant_id and id=(p_data->>'item_id')::uuid;
 if item is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;perform public.business_assert_kind(a.tenant_id,'items');perform public.business_assert_access(a.id,'items','read',item);
 normalized:=public.business_transaction_quantity(a.tenant_id,p_kind,p_data,previous);
 if normalized->>'unit_conversion_id' is not null and (previous->>'unit_conversion_id' is distinct from normalized->>'unit_conversion_id' or previous->>'unit_conversion_version' is distinct from normalized->>'unit_conversion_version') then
  perform public.business_assert_kind(a.tenant_id,'item_unit_conversions');select to_jsonb(x) into conversion from public.business_item_unit_conversions x where tenant_id=a.tenant_id and id=(normalized->>'unit_conversion_id')::uuid;
  perform public.business_assert_access(a.id,'item_unit_conversions','read',conversion);
 end if;
 return public.business_save_record_before_transaction_units(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data||(normalized-array['base_unit','unit_factor','unit_effective_on','unit_conversion_id','unit_conversion_version']),p_request_id,p_payload_hash);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then raise exception 'BUSINESS_INVALID_INPUT';
end $$;

create function public.business_item_unit_options(p_hash text,p_slug text,p_item_id uuid,p_on date) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a public.business_accounts%rowtype;item public.business_items%rowtype;options jsonb;begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,'items');perform public.business_assert_kind(a.tenant_id,'item_unit_conversions');
 if p_item_id is null or p_on is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into item from public.business_items where tenant_id=a.tenant_id and id=p_item_id and status='active';if item.id is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,'items','read',to_jsonb(item));
 select coalesce(jsonb_agg(jsonb_build_object('unit',x.alternate_unit,'factor',x.factor) order by x.alternate_unit),'[]') into options from (select * from public.business_item_unit_conversions c where tenant_id=a.tenant_id and item_id=item.id and status='active' and effective_from<=p_on and (effective_to is null or effective_to>=p_on) and public.business_access_allowed(a.id,'item_unit_conversions','read',to_jsonb(c)) order by alternate_unit limit 201) x;
 if jsonb_array_length(options)>200 then raise exception 'BUSINESS_UOM_OPTIONS_LIMIT';end if;
 return jsonb_build_object('baseUnit',item.unit,'effectiveOn',p_on,'options',jsonb_build_array(jsonb_build_object('unit',item.unit,'factor',1))||options);
end $$;
revoke all on function public.business_transaction_quantity(uuid,text,jsonb,jsonb),public.business_transaction_quantity_guard(),public.business_order_unit_date_guard(),public.business_item_unit_options(text,text,uuid,date),public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_item_unit_options(text,text,uuid,date),public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) to service_role;
notify pgrst,'reload schema';
