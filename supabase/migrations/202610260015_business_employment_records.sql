insert into public.business_entity_definitions(kind,definition) values
('employment_contracts','{"label":"Hợp đồng lao động","feature":"people","mode":"document","fields":{"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"contract_no":{"label":"Số hợp đồng","type":"text","required":true,"max":50},"contract_type":{"label":"Loại hợp đồng","type":"enum","values":{"probation":"Thử việc","fixed_term":"Xác định thời hạn","indefinite":"Không xác định thời hạn","amendment":"Phụ lục"},"default":"fixed_term"},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"signed_on":{"label":"Ngày ký","type":"date","required":true},"starts_on":{"label":"Hiệu lực từ","type":"date","required":true},"ends_on":{"label":"Hiệu lực đến","type":"date"},"department":{"label":"Phòng ban","type":"text","required":true,"max":180},"position":{"label":"Chức danh","type":"text","required":true,"max":180},"monthly_salary":{"label":"Lương tháng","type":"number","required":true,"min":0,"readRoles":["owner","editor"]}},"requiresApproval":true,"misaDomain":true}'::jsonb),
('staff_history','{"label":"Lịch sử nhân sự","feature":"people","mode":"document","fields":{"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"document_date":{"label":"Ngày chứng từ","type":"date","required":true},"effective_on":{"label":"Ngày hiệu lực","type":"date","required":true},"change_type":{"label":"Loại thay đổi","type":"enum","values":{"department":"Phòng ban","position":"Chức danh","compensation":"Lương","assignment":"Điều động công trình"},"default":"position"},"department":{"label":"Phòng ban mới","type":"text","max":180},"position":{"label":"Chức danh mới","type":"text","max":180},"base_salary":{"label":"Lương mới","type":"number","min":0,"readRoles":["owner","editor"]},"project_id":{"label":"Công trình","type":"ref","ref":"projects"},"reason":{"label":"Lý do","type":"text","required":true,"max":500}},"requiresApproval":true,"misaDomain":true}'::jsonb);

update public.business_entity_definitions set definition=jsonb_set(definition,'{fields,base_salary,readRoles}','["owner","editor"]'::jsonb,true) where kind='staff';
update public.business_entity_definitions set definition=jsonb_set(definition,'{fields,base_salary,readRoles}','["owner","editor"]'::jsonb,true) where kind='salary_lines';

create table public.business_employment_contracts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 staff_id uuid not null,contract_no text not null check(char_length(contract_no) between 1 and 50),contract_type text not null check(contract_type in ('probation','fixed_term','indefinite','amendment')),
 document_date date not null,signed_on date not null,starts_on date not null,ends_on date,department text not null check(char_length(btrim(department)) between 1 and 180),position text not null check(char_length(btrim(position)) between 1 and 180),
 monthly_salary numeric(20,4) not null check(monthly_salary between 0 and 1000000000000000),previous_department text,previous_position text,previous_salary numeric(20,4),
 check(ends_on is null or ends_on>=starts_on),foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id)
);
create unique index business_employment_contract_code_idx on public.business_employment_contracts(tenant_id,lower(code));
create unique index business_employment_contract_no_idx on public.business_employment_contracts(tenant_id,lower(contract_no));
create index business_employment_contract_staff_idx on public.business_employment_contracts(tenant_id,staff_id,starts_on desc);
alter table public.business_employment_contracts enable row level security;revoke all on public.business_employment_contracts from public,anon,authenticated,service_role;

create table public.business_staff_history(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,unique(tenant_id,id),
 foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 staff_id uuid not null,document_date date not null,effective_on date not null,change_type text not null check(change_type in ('department','position','compensation','assignment')),
 department text check(department is null or char_length(btrim(department)) between 1 and 180),position text check(position is null or char_length(btrim(position)) between 1 and 180),
 base_salary numeric(20,4) check(base_salary is null or base_salary between 0 and 1000000000000000),project_id uuid,reason text not null check(char_length(btrim(reason)) between 3 and 500),
 previous_department text,previous_position text,previous_salary numeric(20,4),
 foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id),foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id)
);
create unique index business_staff_history_code_idx on public.business_staff_history(tenant_id,lower(code));
create unique index business_staff_history_effective_idx on public.business_staff_history(tenant_id,staff_id,effective_on,change_type) where status='posted';
create index business_staff_history_staff_idx on public.business_staff_history(tenant_id,staff_id,effective_on desc);
alter table public.business_staff_history enable row level security;revoke all on public.business_staff_history from public,anon,authenticated,service_role;

