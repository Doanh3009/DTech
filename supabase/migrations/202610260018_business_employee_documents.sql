insert into public.business_entity_definitions(kind,definition) values ('employee_documents','{"label":"Gi\u1ea5y t\u1edd nh\u00e2n vi\u00ean","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"staff_id":{"label":"Nh\u00e2n vi\u00ean","type":"ref","ref":"staff","required":true},"document_date":{"label":"Ng\u00e0y ch\u1ee9ng t\u1eeb","type":"date","required":true},"document_type":{"label":"Lo\u1ea1i gi\u1ea5y t\u1edd","type":"enum","values":{"identity_card":"CCCD/CMND","passport":"H\u1ed9 chi\u1ebfu","tax_code":"M\u00e3 s\u1ed1 thu\u1ebf","social_insurance":"BHXH","certificate":"Ch\u1ee9ng ch\u1ec9","work_permit":"Gi\u1ea5y ph\u00e9p lao \u0111\u1ed9ng","other":"Kh\u00e1c"},"required":true},"document_no":{"label":"S\u1ed1 gi\u1ea5y t\u1edd","type":"text","required":true,"max":80,"readRoles":["owner","editor"]},"issued_on":{"label":"Ng\u00e0y c\u1ea5p","type":"date","required":true},"expires_on":{"label":"Ng\u00e0y h\u1ebft h\u1ea1n","type":"date"},"issuing_authority":{"label":"N\u01a1i c\u1ea5p","type":"text","max":180}}}'::jsonb);

create table public.business_employee_documents(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 staff_id uuid not null,document_date date not null,document_type text not null check(document_type in ('identity_card','passport','tax_code','social_insurance','certificate','work_permit','other')),
 document_no text not null check(char_length(btrim(document_no)) between 1 and 80),issued_on date not null,expires_on date,issuing_authority text check(issuing_authority is null or char_length(issuing_authority)<=180),
 check(expires_on is null or expires_on>=issued_on),foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id)
);
create unique index business_employee_documents_code_idx on public.business_employee_documents(tenant_id,lower(code));
create index business_employee_documents_expiry_idx on public.business_employee_documents(tenant_id,expires_on,staff_id) where status='posted' and expires_on is not null;
create index business_employee_documents_staff_idx on public.business_employee_documents(tenant_id,staff_id,issued_on desc);
alter table public.business_employee_documents enable row level security;
revoke all on public.business_employee_documents from public,anon,authenticated,service_role;

