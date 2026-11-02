insert into public.business_entity_definitions(kind,definition) values
('payment_requests','{"label":"\u0110\u1ec1 ngh\u1ecb thanh to\u00e1n","feature":"accounting","mode":"document","misaDomain":true,"requiresApproval":true,"fields":{"request_type":{"label":"Lo\u1ea1i \u0111\u1ec1 ngh\u1ecb","type":"enum","values":{"supplier":"Nh\u00e0 cung c\u1ea5p","employee":"Nh\u00e2n vi\u00ean","other":"Kh\u00e1c"},"required":true},"partner_id":{"label":"Nh\u00e0 cung c\u1ea5p","type":"ref","ref":"tenant_partners"},"staff_id":{"label":"Nh\u00e2n vi\u00ean","type":"ref","ref":"staff","requiresFeature":"people"},"beneficiary_name":{"label":"Ng\u01b0\u1eddi th\u1ee5 h\u01b0\u1edfng","type":"text","max":180},"project_id":{"label":"C\u00f4ng tr\u00ecnh","type":"ref","ref":"projects","requiresFeature":"projects"},"source_kind":{"label":"Ngu\u1ed3n","type":"text","max":80},"source_id":{"label":"M\u00e3 ch\u1ee9ng t\u1eeb ngu\u1ed3n","type":"text","max":36},"requested_on":{"label":"Ng\u00e0y \u0111\u1ec1 ngh\u1ecb","type":"date","required":true},"due_on":{"label":"H\u1ea1n thanh to\u00e1n","type":"date"},"amount":{"label":"S\u1ed1 ti\u1ec1n","type":"number","min":0.01,"required":true},"requested_account_id":{"label":"T\u00e0i kho\u1ea3n chi","type":"ref","ref":"gl_accounts"},"purpose":{"label":"N\u1ed9i dung","type":"text","required":true,"max":500},"document_date":{"label":"Ng\u00e0y ch\u1ee9ng t\u1eeb","type":"date","required":true}}}'::jsonb);

create table public.business_payment_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 request_type text not null check(request_type in ('supplier','employee','other')),partner_id uuid,staff_id uuid,beneficiary_name text,
 project_id uuid,source_kind text,source_id uuid,document_date date not null,requested_on date not null,due_on date,amount numeric(24,4) not null check(amount>0),requested_account_id uuid,purpose text not null check(char_length(btrim(purpose)) between 3 and 500),
 unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),
 foreign key(tenant_id,partner_id) references public.business_tenant_partners(tenant_id,id),foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id),
 foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id),foreign key(tenant_id,requested_account_id) references public.business_gl_accounts(tenant_id,id),
 check((request_type='supplier' and partner_id is not null and staff_id is null) or (request_type='employee' and staff_id is not null and partner_id is null) or (request_type='other' and beneficiary_name is not null and partner_id is null and staff_id is null)),
 check((source_kind is null)=(source_id is null)),check(due_on is null or due_on>=requested_on)
);
create unique index business_payment_requests_code_idx on public.business_payment_requests(tenant_id,lower(code));
create unique index business_payment_requests_source_idx on public.business_payment_requests(tenant_id,source_kind,source_id) where source_id is not null;
create index business_payment_requests_due_idx on public.business_payment_requests(tenant_id,due_on,project_id) where status='posted';
alter table public.business_payment_requests enable row level security;
revoke all on public.business_payment_requests from public,anon,authenticated,service_role;

create function public.business_payment_request_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.request_type,new.partner_id,new.staff_id,new.beneficiary_name,new.project_id,new.source_kind,new.source_id,new.document_date,new.requested_on,new.due_on,new.amount,new.requested_account_id,new.purpose,new.name,new.notes)
   is distinct from (old.request_type,old.partner_id,old.staff_id,old.beneficiary_name,old.project_id,old.source_kind,old.source_id,old.document_date,old.requested_on,old.due_on,old.amount,old.requested_account_id,old.purpose,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  if new.requested_on>today or new.document_date>today or (new.due_on is not null and new.due_on<new.requested_on) then raise exception 'BUSINESS_INVALID_DATE';end if;
  if new.project_id is not null and not exists(select 1 from public.business_projects where tenant_id=new.tenant_id and id=new.project_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.staff_id is not null and not exists(select 1 from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if new.partner_id is not null and not exists(select 1 from public.business_tenant_partners where tenant_id=new.tenant_id and id=new.partner_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 end if;
 return new;
end $$;
revoke all on function public.business_payment_request_guard() from public,anon,authenticated,service_role;
create trigger business_payment_request_guard before insert or update on public.business_payment_requests for each row execute function public.business_payment_request_guard();

do $$
declare body text;anchor text;replacement text;
begin
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 anchor:='elsif p_kind=''employee_documents'' then return jsonb_build_object(''lines'',''[]''::jsonb);';
 replacement:=anchor||E'\n'||' elsif p_kind=''payment_requests'' then return jsonb_build_object(''lines'',''[]''::jsonb);';
 if strpos(body,anchor)=0 then raise exception 'Review MISA dispatch before adding payment requests';end if;
 execute replace(body,anchor,replacement);
end $$;