create function public.business_staff_record_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.code is distinct from old.code then raise exception 'BUSINESS_STAFF_CODE_IMMUTABLE';end if;
 if (new.department is distinct from old.department or new.position is distinct from old.position or new.base_salary is distinct from old.base_salary)
   and current_setting('app.staff_history_apply',true) is distinct from 'on' then raise exception 'BUSINESS_STAFF_CHANGE_REQUIRES_HISTORY';end if;
 return new;
end $$;
create trigger business_staff_record_guard before update on public.business_staff for each row execute function public.business_staff_record_guard();

create function public.business_employment_contract_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare staff public.business_staff%rowtype;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.staff_id,new.contract_no,new.contract_type,new.document_date,new.signed_on,new.starts_on,new.ends_on,new.department,new.position,new.monthly_salary)
    is distinct from (old.staff_id,old.contract_no,old.contract_type,old.document_date,old.signed_on,old.starts_on,old.ends_on,old.department,old.position,old.monthly_salary) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':employment:'||new.staff_id::text,0));
  select * into staff from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id for update;
  if not found or staff.status<>'active' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.starts_on>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_EFFECTIVE_DATE_NOT_REACHED';end if;
  if exists(select 1 from public.business_employment_contracts c where c.tenant_id=new.tenant_id and c.staff_id=new.staff_id and c.status='posted' and c.id<>new.id and daterange(c.starts_on,coalesce(c.ends_on,'infinity'::date),'[]') && daterange(new.starts_on,coalesce(new.ends_on,'infinity'::date),'[]')) then raise exception 'BUSINESS_CONTRACT_OVERLAP';end if;
  new.previous_department:=staff.department;new.previous_position:=staff.position;new.previous_salary:=staff.base_salary;
  perform set_config('app.staff_history_apply','on',true);
  update public.business_staff set department=new.department,position=new.position,base_salary=new.monthly_salary,row_version=row_version+1,updated_at=now() where tenant_id=new.tenant_id and id=new.staff_id;
  perform set_config('app.staff_history_apply','off',true);
 end if;
 return new;
end $$;
create trigger business_employment_contract_guard before insert or update on public.business_employment_contracts for each row execute function public.business_employment_contract_guard();

create function public.business_staff_history_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare staff public.business_staff%rowtype;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.staff_id,new.document_date,new.effective_on,new.change_type,new.department,new.position,new.base_salary,new.project_id,new.reason)
    is distinct from (old.staff_id,old.document_date,old.effective_on,old.change_type,old.department,old.position,old.base_salary,old.project_id,old.reason) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':employment:'||new.staff_id::text,0));
  select * into staff from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id for update;
  if not found or staff.status<>'active' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.effective_on>today or new.effective_on<staff.joined_on then raise exception 'BUSINESS_INVALID_DATE';end if;
  if new.change_type='department' and new.department is null or new.change_type='position' and new.position is null or new.change_type='compensation' and new.base_salary is null or new.change_type='assignment' and new.project_id is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
  new.previous_department:=staff.department;new.previous_position:=staff.position;new.previous_salary:=staff.base_salary;
  perform set_config('app.staff_history_apply','on',true);
  update public.business_staff set department=coalesce(new.department,department),position=coalesce(new.position,position),base_salary=coalesce(new.base_salary,base_salary),row_version=row_version+1,updated_at=now() where tenant_id=new.tenant_id and id=new.staff_id;
  perform set_config('app.staff_history_apply','off',true);
 end if;
 return new;
end $$;
create trigger business_staff_history_guard before insert or update on public.business_staff_history for each row execute function public.business_staff_history_guard();

do $$declare body text;anchor text;begin
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 anchor:='else raise exception ''BUSINESS_INVALID_INPUT'';end if;';
 if strpos(body,anchor)=0 then raise exception 'Review MISA effect dispatch before adding employment events';end if;
 body:=replace(body,anchor,'elsif p_kind in (''employment_contracts'',''staff_history'') then return jsonb_build_object(''lines'',''[]''::jsonb);'||anchor);
 execute body;
end $$;

create function public.business_entity_redact_fields(p_data jsonb,p_definition jsonb,p_role text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=coalesce(p_data,'{}'::jsonb);k text;f jsonb;roles jsonb;
begin
 for k,f in select key,value from jsonb_each(coalesce(p_definition->'fields','{}'::jsonb)) loop
  roles:=coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb);
  if not roles ? p_role then result:=result-k;end if;
 end loop;
 return result;
end $$;