create function public.business_employee_document_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare staff public.business_staff%rowtype;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.staff_id,new.document_date,new.document_type,new.document_no,new.issued_on,new.expires_on,new.issuing_authority,new.name,new.notes)
    is distinct from (old.staff_id,old.document_date,old.document_type,old.document_no,old.issued_on,old.expires_on,old.issuing_authority,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  select * into staff from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id for key share;
  if not found or staff.status<>'active' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.issued_on<staff.joined_on or new.document_date<new.issued_on then raise exception 'BUSINESS_INVALID_DATE';end if;
 end if;
 return new;
end $$;

revoke all on function public.business_employee_document_guard() from public,anon,authenticated,service_role;
create trigger business_employee_document_guard before insert or update on public.business_employee_documents for each row execute function public.business_employee_document_guard();

do $$
declare body text;anchor text;replacement text;
begin
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 anchor:='elsif p_kind in (''employment_contracts'',''staff_history'') then return jsonb_build_object(''lines'',''[]''::jsonb);';
 replacement:=anchor||E'\n'||' elsif p_kind=''employee_documents'' then return jsonb_build_object(''lines'',''[]''::jsonb);';
 if strpos(body,anchor)=0 then raise exception 'Review MISA dispatch before adding employee documents';end if;
 execute replace(body,anchor,replacement);
end $$;

do $$
declare body text;anchor text;replacement text;
begin
 select pg_get_functiondef('public.business_people_workspace(text,text,date,date,integer)'::regprocedure) into body;
 anchor:='return jsonb_build_object(''rows'',rows,''total'',total,''totals'',totals||jsonb_build_object(''pending'',pending),''from'',p_from,''to'',p_to,''page'',p_page,''pageSize'',25);';
 replacement:='return jsonb_build_object(''rows'',rows,''total'',total,''totals'',totals||jsonb_build_object(''pending'',pending),''from'',p_from,''to'',p_to,''page'',p_page,''pageSize'',25,''employeeDocuments'',jsonb_build_object(''expired'',(select count(*) from public.business_employee_documents d join public.business_staff s on s.tenant_id=d.tenant_id and s.id=d.staff_id where d.tenant_id=a.tenant_id and d.status=''posted'' and d.expires_on<(now() at time zone ''Asia/Ho_Chi_Minh'')::date and s.status=''active'' and public.business_access_allowed(a.id,''staff'',''read'',to_jsonb(s))),''dueSoon'',(select count(*) from public.business_employee_documents d join public.business_staff s on s.tenant_id=d.tenant_id and s.id=d.staff_id where d.tenant_id=a.tenant_id and d.status=''posted'' and d.expires_on between (now() at time zone ''Asia/Ho_Chi_Minh'')::date and (now() at time zone ''Asia/Ho_Chi_Minh'')::date+30 and s.status=''active'' and public.business_access_allowed(a.id,''staff'',''read'',to_jsonb(s))),''rows'',coalesce((select jsonb_agg(to_jsonb(x) order by x.expires_on,x.staff_name,x.id) from(select d.id,d.code,s.code staff_code,s.name staff_name,d.document_type,d.expires_on,d.expires_on-(now() at time zone ''Asia/Ho_Chi_Minh'')::date days_remaining from public.business_employee_documents d join public.business_staff s on s.tenant_id=d.tenant_id and s.id=d.staff_id where d.tenant_id=a.tenant_id and d.status=''posted'' and d.expires_on<=(now() at time zone ''Asia/Ho_Chi_Minh'')::date+30 and s.status=''active'' and public.business_access_allowed(a.id,''staff'',''read'',to_jsonb(s)) order by d.expires_on,s.name,d.id limit 50)x),''[]''::jsonb)),''employmentContracts'',jsonb_build_object(''expired'',(select count(*) from public.business_employment_contracts c join public.business_staff s on s.tenant_id=c.tenant_id and s.id=c.staff_id where c.tenant_id=a.tenant_id and c.status=''posted'' and c.ends_on<(now() at time zone ''Asia/Ho_Chi_Minh'')::date and s.status=''active'' and public.business_access_allowed(a.id,''employment_contracts'',''read'',to_jsonb(c))),''dueSoon'',(select count(*) from public.business_employment_contracts c join public.business_staff s on s.tenant_id=c.tenant_id and s.id=c.staff_id where c.tenant_id=a.tenant_id and c.status=''posted'' and c.ends_on between (now() at time zone ''Asia/Ho_Chi_Minh'')::date and (now() at time zone ''Asia/Ho_Chi_Minh'')::date+30 and s.status=''active'' and public.business_access_allowed(a.id,''employment_contracts'',''read'',to_jsonb(c))),''rows'',coalesce((select jsonb_agg(to_jsonb(x) order by x.ends_on,x.staff_name,x.id) from(select c.id,c.code,c.contract_no,s.code staff_code,s.name staff_name,c.ends_on,c.ends_on-(now() at time zone ''Asia/Ho_Chi_Minh'')::date days_remaining from public.business_employment_contracts c join public.business_staff s on s.tenant_id=c.tenant_id and s.id=c.staff_id where c.tenant_id=a.tenant_id and c.status=''posted'' and c.ends_on is not null and c.ends_on<=(now() at time zone ''Asia/Ho_Chi_Minh'')::date+30 and s.status=''active'' and public.business_access_allowed(a.id,''employment_contracts'',''read'',to_jsonb(c)) order by c.ends_on,s.name,c.id limit 50)x),''[]''::jsonb)));';
 if strpos(body,anchor)=0 then raise exception 'Review people workspace return shape before adding employee expiry report';end if;
 execute replace(body,anchor,replacement);
end $$;
