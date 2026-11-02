insert into public.business_entity_definitions(kind,definition) values('item_unit_conversions',$definition${"label":"Quy đổi đơn vị vật tư","feature":"inventory","mode":"master","fields":{"item_id":{"label":"Vật tư","type":"ref","ref":"items","required":true},"alternate_unit":{"label":"Đơn vị quy đổi","type":"text","required":true,"max":30},"base_unit":{"label":"Đơn vị cơ sở","type":"text","computed":true},"factor":{"label":"Hệ số về đơn vị cơ sở","type":"number","required":true,"min":0.0001,"max":1000000000000},"effective_from":{"label":"Hiệu lực từ","type":"date","required":true},"effective_to":{"label":"Hiệu lực đến","type":"date"}}}$definition$::jsonb);

alter table public.business_items add constraint business_items_unit_not_blank check(char_length(btrim(unit)) between 1 and 30);

create table public.business_item_unit_conversions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 item_id uuid not null,alternate_unit text not null check(char_length(btrim(alternate_unit)) between 1 and 30),base_unit text not null check(char_length(btrim(base_unit)) between 1 and 30),
 factor numeric(20,8) not null check(factor>=0.0001 and factor<=1000000000000),effective_from date not null,effective_to date,
 check(effective_to is null or effective_to>=effective_from),unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,item_id) references public.business_items(tenant_id,id)
);
create unique index business_item_unit_conversions_code_idx on public.business_item_unit_conversions(tenant_id,lower(code));
create index business_item_unit_conversions_lookup_idx on public.business_item_unit_conversions(tenant_id,item_id,lower(alternate_unit),effective_from);
alter table public.business_item_unit_conversions enable row level security;
revoke all on public.business_item_unit_conversions from public,anon,authenticated,service_role;

create function public.business_item_unit_conversion_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare item public.business_items%rowtype;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 select * into item from public.business_items where tenant_id=new.tenant_id and id=new.item_id for update;
 if item.id is null or item.status<>'active' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 new.alternate_unit:=btrim(new.alternate_unit);new.base_unit:=item.unit;
 if lower(new.alternate_unit)=lower(btrim(item.unit)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if tg_op='UPDATE' and old.effective_from<=today then
  if row(new.item_id,new.alternate_unit,new.base_unit,new.factor,new.effective_from,new.status) is distinct from row(old.item_id,old.alternate_unit,old.base_unit,old.factor,old.effective_from,old.status)
   or (new.effective_to is distinct from old.effective_to and (old.effective_to<today or new.effective_to is null or new.effective_to<today)) then
   raise exception 'BUSINESS_UOM_HISTORY_LOCKED';
  end if;
 end if;
 if new.status='active' and exists(select 1 from public.business_item_unit_conversions c where c.tenant_id=new.tenant_id and c.item_id=new.item_id and c.id<>new.id and c.status='active' and lower(c.alternate_unit)=lower(new.alternate_unit) and daterange(c.effective_from,c.effective_to,'[]') && daterange(new.effective_from,new.effective_to,'[]')) then
  raise exception 'BUSINESS_UOM_OVERLAP';
 end if;
 return new;
end $$;
revoke all on function public.business_item_unit_conversion_guard() from public,anon,authenticated,service_role;
create trigger business_item_unit_conversion_guard before insert or update on public.business_item_unit_conversions for each row execute function public.business_item_unit_conversion_guard();

-- Quantities on existing references retain their original base unit, including draft documents.
create function public.business_item_base_unit_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare dependency record;used boolean;
begin
 if new.unit is not distinct from old.unit then return new;end if;
 for dependency in
  select ns.nspname schema_name,rel.relname table_name,local_col.attname column_name
  from pg_catalog.pg_constraint c join pg_catalog.pg_class rel on rel.oid=c.conrelid join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace
  cross join lateral unnest(c.conkey,c.confkey) as columns(local_number,target_number)
  join pg_catalog.pg_attribute local_col on local_col.attrelid=c.conrelid and local_col.attnum=columns.local_number
  join pg_catalog.pg_attribute target_col on target_col.attrelid=c.confrelid and target_col.attnum=columns.target_number
  where c.contype='f' and c.confrelid='public.business_items'::regclass and ns.nspname='public' and target_col.attname='id'
 loop
  execute format('select exists(select 1 from %I.%I where tenant_id=$1 and %I=$2)',dependency.schema_name,dependency.table_name,dependency.column_name) into used using old.tenant_id,old.id;
  if used then raise exception 'BUSINESS_ITEM_UNIT_LOCKED';end if;
 end loop;
 return new;
end $$;
revoke all on function public.business_item_base_unit_guard() from public,anon,authenticated,service_role;
create trigger business_item_base_unit_guard before update of unit on public.business_items for each row execute function public.business_item_base_unit_guard();

create function public.business_item_quantity_conversion(p_hash text,p_slug text,p_item_id uuid,p_from_unit text,p_quantity numeric,p_on date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.business_accounts%rowtype;item public.business_items%rowtype;c public.business_item_unit_conversions%rowtype;factor numeric:=1;base_quantity numeric;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,'items');perform public.business_assert_kind(a.tenant_id,'item_unit_conversions');
 if p_item_id is null or p_from_unit is null or char_length(btrim(p_from_unit)) not between 1 and 30 or p_quantity is null or p_quantity<=0 or p_quantity>1000000000000000 or p_on is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into item from public.business_items where tenant_id=a.tenant_id and id=p_item_id and status='active';
 if item.id is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform public.business_assert_access(a.id,'items','read',to_jsonb(item));
 if lower(btrim(p_from_unit))<>lower(btrim(item.unit)) then
  select * into c from public.business_item_unit_conversions where tenant_id=a.tenant_id and item_id=item.id and status='active' and lower(alternate_unit)=lower(btrim(p_from_unit)) and effective_from<=p_on and (effective_to is null or effective_to>=p_on);
  if c.id is null then raise exception 'BUSINESS_UOM_NOT_FOUND';end if;
  perform public.business_assert_access(a.id,'item_unit_conversions','read',to_jsonb(c));factor:=c.factor;
 end if;
 base_quantity:=round(p_quantity*factor,4);
 if base_quantity<0.0001 or base_quantity>1000000000000000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if item.tracking='serial' and base_quantity<>trunc(base_quantity) then raise exception 'BUSINESS_UOM_SERIAL_QUANTITY';end if;
 return jsonb_build_object('itemId',item.id,'fromUnit',btrim(p_from_unit),'baseUnit',item.unit,'quantity',p_quantity,'factor',factor,'baseQuantity',base_quantity,'effectiveOn',p_on,'conversionId',c.id);
end $$;
revoke all on function public.business_item_quantity_conversion(text,text,uuid,text,numeric,date) from public,anon,authenticated,service_role;
grant execute on function public.business_item_quantity_conversion(text,text,uuid,text,numeric,date) to service_role;