create function public.business_entity_authorized_write(p_data jsonb,p_old jsonb,p_definition jsonb,p_role text) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=coalesce(p_data,'{}'::jsonb);k text;f jsonb;roles jsonb;field_value jsonb;
begin
 for k,f in select key,value from jsonb_each(coalesce(p_definition->'fields','{}'::jsonb)) loop
  roles:=coalesce(f->'writeRoles','["owner","editor"]'::jsonb);
  if not roles ? p_role then
   if p_old ? k then field_value:=p_old->k;
   elsif f ? 'default' then field_value:=f->'default';
   else field_value:='null'::jsonb;end if;
   if result ? k and result->k is distinct from field_value then raise exception 'BUSINESS_FORBIDDEN';end if;
   result:=result||jsonb_build_object(k,field_value);
  end if;
 end loop;
 return result;
end $$;

create or replace function public.business_list_records(p_hash text,p_slug text,p_kind text,p_page integer default 1,p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;r jsonb;n bigint;refs text:='';k text;f jsonb;roles jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);perform public.business_assert_access(a.id,p_kind,'read');
 if p_page is null or p_page not between 1 and 100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select count(*) from public.%I t where tenant_id=$1 and public.business_access_allowed($3,%L,''read'',to_jsonb(t)) and (strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0)',public.business_entity_table(p_kind),p_kind) into n using a.tenant_id,p_query,a.id;
 for k,f in select key,value from jsonb_each(d->'fields') where value->>'type'='ref' loop
  roles:=coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb);
  if roles ? a.role then refs:=refs||case when refs='' then '' else ',' end||format('%L,(select code||'' · ''||name from public.%I where tenant_id=r.tenant_id and id=r.%I)',k,public.business_entity_table(f->>'ref'),k);end if;
 end loop;
 execute format('select coalesce(jsonb_agg(public.business_entity_redact_fields(to_jsonb(r),$5,$6)||jsonb_build_object(''references'',jsonb_build_object(%s))),''[]''::jsonb) from (select * from public.%I t where tenant_id=$1 and public.business_access_allowed($3,%L,''read'',to_jsonb(t)) and (strpos(lower(code),lower($2))>0 or strpos(lower(name),lower($2))>0) order by updated_at desc,id limit 25 offset $4) r',refs,public.business_entity_table(p_kind),p_kind) into r using a.tenant_id,p_query,a.id,(p_page-1)*25,d,a.role;
 return jsonb_build_object('records',r,'total',n,'page',p_page,'pageSize',25);
end $$;

create or replace function public.business_record_detail(p_hash text,p_slug text,p_kind text,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;refs text:='';k text;f jsonb;roles jsonb;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);d:=public.business_assert_kind(a.tenant_id,p_kind);
 for k,f in select key,value from jsonb_each(d->'fields') where value->>'type'='ref' loop
  roles:=coalesce(f->'readRoles','["owner","editor","viewer"]'::jsonb);
  if roles ? a.role then refs:=refs||case when refs='' then '' else ',' end||format('%L,(select code||'' · ''||name from public.%I where tenant_id=r.tenant_id and id=r.%I)',k,public.business_entity_table(f->>'ref'),k);end if;
 end loop;
 execute format('select public.business_entity_redact_fields(to_jsonb(r),$3,$4)||jsonb_build_object(''references'',jsonb_build_object(%s)) from public.%I r where tenant_id=$1 and id=$2',refs,public.business_entity_table(p_kind)) into r using a.tenant_id,p_id,d,a.role;
 if r is null then raise exception 'BUSINESS_NOT_FOUND';end if;perform public.business_assert_access(a.id,p_kind,'read',r);return r;
end $$;

alter function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) rename to business_save_record_before_employment_fields;
revoke all on function public.business_save_record_before_employment_fields(text,text,text,uuid,integer,jsonb,uuid,text) from public,anon,authenticated,service_role;
create function public.business_save_record(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;old jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 if p_expected_version is null or p_expected_version<0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_expected_version>0 then execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into old using a.tenant_id,p_id;end if;
 p_data:=public.business_entity_authorized_write(p_data,old,d,a.role);
 return public.business_save_record_before_employment_fields(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data,p_request_id,p_payload_hash);
end $$;

revoke all on function public.business_entity_redact_fields(jsonb,jsonb,text),public.business_entity_authorized_write(jsonb,jsonb,jsonb,text),public.business_list_records(text,text,text,integer,text),public.business_record_detail(text,text,text,uuid),public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_list_records(text,text,text,integer,text),public.business_record_detail(text,text,text,uuid),public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) to service_role;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('business_staff_record_guard','business_employment_contract_guard','business_staff_history_guard') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
