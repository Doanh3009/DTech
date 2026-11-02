create function public.business_form_default_data(p_fields jsonb,p_data jsonb default '{}'::jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare f jsonb;result jsonb:=coalesce(p_data,'{}'::jsonb);condition jsonb;field_key text;visible boolean;
begin
 for f in select value from jsonb_array_elements(p_fields) loop
  visible:=true;condition:=f->'visibleWhen';
  if condition is not null then visible:=coalesce(result->>(condition->>'field'),'')=condition->>'equals';end if;
  field_key:=f->>'key';
  if visible and not(result ? field_key) and f ? 'defaultValue' then result:=result||jsonb_build_object(field_key,f->'defaultValue');end if;
 end loop;
 return result;
end $$;
revoke all on function public.business_form_default_data(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_form_config_validate() returns trigger language plpgsql set search_path='' as $$
declare f jsonb;condition jsonb;source jsonb;option_value jsonb;seen text[]:='{}';k text;pattern text;default_value jsonb;idx bigint;
begin
 if coalesce(jsonb_typeof(new.fields),'')<>'array' or jsonb_array_length(new.fields)>32 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 for f,idx in select value,ordinality from jsonb_array_elements(new.fields) with ordinality loop
  k:=f->>'key';
  if coalesce(k,'')!~'^[a-z][a-z0-9_]{0,39}$' or k=any(seen) or coalesce(char_length(btrim(f->>'label')),0) not between 1 and 120 or coalesce(f->>'type','') not in ('text','number','date','choice','boolean') or coalesce(jsonb_typeof(f->'required'),'')<>'boolean' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  seen:=array_append(seen,k);
  if f->>'type'='choice' then
   if coalesce(jsonb_typeof(f->'options'),'')<>'array' or jsonb_array_length(f->'options') not between 1 and 20 or exists(select 1 from jsonb_array_elements(f->'options') where jsonb_typeof(value)<>'string' or char_length(value#>>'{}') not between 1 and 120) or (select count(distinct value) from jsonb_array_elements(f->'options'))<>jsonb_array_length(f->'options') then raise exception 'BUSINESS_INVALID_INPUT';end if;
  elsif f ? 'options' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f ? 'pattern' then
   if f->>'type'<>'text' or char_length(f->>'pattern')>240 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   pattern:=f->>'pattern';perform '' ~ pattern;
  end if;
  if f ? 'maxLength' and coalesce((f->>'maxLength')::integer,0) not between 1 and 2000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if coalesce((f->>'min')::numeric,-1e15)<-1e15 or coalesce((f->>'max')::numeric,1e15)>1e15 or coalesce((f->>'min')::numeric,-1e15)>coalesce((f->>'max')::numeric,1e15) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if f ? 'defaultValue' then
   default_value:=f->'defaultValue';
   if jsonb_typeof(default_value) not in ('string','number','boolean') or (f->>'type'='number' and jsonb_typeof(default_value)<>'number') or (f->>'type'='boolean' and jsonb_typeof(default_value)<>'boolean') or (f->>'type' in ('text','date','choice') and jsonb_typeof(default_value)<>'string') then raise exception 'BUSINESS_INVALID_INPUT';end if;
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
  end loop;
 end loop;
 return new;
exception when invalid_regular_expression or invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception 'BUSINESS_INVALID_INPUT';
end $$;
revoke all on function public.business_form_config_validate() from public,anon,authenticated,service_role;
create trigger business_form_config_validate before insert on public.business_form_versions for each row execute function public.business_form_config_validate();

create or replace function public.business_form_validate(p_fields jsonb,p_data jsonb) returns void language plpgsql immutable set search_path='' as $$
declare f jsonb;value jsonb;k text;s text;n numeric;visible boolean;required boolean;condition jsonb;data jsonb;
begin
 if coalesce(jsonb_typeof(p_data),'')<>'object' or octet_length(p_data::text)>80000 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 data:=public.business_form_default_data(p_fields,p_data);
 for k in select jsonb_object_keys(data) loop if not exists(select 1 from jsonb_array_elements(p_fields) where value->>'key'=k) then raise exception 'BUSINESS_INVALID_INPUT';end if;end loop;
 for f in select jsonb_array_elements(p_fields) loop
  condition:=f->'visibleWhen';visible:=condition is null or coalesce(data->>(condition->>'field'),'')=condition->>'equals';
  if not visible then if data ? (f->>'key') then raise exception 'BUSINESS_INVALID_INPUT';end if;continue;end if;
  required:=(f->>'required')::boolean;condition:=f->'requiredWhen';if condition is not null and coalesce(data->>(condition->>'field'),'')=condition->>'equals' then required:=true;end if;
  value:=data->(f->>'key');
  if value is null or value='null'::jsonb or value='""'::jsonb then if required then raise exception 'BUSINESS_FORM_REQUIRED';end if;continue;end if;
  if f->>'type'='boolean' then if jsonb_typeof(value)<>'boolean' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  elsif f->>'type'='number' then
   if jsonb_typeof(value)<>'number' then raise exception 'BUSINESS_INVALID_INPUT';end if;n:=(value#>>'{}')::numeric;
   if n<coalesce((f->>'min')::numeric,-1e15) or n>coalesce((f->>'max')::numeric,1e15) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  else
   if jsonb_typeof(value)<>'string' then raise exception 'BUSINESS_INVALID_INPUT';end if;s:=value#>>'{}';
   if char_length(s)>coalesce((f->>'maxLength')::integer,2000) or required and char_length(btrim(s))=0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='date' and (s!~ '^\d{4}-\d{2}-\d{2}$' or to_char(to_date(s,'YYYY-MM-DD'),'YYYY-MM-DD')<>s) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='choice' and not(f->'options' ? s) then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if f->>'type'='text' and f ? 'pattern' and s!~(f->>'pattern') then raise exception 'BUSINESS_INVALID_INPUT';end if;
  end if;
 end loop;
exception when invalid_regular_expression or invalid_datetime_format or datetime_field_overflow then raise exception 'BUSINESS_INVALID_INPUT';
end $$;
revoke all on function public.business_form_validate(jsonb,jsonb) from public,anon,authenticated,service_role;

do $$ declare body text;original text:='perform public.business_form_validate(form.fields,p_data);';replacement text:='p_data:=public.business_form_default_data(form.fields,p_data);perform public.business_form_validate(form.fields,p_data);';begin
 select pg_get_functiondef('public.business_form_record_save(text,text,uuid,text,uuid,integer,integer,uuid,jsonb,text)'::regprocedure) into body;
 if position(original in body)=0 then raise exception 'BUSINESS_MIGRATION_SOURCE_MISMATCH';end if;
 execute replace(body,original,replacement);
end $$;

create function public.business_form_record_defaults() returns trigger language plpgsql set search_path='' as $$
declare fields jsonb;
begin
 select v.fields into fields from public.business_form_versions v where v.tenant_id=new.tenant_id and v.id=new.form_id;
 if fields is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 new.data:=public.business_form_default_data(fields,new.data);
 perform public.business_form_validate(fields,new.data);
 return new;
end $$;
revoke all on function public.business_form_record_defaults() from public,anon,authenticated,service_role;
create trigger business_form_record_defaults before insert or update of form_id,data on public.business_form_records for each row execute function public.business_form_record_defaults();

create or replace function public.business_form_snapshot(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;form public.business_form_versions%rowtype;data public.business_form_records%rowtype;form_data jsonb:='{}'::jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,p_kind);
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',v);
 select * into data from public.business_form_records where tenant_id=a.tenant_id and kind=p_kind and record_id=p_id;
 if found then select * into form from public.business_form_versions where tenant_id=a.tenant_id and id=data.form_id;form_data:=data.data;
 else select * into form from public.business_form_versions where tenant_id=a.tenant_id and kind=p_kind and active;if form.id is not null then form_data:=public.business_form_default_data(form.fields,'{}'::jsonb);end if;end if;
 return jsonb_build_object('form',case when form.id is null then null else to_jsonb(form)-'tenant_id'-'created_by'-'reason' end,'data',form_data,'rowVersion',coalesce(data.row_version,0),'parentVersion',v->'row_version');
end $$;
revoke all on function public.business_form_snapshot(text,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_form_snapshot(text,text,text,uuid) to service_role;
