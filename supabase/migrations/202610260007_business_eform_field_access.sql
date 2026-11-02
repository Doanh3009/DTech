create function public.business_form_authorized_data(p_fields jsonb,p_data jsonb,p_prior jsonb,p_role text) returns jsonb language plpgsql immutable set search_path='' as $$
declare f jsonb;condition jsonb;result jsonb:=coalesce(p_data,'{}'::jsonb);prior jsonb:=coalesce(p_prior,'{}'::jsonb);field_key text;visible boolean;writable boolean;
begin
 for f in select value from jsonb_array_elements(p_fields) loop
  field_key:=f->>'key';condition:=f->'visibleWhen';visible:=condition is null or coalesce(result->>(condition->>'field'),'')=condition->>'equals';
  if not visible then
   if result ? field_key and (not(prior ? field_key) or result->field_key is distinct from prior->field_key) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   result:=result-field_key;continue;
  end if;
  writable:=p_role='owner' or coalesce(f->'writeRoles','["owner","editor"]'::jsonb) ? p_role;
  if not writable then
   if result ? field_key and (not(prior ? field_key) or result->field_key is distinct from prior->field_key) then raise exception 'BUSINESS_FORBIDDEN';end if;
   if prior ? field_key then result:=result||jsonb_build_object(field_key,prior->field_key);else result:=result-field_key;end if;
  end if;
 end loop;
 return result;
end $$;
revoke all on function public.business_form_authorized_data(jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;

create or replace function public.business_form_config_validate() returns trigger language plpgsql set search_path='' as $$
declare f jsonb;condition jsonb;source jsonb;seen text[]:='{}';k text;pattern text;default_value jsonb;idx bigint;read_roles jsonb;write_roles jsonb;
begin
 if coalesce(jsonb_typeof(new.fields),'')<>'array' or jsonb_array_length(new.fields)>32 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for f,idx in select value,ordinality from jsonb_array_elements(new.fields) with ordinality loop
  k:=f->>'key';
  if coalesce(k,'')!~'^[a-z][a-z0-9_]{0,39}$' or k=any(seen) or coalesce(char_length(btrim(f->>'label')),0) not between 1 and 120 or coalesce(f->>'type','') not in ('text','number','date','choice','boolean') or coalesce(jsonb_typeof(f->'required'),'')<>'boolean' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  seen:=array_append(seen,k);
  read_roles:=coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb);write_roles:=coalesce(f->'writeRoles','["owner","editor"]'::jsonb);
  if jsonb_typeof(read_roles)<>'array' or jsonb_array_length(read_roles) not between 1 and 3 then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if exists(select 1 from jsonb_array_elements_text(read_roles) as rr(role) where role not in ('owner','editor','viewer')) or jsonb_array_length(read_roles)<>(select count(distinct value) from jsonb_array_elements_text(read_roles)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if jsonb_typeof(write_roles)<>'array' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if jsonb_array_length(write_roles) not between 1 and 2 or exists(select 1 from jsonb_array_elements_text(write_roles) as wr(role) where role not in ('owner','editor') or not(read_roles ? role)) or jsonb_array_length(write_roles)<>(select count(distinct value) from jsonb_array_elements_text(write_roles)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if coalesce(f->>'masking','none') not in ('none','last4') or coalesce(f->>'masking','none')<>'none' and f->>'type'<>'text' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f->>'type'='choice' then
   if coalesce(jsonb_typeof(f->'options'),'')<>'array' or jsonb_array_length(f->'options') not between 1 and 20 or exists(select 1 from jsonb_array_elements(f->'options') where jsonb_typeof(value)<>'string' or char_length(value#>>'{}') not between 1 and 120) or (select count(distinct value) from jsonb_array_elements(f->'options'))<>jsonb_array_length(f->'options') then raise exception 'BUSINESS_INVALID_INPUT';end if;
  elsif f ? 'options' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f ? 'pattern' then if f->>'type'<>'text' or char_length(f->>'pattern')>240 then raise exception 'BUSINESS_INVALID_INPUT';end if;pattern:=f->>'pattern';perform '' ~ pattern;end if;
  if f ? 'maxLength' and coalesce((f->>'maxLength')::integer,0) not between 1 and 2000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if coalesce((f->>'min')::numeric,-1e15)<-1e15 or coalesce((f->>'max')::numeric,1e15)>1e15 or coalesce((f->>'min')::numeric,-1e15)>coalesce((f->>'max')::numeric,1e15) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f ? 'defaultValue' then
   default_value:=f->'defaultValue';if jsonb_typeof(default_value) not in ('string','number','boolean') or (f->>'type'='number' and jsonb_typeof(default_value)<>'number') or (f->>'type'='boolean' and jsonb_typeof(default_value)<>'boolean') or (f->>'type' in ('text','date','choice') and jsonb_typeof(default_value)<>'string') then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='number' and ((default_value#>>'{}')::numeric<coalesce((f->>'min')::numeric,-1e15) or (default_value#>>'{}')::numeric>coalesce((f->>'max')::numeric,1e15)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='text' and char_length(default_value#>>'{}')>coalesce((f->>'maxLength')::integer,2000) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='choice' and not(f->'options' ? (default_value#>>'{}')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='text' and f ? 'pattern' and (default_value#>>'{}')!~(f->>'pattern') then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='date' and ((default_value#>>'{}')!~'^\d{4}-\d{2}-\d{2}$' or to_char(to_date(default_value#>>'{}','YYYY-MM-DD'),'YYYY-MM-DD')<>default_value#>>'{}') then raise exception 'BUSINESS_INVALID_INPUT';end if;
  end if;
  for condition in select f->'visibleWhen' where f ? 'visibleWhen' union all select f->'requiredWhen' where f ? 'requiredWhen' loop
   if coalesce(jsonb_typeof(condition),'')<>'object' or coalesce(condition->>'field','')!~'^[a-z][a-z0-9_]{0,39}$' or coalesce(char_length(condition->>'equals'),0) not between 1 and 120 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   select value into source from jsonb_array_elements(new.fields) with ordinality where value->>'key'=condition->>'field' and ordinality<idx;
   if source is null or source->>'type'<>'choice' or not(source->'options' ? (condition->>'equals')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if exists(select 1 from jsonb_array_elements_text(read_roles) as rr(role) where not coalesce(source->'readRoles','["owner","editor","viewer"]'::jsonb) ? role) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  end loop;
 end loop;
 return new;
exception when invalid_regular_expression or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'BUSINESS_INVALID_INPUT';
end $$;
revoke all on function public.business_form_config_validate() from public,anon,authenticated,service_role;

do $$ declare body text;original text:='p_data:=public.business_form_default_data(form.fields,p_data);perform public.business_form_validate(form.fields,p_data);';replacement text:='p_data:=public.business_form_authorized_data(form.fields,p_data,prior.data,a.role);p_data:=public.business_form_default_data(form.fields,p_data);perform public.business_form_validate(form.fields,p_data);';begin
 select pg_get_functiondef('public.business_form_record_save(text,text,uuid,text,uuid,integer,integer,uuid,jsonb,text)'::regprocedure) into body;
 if position(original in body)=0 then raise exception 'BUSINESS_MIGRATION_SOURCE_MISMATCH';end if;
 execute replace(body,original,replacement);
end $$;

create or replace function public.business_form_snapshot(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;form public.business_form_versions%rowtype;data public.business_form_records%rowtype;form_data jsonb:='{}'::jsonb;fields jsonb:='[]'::jsonb;filtered_data jsonb:='{}'::jsonb;f jsonb;can_write boolean;s text;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',v);
 select * into data from public.business_form_records where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id;
 if found then select * into form from public.business_form_versions where tenant_id=a.tenant_id and id=data.form_id;form_data:=data.data;
 else select * into form from public.business_form_versions where tenant_id=a.tenant_id and kind=p_kind and active;if form.id is not null then form_data:=public.business_form_default_data(form.fields,'{}'::jsonb);end if;end if;
 if form.id is not null then
  for f in select value from jsonb_array_elements(form.fields) loop
   if a.role<>'owner' and not coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb) ? a.role then continue;end if;
   can_write:=a.role='owner' or coalesce(f->'writeRoles','["owner","editor"]'::jsonb) ? a.role;
   fields:=fields||jsonb_build_array(f||jsonb_build_object('canWrite',can_write));
   if form_data ? (f->>'key') then
    if not can_write and f->>'masking'='last4' and jsonb_typeof(form_data->(f->>'key'))='string' then
     s:=form_data->>(f->>'key');if char_length(s)>4 then s:=repeat('•',char_length(s)-4)||right(s,4);else s:='••••';end if;
     filtered_data:=filtered_data||jsonb_build_object(f->>'key',s);
    else filtered_data:=filtered_data||jsonb_build_object(f->>'key',form_data->(f->>'key'));end if;
   end if;
  end loop;
 end if;
 return jsonb_build_object('form',case when form.id is null then null else (to_jsonb(form)-'tenant_id'-'created_by'-'reason')||jsonb_build_object('fields',fields) end,'data',filtered_data,'rowVersion',coalesce(data.row_version,0),'parentVersion',v->'row_version');
end $$;
revoke all on function public.business_form_snapshot(text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_form_snapshot(text,text,text,uuid) to service_role;
