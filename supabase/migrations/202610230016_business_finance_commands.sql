create table public.business_sequences(tenant_id uuid not null references public.business_tenants(id),kind text not null,value bigint not null,primary key(tenant_id,kind));
alter table public.business_sequences enable row level security;revoke all on public.business_sequences from public,anon,authenticated,service_role;
create function public.business_next_number(p_tenant uuid,p_prefix text,p_date date) returns text language plpgsql security definer set search_path='' as $$
declare n bigint;k text:=p_prefix||to_char(p_date,'YYMM');begin
 insert into public.business_sequences(tenant_id,kind,value) values(p_tenant,k,1) on conflict(tenant_id,kind) do update set value=public.business_sequences.value+1 returning value into n;
 return k||'-'||lpad(n::text,6,'0');end $$;
revoke all on function public.business_next_number(uuid,text,date) from public,anon,authenticated,service_role;
-- Financial source of truth: journals, balanced lines, open periods and immutable postings.
alter table public.business_payables add column gl_account_id uuid;
alter table public.business_payables add foreign key(tenant_id,gl_account_id) references public.business_gl_accounts(tenant_id,id);
alter table public.business_journal_entries add foreign key(tenant_id,reversed_by) references public.business_journal_entries(tenant_id,id);

create function public.business_financial_line_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare h public.business_journal_entries%rowtype;
begin
 if tg_op='UPDATE' and old.journal_id<>new.journal_id then
  if exists(select 1 from public.business_journal_entries where tenant_id=old.tenant_id and id=old.journal_id and status<>'draft') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  update public.business_journal_entries set reviewed_by=null,row_version=row_version+1,updated_at=now() where tenant_id=old.tenant_id and id=old.journal_id;
 end if;
 select * into h from public.business_journal_entries where tenant_id=new.tenant_id and id=new.journal_id for update;
 if h.status<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if not exists(select 1 from public.business_gl_accounts where tenant_id=new.tenant_id and id=new.account_id and status='active' and account_type='posting') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 update public.business_journal_entries set reviewed_by=null,row_version=row_version+1,updated_at=now() where tenant_id=new.tenant_id and id=new.journal_id;
 return new;
end $$;
create trigger business_financial_line_guard before insert or update on public.business_journal_lines for each row execute function public.business_financial_line_guard();

create function public.business_validate_journal(p_tenant uuid,p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare h public.business_journal_entries%rowtype;d numeric;c numeric;n integer;
begin
 select * into h from public.business_journal_entries where tenant_id=p_tenant and id=p_id for update;
 if not found or h.status<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if h.posting_date<h.document_date or h.posting_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 if not exists(select 1 from public.business_accounting_periods where tenant_id=p_tenant and id=h.period_id and status='released' and h.posting_date between starts_on and ends_on) then raise exception 'BUSINESS_PERIOD_CLOSED';end if;
 if h.source_kind is distinct from 'reversal' and (h.reviewed_by is null or h.reviewed_by=h.created_by) then raise exception 'BUSINESS_REVIEW_REQUIRED';end if;
 select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) into n,d,c from public.business_journal_lines where tenant_id=p_tenant and journal_id=h.id and status='active';
 if n<2 or d<=0 or d<>c then raise exception 'BUSINESS_JOURNAL_UNBALANCED';end if;
 if exists(select 1 from public.business_journal_lines l join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id where l.tenant_id=p_tenant and l.journal_id=h.id and l.status='active' and (g.status<>'active' or g.account_type<>'posting')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
end $$;

create function public.business_generated_journal(p_tenant uuid,p_creator uuid,p_reviewer uuid,p_source text,p_source_id uuid,p_name text,p_document_date date,p_posting_date date,p_type text,p_lines jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid:=gen_random_uuid();period uuid;l jsonb;seq integer:=0;
begin
 select p.id into period from public.business_accounting_periods p where p.tenant_id=p_tenant and p.status='released' and p_posting_date between p.starts_on and p.ends_on;
 if period is null then raise exception 'BUSINESS_PERIOD_CLOSED';end if;
 insert into public.business_journal_entries(id,tenant_id,code,name,created_by,document_date,posting_date,period_id,document_type,source_kind,source_id) values(new_id,p_tenant,public.business_next_number(p_tenant,'CT',p_posting_date),left(p_name,180),p_creator,p_document_date,p_posting_date,period,p_type,p_source,p_source_id);
 for l in select value from jsonb_array_elements(p_lines) loop
  seq:=seq+1;
  insert into public.business_journal_lines(tenant_id,code,name,created_by,journal_id,account_id,debit,credit,partner_id,project_id) values(p_tenant,'DK-'||new_id::text||'-'||seq,left(p_name,180),p_creator,new_id,(l->>'accountId')::uuid,coalesce((l->>'debit')::numeric,0),coalesce((l->>'credit')::numeric,0),(l->>'partnerId')::uuid,(l->>'projectId')::uuid);
 end loop;
 update public.business_journal_entries j set reviewed_by=p_reviewer where j.tenant_id=p_tenant and j.id=new_id;
 perform public.business_validate_journal(p_tenant,new_id);
 update public.business_journal_entries j set status='posted',row_version=row_version+1,updated_at=now() where j.tenant_id=p_tenant and j.id=new_id;
 return new_id;
end $$;

create function public.business_reverse_journal(p_tenant uuid,p_id uuid,p_actor uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare h public.business_journal_entries%rowtype;lines jsonb;rid uuid;today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 select * into h from public.business_journal_entries where tenant_id=p_tenant and id=p_id for update;
 if not found or h.status<>'posted' or h.reversed_by is not null or h.source_kind='reversal' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if not exists(select 1 from public.business_accounting_periods where tenant_id=p_tenant and id=h.period_id and status='released') then raise exception 'BUSINESS_PERIOD_CLOSED';end if;
 select jsonb_agg(jsonb_build_object('accountId',account_id,'debit',credit,'credit',debit,'partnerId',partner_id,'projectId',project_id)) into lines from public.business_journal_lines where tenant_id=p_tenant and journal_id=p_id and status='active';
 rid:=public.business_generated_journal(p_tenant,p_actor,p_actor,'reversal',p_id,'Đảo '||h.name,today,today,h.document_type,lines);
 update public.business_journal_entries set reversed_by=rid,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=p_id;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(p_tenant,p_actor,'journal.reversed','journal_entries',p_id,jsonb_build_object('reversalId',rid,'reason',p_reason));
 return rid;
end $$;

-- Retain established commands; new public wrappers preserve authentication, CAS and replay.
alter function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) rename to business_save_record_core;
alter function public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) rename to business_record_action_core;
revoke all on function public.business_save_record_core(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action_core(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;

create function public.business_save_record(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;r jsonb;old jsonb;parent uuid;previous uuid;kind text;v numeric;days numeric;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if p_kind='payables' then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_kind='accounting_periods' and exists(select 1 from public.business_accounting_periods where tenant_id=a.tenant_id and id<>p_id and status<>'cancelled' and starts_on<=(p_data->>'ends_on')::date and ends_on>=(p_data->>'starts_on')::date) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
 if p_kind in ('purchase_lines','salary_lines') then
  kind:=case p_kind when 'purchase_lines' then 'purchase_orders' else 'salary_runs' end;
  parent:=(p_data->>case p_kind when 'purchase_lines' then 'purchase_order_id' else 'salary_run_id' end)::uuid;
  execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) into old using a.tenant_id,p_id;
  previous:=(old->>case p_kind when 'purchase_lines' then 'purchase_order_id' else 'salary_run_id' end)::uuid;
  execute format('select count(*) from public.%I where tenant_id=$1 and id in ($2,$3) and status<>''draft''',public.business_entity_table(kind)) into v using a.tenant_id,parent,previous;
  if v>0 then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 end if;
 if p_kind='gl_accounts' and exists(select 1 from public.business_journal_lines l join public.business_journal_entries h on h.tenant_id=l.tenant_id and h.id=l.journal_id where l.tenant_id=a.tenant_id and l.account_id=p_id and h.status='posted') then
  if exists(select 1 from public.business_gl_accounts where tenant_id=a.tenant_id and id=p_id and (code<>p_data->>'code' or nature<>p_data->>'nature' or account_type<>p_data->>'account_type')) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 end if;
 if p_kind in ('accounting_periods','salary_runs') and (p_data->>'starts_on')::date>(p_data->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 r:=public.business_save_record_core(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data,p_request_id,p_payload_hash);
 if p_kind in ('cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs','journal_entries','payments') then
  execute format('update public.%I set reviewed_by=null where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id;
 end if;
 if p_kind='salary_lines' then
  select standard_days into days from public.business_salary_runs where tenant_id=a.tenant_id and id=parent;
  v:=round((p_data->>'base_salary')::numeric*(p_data->>'worked_days')::numeric/days+(p_data->>'allowances')::numeric,0);
  if (p_data->>'deductions')::numeric>v then raise exception 'BUSINESS_INVALID_INPUT';end if;
  update public.business_salary_lines set gross_amount=v,net_amount=v-(p_data->>'deductions')::numeric where tenant_id=a.tenant_id and id=p_id;
  update public.business_salary_runs set reviewed_by=null,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id in (parent,previous);
 end if;
 return r;
end $$;

create function public.business_record_action(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_action text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;v jsonb;r jsonb;total numeric;tax numeric;received numeric;lines jsonb;line jsonb;journal uuid;account uuid;partner uuid;balance numeric;rowcount integer;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);perform public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 if p_expected_version is null or (v->>'row_version')::integer<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_action='approve' and p_kind in ('journal_entries','cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs','payments') then
  if v->>'status'<>'draft' or a.id=(v->>'created_by')::uuid then raise exception 'BUSINESS_REVIEW_REQUIRED';end if;
  execute format('update public.%I set reviewed_by=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,a.id;
 elsif p_kind='accounting_periods' and p_action='complete' then
  if a.role<>'owner' or v->>'status'<>'released' then raise exception 'BUSINESS_FORBIDDEN';end if;
  if exists(select 1 from public.business_journal_entries where tenant_id=a.tenant_id and period_id=p_id and status='draft') or exists(select 1 from (
 select posting_date from public.business_cash_vouchers where tenant_id=a.tenant_id and status='draft' union all select posting_date from public.business_vendor_invoices where tenant_id=a.tenant_id and status='draft' union all select posting_date from public.business_sales_invoices where tenant_id=a.tenant_id and status='draft' union all select paid_on from public.business_payments where tenant_id=a.tenant_id and status='draft' union all select paid_on from public.business_supplier_payments where tenant_id=a.tenant_id and status='draft' union all select posting_date from public.business_salary_runs where tenant_id=a.tenant_id and status='draft') d where d.posting_date between (v->>'starts_on')::date and (v->>'ends_on')::date) then raise exception 'BUSINESS_UNPOSTED_DOCUMENTS';end if;
  update public.business_accounting_periods set status='completed',row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=p_id;
 elsif p_action='post' and p_kind in ('journal_entries','cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs','purchase_receipts','timecards','payments') then
  if v->>'status'<>'draft' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if p_kind not in ('purchase_receipts','timecards') and (v->>'reviewed_by' is null or v->>'reviewed_by'=v->>'created_by') then raise exception 'BUSINESS_REVIEW_REQUIRED';end if;
  if p_kind='journal_entries' then
   if v->>'source_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   perform public.business_validate_journal(a.tenant_id,p_id);
  elsif p_kind='cash_vouchers' then
   if not exists(select 1 from public.business_gl_accounts where tenant_id=a.tenant_id and id=(v->>'cash_account_id')::uuid and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   if v->>'cash_account_id'=v->>'counter_account_id' then raise exception 'BUSINESS_INVALID_INPUT';end if;
   total:=(v->>'amount')::numeric;
   if v->>'direction'='out' then
    select coalesce(sum(l.debit-l.credit),0) into balance from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id where l.tenant_id=a.tenant_id and l.account_id=(v->>'cash_account_id')::uuid and j.status='posted' and j.posting_date<=(v->>'posting_date')::date;
    if balance<total then raise exception 'BUSINESS_INSUFFICIENT_FUNDS';end if;
   end if;
   lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'cash_account_id','debit',case v->>'direction' when 'in' then total else 0 end,'credit',case v->>'direction' when 'out' then total else 0 end,'partnerId',v->>'partner_id','projectId',v->>'project_id'),jsonb_build_object('accountId',v->>'counter_account_id','debit',case v->>'direction' when 'out' then total else 0 end,'credit',case v->>'direction' when 'in' then total else 0 end,'partnerId',v->>'partner_id','projectId',v->>'project_id'));
  elsif p_kind='vendor_invoices' then
   if v->>'purchase_order_id' is not null and not exists(select 1 from public.business_purchase_orders where tenant_id=a.tenant_id and id=(v->>'purchase_order_id')::uuid and partner_id=(v->>'partner_id')::uuid and status in ('released','completed')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   total:=(v->>'base_amount')::numeric;tax:=(v->>'tax_amount')::numeric;
   lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'expense_account_id','debit',total,'partnerId',v->>'partner_id'),jsonb_build_object('accountId',v->>'payable_account_id','credit',total+tax,'partnerId',v->>'partner_id'));
   if tax>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'tax_account_id','debit',tax,'partnerId',v->>'partner_id'));end if;
   insert into public.business_payables(tenant_id,code,name,created_by,status,partner_id,vendor_invoice_id,amount,due_date,gl_account_id) values(a.tenant_id,public.business_next_number(a.tenant_id,'CN',(v->>'document_date')::date),v->>'name',a.id,'posted',(v->>'partner_id')::uuid,p_id,total+tax,(v->>'due_date')::date,(v->>'payable_account_id')::uuid);
  elsif p_kind='sales_invoices' then
   select sum(quantity*unit_price) into total from public.business_sales_lines where tenant_id=a.tenant_id and sales_order_id=(v->>'sales_order_id')::uuid and status='active';
   if total is null or total<>(v->>'base_amount')::numeric or not exists(select 1 from public.business_sales_orders where tenant_id=a.tenant_id and id=(v->>'sales_order_id')::uuid and partner_id=(v->>'partner_id')::uuid and status in ('released','completed')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   tax:=(v->>'tax_amount')::numeric;
   lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'receivable_account_id','debit',total+tax,'partnerId',v->>'partner_id'),jsonb_build_object('accountId',v->>'revenue_account_id','credit',total,'partnerId',v->>'partner_id'));
   if tax>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'tax_account_id','credit',tax,'partnerId',v->>'partner_id'));end if;
   insert into public.business_receivables(tenant_id,code,name,created_by,status,partner_id,sales_order_id,amount,due_date,gl_account_id) values(a.tenant_id,public.business_next_number(a.tenant_id,'CN',(v->>'document_date')::date),v->>'name',a.id,'posted',(v->>'partner_id')::uuid,(v->>'sales_order_id')::uuid,total+tax,(v->>'due_date')::date,(v->>'receivable_account_id')::uuid);
  elsif p_kind='payments' then
   select amount-paid_amount,partner_id,gl_account_id into balance,partner,account from public.business_receivables where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid and status='posted' for update;
   total:=(v->>'amount')::numeric;
   if balance is null or total>balance or account is null then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
   if not exists(select 1 from public.business_gl_accounts where tenant_id=a.tenant_id and id=(v->>'cash_account_id')::uuid and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'cash_account_id','debit',total,'partnerId',partner),jsonb_build_object('accountId',account,'credit',total,'partnerId',partner));
   update public.business_receivables set paid_amount=paid_amount+total,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid;
  elsif p_kind='supplier_payments' then
   select amount-paid_amount,partner_id,gl_account_id into balance,partner,account from public.business_payables where tenant_id=a.tenant_id and id=(v->>'payable_id')::uuid and status='posted' for update;
   total:=(v->>'amount')::numeric;
   if balance is null or total>balance then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
   if not exists(select 1 from public.business_gl_accounts where tenant_id=a.tenant_id and id=(v->>'cash_account_id')::uuid and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   select coalesce(sum(l.debit-l.credit),0) into received from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id where l.tenant_id=a.tenant_id and l.account_id=(v->>'cash_account_id')::uuid and j.status='posted' and j.posting_date<=(v->>'paid_on')::date;
   if received<total then raise exception 'BUSINESS_INSUFFICIENT_FUNDS';end if;
   lines:=jsonb_build_array(jsonb_build_object('accountId',account,'debit',total,'partnerId',partner),jsonb_build_object('accountId',v->>'cash_account_id','credit',total,'partnerId',partner));
   update public.business_payables set paid_amount=paid_amount+total,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'payable_id')::uuid;
  elsif p_kind='purchase_receipts' then
   if not exists(select 1 from public.business_purchase_orders where tenant_id=a.tenant_id and id=(v->>'purchase_order_id')::uuid and status='released' and order_date<=(v->>'document_date')::date) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if (v->>'document_date')::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
   select coalesce(sum(quantity),0) into total from public.business_purchase_lines where tenant_id=a.tenant_id and purchase_order_id=(v->>'purchase_order_id')::uuid and item_id=(v->>'item_id')::uuid and status='active';
   select coalesce(sum(quantity),0) into received from public.business_purchase_receipts where tenant_id=a.tenant_id and purchase_order_id=(v->>'purchase_order_id')::uuid and item_id=(v->>'item_id')::uuid and status='posted';
   if total=0 or received+(v->>'quantity')::numeric>total then raise exception 'BUSINESS_RECEIPT_EXCEEDED';end if;
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'NM-'||p_id::text,v->>'name',a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'purchase_receipt',p_id);
  elsif p_kind='timecards' then
   if (v->>'work_date')::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date or (v->>'worked_hours')::numeric+(v->>'overtime_hours')::numeric>24 then raise exception 'BUSINESS_INVALID_INPUT';end if;
  elsif p_kind='salary_runs' then
   if (v->>'ends_on')::date>(v->>'posting_date')::date or exists(select 1 from public.business_salary_runs where tenant_id=a.tenant_id and id<>p_id and status='posted' and starts_on<=(v->>'ends_on')::date and ends_on>=(v->>'starts_on')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if exists(select 1 from public.business_salary_lines l where l.tenant_id=a.tenant_id and l.salary_run_id=p_id and l.status='active' and l.worked_days>(select coalesce(sum(t.worked_hours),0)/(v->>'standard_hours')::numeric from public.business_timecards t where t.tenant_id=l.tenant_id and t.staff_id=l.staff_id and t.status='posted' and t.work_date between (v->>'starts_on')::date and (v->>'ends_on')::date)) then raise exception 'BUSINESS_TIMECARDS_INCOMPLETE';end if;
   select sum(gross_amount),sum(net_amount),sum(deductions) into total,balance,tax from public.business_salary_lines where tenant_id=a.tenant_id and salary_run_id=p_id and status='active';
   if total is null or total<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
   lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'expense_account_id','debit',total),jsonb_build_object('accountId',v->>'payable_account_id','credit',balance));
   if tax>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'deduction_account_id','credit',tax));end if;
  end if;
  if lines is not null then journal:=public.business_generated_journal(a.tenant_id,(v->>'created_by')::uuid,(v->>'reviewed_by')::uuid,p_kind,p_id,v->>'name',coalesce(v->>'document_date',v->>'paid_on',v->>'posting_date')::date,coalesce(v->>'posting_date',v->>'paid_on')::date,case when p_kind='salary_runs' then 'payroll' when p_kind='cash_vouchers' then 'cash' when p_kind='vendor_invoices' then 'purchase' when p_kind='sales_invoices' then 'sales' else 'bank' end,lines);end if;
  execute format('update public.%I set status=''posted'',row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id;
 elsif p_action='reverse' and p_kind='purchase_receipts' then
  if a.role<>'owner' or v->>'status'<>'posted' then raise exception 'BUSINESS_FORBIDDEN';end if;
  perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
  insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,public.business_next_number(a.tenant_id,'DM',(now() at time zone 'Asia/Ho_Chi_Minh')::date),left('Đảo '||(v->>'name'),180),a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(now() at time zone 'Asia/Ho_Chi_Minh')::date,'purchase_return',p_id);
  update public.business_purchase_receipts set status='cancelled',row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=p_id;
  update public.business_purchase_orders set status='released',row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'purchase_order_id')::uuid and status='completed';
 elsif p_action='reverse' and p_kind in ('journal_entries','cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs','payments') then
  if a.role<>'owner' or v->>'status'<>'posted' then raise exception 'BUSINESS_FORBIDDEN';end if;
  if p_kind='journal_entries' then
   if v->>'source_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   journal:=public.business_reverse_journal(a.tenant_id,p_id,a.id,p_reason);
  else
   if p_kind='vendor_invoices' and exists(select 1 from public.business_payables where tenant_id=a.tenant_id and vendor_invoice_id=p_id and paid_amount>0) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if p_kind='sales_invoices' and exists(select 1 from public.business_receivables where tenant_id=a.tenant_id and sales_order_id=(v->>'sales_order_id')::uuid and paid_amount>0) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   select id into journal from public.business_journal_entries where tenant_id=a.tenant_id and source_kind=p_kind and source_id=p_id;
   journal:=public.business_reverse_journal(a.tenant_id,journal,a.id,p_reason);
   if p_kind='vendor_invoices' then update public.business_payables set status='cancelled',row_version=row_version+1 where tenant_id=a.tenant_id and vendor_invoice_id=p_id;end if;
   if p_kind='sales_invoices' then update public.business_receivables set status='cancelled',row_version=row_version+1 where tenant_id=a.tenant_id and sales_order_id=(v->>'sales_order_id')::uuid;end if;
   if p_kind='payments' then update public.business_receivables set paid_amount=paid_amount-(v->>'amount')::numeric,row_version=row_version+1 where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid;end if;
   if p_kind='supplier_payments' then update public.business_payables set paid_amount=paid_amount-(v->>'amount')::numeric,row_version=row_version+1 where tenant_id=a.tenant_id and id=(v->>'payable_id')::uuid;end if;
   execute format('update public.%I set status=''cancelled'',row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id;
  end if;
 else
  if p_kind='timecards' and p_action='reverse' and exists(select 1 from public.business_salary_runs r join public.business_salary_lines l on l.tenant_id=r.tenant_id and l.salary_run_id=r.id where r.tenant_id=a.tenant_id and r.status='posted' and l.staff_id=(v->>'staff_id')::uuid and (v->>'work_date')::date between r.starts_on and r.ends_on) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if p_kind='payables' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if p_kind='purchase_orders' and p_action='release' and not exists(select 1 from public.business_purchase_lines where tenant_id=a.tenant_id and purchase_order_id=p_id and status='active') then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  if p_kind='purchase_orders' and p_action='complete' and exists(select 1 from public.business_purchase_lines l where l.tenant_id=a.tenant_id and l.purchase_order_id=p_id and l.status='active' group by item_id having sum(quantity)>(select coalesce(sum(quantity),0) from public.business_purchase_receipts where tenant_id=a.tenant_id and purchase_order_id=p_id and item_id=l.item_id and status='posted')) then raise exception 'BUSINESS_DELIVERY_INCOMPLETE';end if;
  return public.business_record_action_core(p_hash,p_slug,p_kind,p_id,p_expected_version,p_action,p_reason,p_request_id,p_payload_hash);
 end if;
 r:=jsonb_build_object('recordId',p_id,'rowVersion',p_expected_version+1,'journalId',journal);
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'record.'||p_action,p_kind,p_id,jsonb_build_object('reason',p_reason,'journalId',journal));
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);return r;
end $$;

revoke all on function public.business_financial_line_guard(),public.business_validate_journal(uuid,uuid),public.business_generated_journal(uuid,uuid,uuid,text,uuid,text,date,date,text,jsonb),public.business_reverse_journal(uuid,uuid,uuid,text),public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) to service_role;

create or replace function public.business_configure_workspace(p_request_id uuid,p_customer_id uuid,p_customer_version integer,p_expected_version integer,p_industry text,p_features jsonb,p_system_name text,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.crm_customers%rowtype;t public.business_tenants%rowtype;pack public.business_industry_packs%rowtype;r jsonb;h text;entry record;has_data boolean;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 -- All operator configuration commands lock CRM before tenant.
 select * into c from public.crm_customers where id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select * into t from public.business_tenants where customer_id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||t.id,0));
 h:=encode(sha256(convert_to(jsonb_build_object('customer',p_customer_id,'customerVersion',p_customer_version,'version',p_expected_version,'industry',p_industry,'features',p_features,'systemName',p_system_name)::text,'UTF8')),'hex');
 r:=public.business_command_replay(p_request_id,t.id,p_actor_id,'workspace.configure',h);if r is not null then return r;end if;
 if p_expected_version is null or p_customer_version is null or t.row_version<>p_expected_version or c.row_version<>p_customer_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into pack from public.business_industry_packs where key=p_industry;
 if not found or p_system_name is null or char_length(btrim(p_system_name)) not between 2 and 100 or coalesce(jsonb_typeof(p_features),'')<>'array' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if jsonb_array_length(p_features) not between 1 and 11 or not(pack.features @> p_features) or exists(select 1 from jsonb_array_elements(p_features) f where jsonb_typeof(f)<>'string') or (select count(*)<>count(distinct value) from jsonb_array_elements(p_features)) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if (p_features ?| array['production','mes','traceability','quality','sales','projects'] and not(p_features ? 'inventory')) or (p_features ? 'mes' and not(p_features ? 'production')) or (p_features ? 'sales' and not(p_features ? 'crm')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 -- Prevent data from disappearing behind an industry switch or a disabled feature.
 for entry in select kind,definition from public.business_entity_definitions loop
  if (entry.definition->>'feature') in (select jsonb_array_elements_text(t.features)) and
    (not(p_features ? (entry.definition->>'feature')) or p_industry<>t.industry) then
   execute format('select exists(select 1 from public.%I where tenant_id=$1)',public.business_entity_table(entry.kind)) into has_data using t.id;
   if has_data then raise exception 'BUSINESS_CONFIGURATION_HAS_DATA';end if;
  end if;
 end loop;
 update public.business_tenants set industry=p_industry,features=p_features,system_name=btrim(p_system_name),row_version=row_version+1 where id=t.id;
 update public.crm_customers set profile=jsonb_set(profile,'{industry}',to_jsonb(p_industry)),setup=jsonb_set(jsonb_set(setup,'{industryPreset}',to_jsonb(p_industry)),'{systemName}',to_jsonb(btrim(p_system_name))),row_version=row_version+1,updated_at=now() where id=c.id;
 insert into public.business_audit(tenant_id,actor_id,action,details) values(t.id,p_actor_id,'workspace.configure',jsonb_build_object('industry',p_industry,'features',p_features,'requestId',p_request_id));
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),c.id,'updated','Đã đồng bộ gói ngành và module ERP',p_actor_id);
 r:=jsonb_build_object('tenantId',t.id,'rowVersion',t.row_version+1,'customerVersion',c.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'workspace.configure',h,r);return r;
end $$;

create or replace function public.business_provision_customer(p_request_id uuid,p_customer_id uuid,p_expected_version integer,p_config jsonb,p_password_hash text,p_payload_hash text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.crm_customers%rowtype;t public.business_tenants%rowtype;a public.business_accounts%rowtype;old public.business_commands%rowtype;pack public.business_industry_packs%rowtype;r jsonb;k text;
begin
 perform public.crm_assert_actor(p_actor_id,array['crm.view','crm.manage']);
 if p_request_id is null or p_customer_id is null or p_expected_version is null or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$'
 or coalesce(jsonb_typeof(p_config),'')<>'object' or (select count(*) from jsonb_object_keys(p_config))<>7
 or not(p_config ?& array['slug','industry','features','systemName','username','displayName','trialDays'])
 or p_password_hash is null or p_password_hash !~ '^scrypt\$65536\$8\$2\$[a-f0-9]{32}\$[a-f0-9]{128}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 select * into c from public.crm_customers where id=p_customer_id for update;
 if not found then raise exception 'BUSINESS_NOT_FOUND';end if;
 select * into old from public.business_commands where request_id=p_request_id;
 if found then
  if old.kind<>'provision' or old.actor_id<>p_actor_id or old.payload_hash<>p_payload_hash then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  if (old.receipt->>'customerId')::uuid<>p_customer_id then raise exception 'BUSINESS_COMMAND_CONFLICT';end if;
  return old.receipt;
 end if;

 if c.row_version<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if c.stage in ('closed','paused') then raise exception 'BUSINESS_CUSTOMER_CLOSED';end if;
 select * into pack from public.business_industry_packs where key=p_config->>'industry';
 if not found or coalesce(jsonb_typeof(p_config->'features'),'')<>'array' or jsonb_array_length(p_config->'features') not between 1 and 11 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from jsonb_array_elements(p_config->'features') f where jsonb_typeof(f)<>'string' or not(pack.features @> jsonb_build_array(f)))
 or (select count(*)<>count(distinct value) from jsonb_array_elements(p_config->'features')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if (p_config->'features' ?| array['production','mes','traceability','quality','sales','projects'] and not(p_config->'features' ? 'inventory')) or (p_config->'features' ? 'mes' and not(p_config->'features' ? 'production')) or (p_config->'features' ? 'sales' and not(p_config->'features' ? 'crm')) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 foreach k in array array['slug','industry','systemName','username','displayName'] loop
  if coalesce(jsonb_typeof(p_config->k),'')<>'string' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 end loop;
 if (p_config->>'slug') !~ '^[a-z][a-z0-9-]{2,39}$' or (p_config->>'username') !~ '^[a-z][a-z0-9._-]{2,31}$'
 or char_length(btrim(p_config->>'systemName')) not between 2 and 100 or char_length(btrim(p_config->>'displayName')) not between 2 and 100
 or coalesce(jsonb_typeof(p_config->'trialDays'),'')<>'number' or (p_config->>'trialDays') !~ '^[0-9]+$' or (p_config->>'trialDays')::numeric not between 1 and 90 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if exists(select 1 from public.business_tenants where customer_id=p_customer_id) then raise exception 'BUSINESS_ALREADY_PROVISIONED';end if;
 insert into public.business_tenants(customer_id,slug,name,system_name,industry,features,trial_ends_at)
 values(p_customer_id,p_config->>'slug',c.profile->>'companyName',btrim(p_config->>'systemName'),pack.key,p_config->'features',now()+make_interval(days=>(p_config->>'trialDays')::integer)) returning * into t;
 insert into public.business_accounts(tenant_id,username,display_name,password_hash) values(t.id,p_config->>'username',btrim(p_config->>'displayName'),p_password_hash) returning * into a;
 update public.crm_customers set profile=jsonb_set(profile,'{industry}',to_jsonb(pack.key)),setup=jsonb_set(setup,'{industryPreset}',to_jsonb(pack.key)),stage='trial',row_version=row_version+1,updated_at=now() where id=p_customer_id;
 insert into public.crm_activities(id,customer_id,kind,note,actor_id) values(gen_random_uuid(),p_customer_id,'stage','Đã cấp không gian dùng thử và tài khoản doanh nghiệp',p_actor_id);
 r:=jsonb_build_object('customerId',c.id,'tenantId',t.id,'slug',t.slug,'accountId',a.id,'username',a.username,'trialEndsAt',t.trial_ends_at,'rowVersion',c.row_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,t.id,p_actor_id,'provision',p_payload_hash,r);
 insert into public.audit_logs(actor_account_id,action,entity_type,entity_id,after_data) values(p_actor_id,'business.provision','crm_customer',c.id::text,jsonb_build_object('tenantId',t.id,'industry',t.industry,'accountId',a.id));
 return r;
exception when unique_violation then raise exception 'BUSINESS_DUPLICATE';
end $$;

create or replace function public.business_record_action_core(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_action text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;v jsonb;r jsonb;new_state text;wo public.business_work_orders%rowtype;ar public.business_receivables%rowtype;op public.business_operations%rowtype;wc public.business_work_centers%rowtype;total numeric;reverse_id uuid;snapshot jsonb;t public.business_tenants%rowtype;item uuid;received numeric;produced numeric;prior numeric;issued numeric;move public.business_stock_moves%rowtype;link record;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 or p_expected_version is null or p_expected_version<1 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 execute format('select to_jsonb(t) from public.%I t where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 if (v->>'row_version')::integer<>p_expected_version then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 select * into t from public.business_tenants where id=a.tenant_id;
 if p_action='post' and d->>'mode'='document' then
  perform public.business_assert_kind(a.tenant_id,p_kind);
  if coalesce(v->>'document_date',v->>'report_date',v->>'checked_on',v->>'paid_on',v->>'occurred_on',v->>'reported_on')::date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 end if;
 if p_action='cancel' and d->>'mode'<>'master' and v->>'status'='draft' then new_state:='cancelled';
 elsif p_action='release' and d->>'mode'='order' and v->>'status'='draft' then
  new_state:='released';
  if p_kind='work_orders' then
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=p_id;
   if wo.bom_id is null then raise exception 'BUSINESS_BOM_EMPTY';end if;
   if not exists(select 1 from public.business_boms where tenant_id=a.tenant_id and id=wo.bom_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   if exists(select 1 from public.business_operations o join public.business_work_centers c on c.tenant_id=o.tenant_id and c.id=o.work_center_id where o.tenant_id=a.tenant_id and o.work_order_id=p_id and c.status<>'active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   if t.features ? 'mes' and not exists(select 1 from public.business_operations where tenant_id=a.tenant_id and work_order_id=p_id and status='active') then raise exception 'BUSINESS_OPERATION_REQUIRED';end if;
   if t.industry='plastics_packaging' and wo.mold_id is null then raise exception 'BUSINESS_MOLD_REQUIRED';end if;
   if wo.mold_id is not null then
    if not exists(select 1 from public.business_molds where tenant_id=a.tenant_id and id=wo.mold_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
    update public.business_work_orders set mold_snapshot=(select jsonb_build_object('code',code,'cavities',cavities,'cycleSeconds',cycle_seconds) from public.business_molds where tenant_id=a.tenant_id and id=wo.mold_id and status='active') where tenant_id=a.tenant_id and id=p_id;
   end if;
   update public.business_operations o set labor_rate_snapshot=w.labor_rate,machine_rate_snapshot=w.machine_rate from public.business_work_centers w where o.tenant_id=a.tenant_id and o.work_order_id=p_id and w.tenant_id=o.tenant_id and w.id=o.work_center_id;
   if t.industry in ('electronics','food_beverage') and exists(select 1 from public.business_items where tenant_id=a.tenant_id and id=wo.item_id and tracking='none') then raise exception 'BUSINESS_LOT_REQUIRED';end if;
   if wo.bom_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('itemId',l.item_id,'quantity',l.quantity*wo.quantity/b.output_quantity,'wastePercent',l.waste_percent)),'[]'::jsonb) into snapshot from public.business_bom_lines l join public.business_boms b on b.tenant_id=l.tenant_id and b.id=l.bom_id where l.tenant_id=a.tenant_id and b.id=wo.bom_id and l.status='active';
    if jsonb_array_length(snapshot)=0 then raise exception 'BUSINESS_BOM_EMPTY';end if;
    update public.business_work_orders set bom_snapshot=snapshot where tenant_id=a.tenant_id and id=p_id;
   end if;
  elsif p_kind='sales_orders' then
   select sum(quantity*unit_price) into total from public.business_sales_lines where tenant_id=a.tenant_id and sales_order_id=p_id and status='active';
   if total is null or total<=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  end if;
 elsif p_action='complete' and d->>'mode'='order' and v->>'status'='released' then
  new_state:='completed';
  if p_kind='work_orders' then
   if public.business_terminal_quantity(a.tenant_id,p_id)<(v->>'quantity')::numeric or (select coalesce(sum(quantity),0) from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=p_id and status='posted')<(v->>'quantity')::numeric then raise exception 'BUSINESS_PRODUCTION_INCOMPLETE';end if;
   if t.features ? 'quality' and exists(select 1 from public.business_production_receipts r join public.business_lots l on l.tenant_id=r.tenant_id and l.id=r.lot_id where r.tenant_id=a.tenant_id and r.work_order_id=p_id and r.status='posted' and l.quality_state<>'released') then raise exception 'BUSINESS_LOT_BLOCKED';end if;
  end if;
  if p_kind='sales_orders' and exists(select 1 from public.business_sales_lines l where l.tenant_id=a.tenant_id and sales_order_id=p_id and status='active' group by item_id having sum(quantity)>(select coalesce(sum(case m.direction when 'out' then m.quantity else -m.quantity end),0) from public.business_stock_moves m where m.tenant_id=a.tenant_id and m.sales_order_id=p_id and m.item_id=l.item_id and m.status='posted')) then raise exception 'BUSINESS_DELIVERY_INCOMPLETE';end if;
 elsif p_action='post' and d->>'mode'='document' and v->>'status'='draft' then
  new_state:='posted';
  if p_kind='stock_moves' then
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,v->>'direction',(v->>'quantity')::numeric,(v->>'document_date')::date);
   if v->>'sales_order_id' is not null and not exists(select 1 from public.business_sales_orders where tenant_id=a.tenant_id and id=(v->>'sales_order_id')::uuid and status in ('released','completed')) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  elsif p_kind='production_receipts' then
   perform public.business_assert_kind(a.tenant_id,'stock_moves');
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid and status='released';
   if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   produced:=public.business_terminal_quantity(a.tenant_id,wo.id);
   select coalesce(sum(quantity),0) into received from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted';
   if received+(v->>'quantity')::numeric>least(produced,wo.quantity) then raise exception 'BUSINESS_RECEIPT_EXCEEDED';end if;
   if exists(select 1 from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted' and report_date>(v->>'document_date')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if exists(select 1 from (select (x->>'itemId')::uuid item_id,sum((x->>'quantity')::numeric) required from jsonb_array_elements(wo.bom_snapshot) x group by (x->>'itemId')::uuid) b where b.required>(select coalesce(sum(m.quantity),0) from public.business_material_issues m where m.tenant_id=a.tenant_id and m.work_order_id=wo.id and m.item_id=b.item_id and m.status='posted')) then raise exception 'BUSINESS_MATERIAL_INCOMPLETE';end if;
   if exists(select 1 from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted' and document_date>(v->>'document_date')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if (t.features ? 'quality' or t.features ? 'traceability') and v->>'lot_id' is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
   perform public.business_check_stock(a.tenant_id,wo.item_id,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'FG-'||p_id::text,v->>'name',a.id,'posted',wo.item_id,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'in',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'production_receipt',p_id);
   if t.features ? 'traceability' then
    for link in select lot_id,sum(quantity) quantity from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted' group by lot_id loop
     if link.lot_id is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
     if link.lot_id=(v->>'lot_id')::uuid or exists(with recursive walk(id) as (select link.lot_id union select l.component_lot_id from public.business_lot_links l join walk w on l.assembly_lot_id=w.id where l.tenant_id=a.tenant_id and l.status='posted') select 1 from walk where id=(v->>'lot_id')::uuid) then raise exception 'BUSINESS_CYCLE';end if;
     insert into public.business_lot_links(tenant_id,code,name,created_by,status,assembly_lot_id,component_lot_id,quantity,source_receipt_id) values(a.tenant_id,'TR-'||gen_random_uuid()::text,'Truy xuất '||(v->>'code'),a.id,'posted',(v->>'lot_id')::uuid,link.lot_id,greatest(0,round(link.quantity*(received+(v->>'quantity')::numeric)/wo.quantity,4)-(select coalesce(sum(z.quantity),0) from public.business_lot_links z join public.business_production_receipts pr on pr.tenant_id=z.tenant_id and pr.id=z.source_receipt_id where z.tenant_id=a.tenant_id and z.component_lot_id=link.lot_id and z.status='posted' and pr.work_order_id=wo.id and pr.status='posted')),p_id);
    end loop;
   end if;
  elsif p_kind='project_materials' then
   perform public.business_assert_kind(a.tenant_id,'stock_moves');
   if not exists(select 1 from public.business_projects where tenant_id=a.tenant_id and id=(v->>'project_id')::uuid and status='active' and starts_on<=(v->>'document_date')::date) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'PM-'||p_id::text,v->>'name',a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'project_material',p_id);
  elsif p_kind='material_issues' then
   perform public.business_assert_kind(a.tenant_id,'stock_moves');
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid;
   if exists(select 1 from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   select sum((x->>'quantity')::numeric*(1+(x->>'wastePercent')::numeric/100)) into prior from jsonb_array_elements(wo.bom_snapshot) x where x->>'itemId'=v->>'item_id';
   if prior is null then raise exception 'BUSINESS_MATERIAL_NOT_IN_BOM';end if;
   select coalesce(sum(quantity),0) into issued from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=wo.id and item_id=(v->>'item_id')::uuid and status='posted';
   if issued+(v->>'quantity')::numeric>round(prior,4) then raise exception 'BUSINESS_MATERIAL_EXCEEDED';end if;
   if t.features ? 'traceability' and v->>'lot_id' is null then raise exception 'BUSINESS_LOT_REQUIRED';end if;
   if not exists(select 1 from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid and status='released') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'document_date')::date);
   insert into public.business_stock_moves(tenant_id,code,name,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(a.tenant_id,'MI-'||p_id::text,v->>'name',a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,'out',(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(v->>'document_date')::date,'material_issue',p_id);
  elsif p_kind='production_reports' then
   if not exists(select 1 from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid and status='released') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid;
   if exists(select 1 from public.business_operations where tenant_id=a.tenant_id and work_order_id=wo.id and status='active') and v->>'operation_id' is null then raise exception 'BUSINESS_OPERATION_REQUIRED';end if;
   select coalesce(sum(good_quantity),0) into prior from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=wo.id and operation_id is not distinct from (v->>'operation_id')::uuid and status='posted';
   if (v->>'operation_id')::uuid is not distinct from (select id from public.business_operations where tenant_id=a.tenant_id and work_order_id=wo.id and status='active' order by sequence desc limit 1) and prior+(v->>'good_quantity')::numeric>wo.quantity then raise exception 'BUSINESS_PRODUCTION_EXCEEDED';end if;
   if v->>'operation_id' is not null then
    select * into op from public.business_operations where tenant_id=a.tenant_id and id=(v->>'operation_id')::uuid and work_order_id=wo.id and status='active';
    if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
    select id into item from public.business_operations where tenant_id=a.tenant_id and work_order_id=wo.id and status='active' and sequence<op.sequence order by sequence desc limit 1;
    if item is not null and prior+(v->>'good_quantity')::numeric+(v->>'scrap_quantity')::numeric+(select coalesce(sum(scrap_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and operation_id=op.id and status='posted')>(select coalesce(sum(good_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and operation_id=item and status='posted' and report_date<=(v->>'report_date')::date) then raise exception 'BUSINESS_PREVIOUS_OPERATION_INCOMPLETE';end if;
   end if;
   if (v->>'good_quantity')::numeric+(v->>'scrap_quantity')::numeric+(v->>'labor_hours')::numeric+(v->>'machine_hours')::numeric<=0 then raise exception 'BUSINESS_INVALID_INPUT';end if;
   if v->>'operation_id' is not null then
    select * into op from public.business_operations where tenant_id=a.tenant_id and id=(v->>'operation_id')::uuid and work_order_id=(v->>'work_order_id')::uuid;
    if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
    select * into wc from public.business_work_centers where tenant_id=a.tenant_id and id=op.work_center_id;
    update public.business_production_reports set labor_cost=labor_hours*coalesce(op.labor_rate_snapshot,wc.labor_rate),machine_cost=machine_hours*coalesce(op.machine_rate_snapshot,wc.machine_rate) where tenant_id=a.tenant_id and id=p_id;
   elsif (v->>'labor_hours')::numeric+(v->>'machine_hours')::numeric>0 then raise exception 'BUSINESS_OPERATION_REQUIRED';end if;
  elsif p_kind in ('project_costs','project_updates') then
   if not exists(select 1 from public.business_projects where tenant_id=a.tenant_id and id=(v->>'project_id')::uuid and status='active' and starts_on<=coalesce(v->>'occurred_on',v->>'reported_on')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
  elsif p_kind='quality_checks' then
   if not exists(select 1 from public.business_lots where tenant_id=a.tenant_id and id=(v->>'lot_id')::uuid and manufactured_on<=(v->>'checked_on')::date and (expires_on is null or expires_on>=(v->>'checked_on')::date)) then raise exception 'BUSINESS_INVALID_DATE';end if;
   if exists(select 1 from public.business_quality_checks where tenant_id=a.tenant_id and lot_id=(v->>'lot_id')::uuid and status='posted' and checked_on>(v->>'checked_on')::date) then raise exception 'BUSINESS_INVALID_DATE';end if;
   update public.business_lots set quality_state=case v->>'result' when 'passed' then 'released' else 'rejected' end,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'lot_id')::uuid;
  elsif p_kind='lot_links' then
   if v->>'assembly_lot_id'=v->>'component_lot_id' or exists(with recursive walk(id) as (select (v->>'component_lot_id')::uuid union select l.component_lot_id from public.business_lot_links l join walk w on l.assembly_lot_id=w.id where l.tenant_id=a.tenant_id and l.status='posted') select 1 from walk where id=(v->>'assembly_lot_id')::uuid) then raise exception 'BUSINESS_CYCLE';end if;
  elsif p_kind='receivables' and v->>'sales_order_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';
  elsif p_kind='payments' then
   select * into ar from public.business_receivables where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid and status='posted' for update;
   if not found or (v->>'amount')::numeric>ar.amount-ar.paid_amount then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
   update public.business_receivables set paid_amount=paid_amount+(v->>'amount')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=ar.id;
  end if;
 elsif p_action='reverse' and d->>'mode'='document' and p_kind<>'stock_moves' and v->>'status'='posted' then
  new_state:='cancelled';
  if p_kind in ('production_receipts','material_issues','production_reports') then
   select * into wo from public.business_work_orders where tenant_id=a.tenant_id and id=(v->>'work_order_id')::uuid;
   if wo.status<>'released' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if p_kind<>'production_receipts' and exists(select 1 from public.business_production_receipts where tenant_id=a.tenant_id and work_order_id=wo.id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if p_kind='production_reports' and exists(select 1 from public.business_production_reports r join public.business_operations o on o.tenant_id=r.tenant_id and o.id=r.operation_id where r.tenant_id=a.tenant_id and r.work_order_id=wo.id and r.status='posted' and o.sequence>(select sequence from public.business_operations where tenant_id=a.tenant_id and id=(v->>'operation_id')::uuid)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  end if;
  if p_kind in ('production_receipts','material_issues','project_materials') then
   select * into move from public.business_stock_moves where tenant_id=a.tenant_id and source_id=p_id and source_kind=case p_kind when 'production_receipts' then 'production_receipt' when 'material_issues' then 'material_issue' else 'project_material' end and status='posted' and reversed_by is null;
   if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   reverse_id:=gen_random_uuid();
   -- Receipts may be recalled from quarantine; consumed stock is never allowed below zero.
   if move.direction='in' then
    select coalesce(sum(case direction when 'in' then quantity else -quantity end),0) into prior from public.business_stock_moves where tenant_id=a.tenant_id and item_id=move.item_id and warehouse_id=move.warehouse_id and lot_id is not distinct from move.lot_id and status='posted';
    if prior<move.quantity then raise exception 'BUSINESS_INSUFFICIENT_STOCK';end if;
   else
    perform public.business_check_stock(a.tenant_id,move.item_id,move.warehouse_id,move.lot_id,'in',move.quantity,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
   end if;
   insert into public.business_stock_moves(id,tenant_id,code,name,notes,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id) values(reverse_id,a.tenant_id,'RV-'||move.id::text,'Đảo '||(v->>'code'),p_reason,a.id,'posted',move.item_id,move.warehouse_id,move.lot_id,case move.direction when 'in' then 'out' else 'in' end,move.quantity,move.unit_cost,(now() at time zone 'Asia/Ho_Chi_Minh')::date,'reversal',move.id);
   update public.business_stock_moves set reversed_by=reverse_id,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=move.id;
   if p_kind='production_receipts' then update public.business_lot_links set status='cancelled',row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and source_receipt_id=p_id and status='posted';end if;
  elsif p_kind='payments' then
   update public.business_receivables set paid_amount=paid_amount-(v->>'amount')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'receivable_id')::uuid;
  elsif p_kind='receivables' then
   if v->>'sales_order_id' is not null or (v->>'paid_amount')::numeric>0 then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  elsif p_kind='quality_checks' then
   if exists(select 1 from public.business_stock_moves where tenant_id=a.tenant_id and lot_id=(v->>'lot_id')::uuid and direction='out' and status='posted' and source_kind is distinct from 'reversal') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   update public.business_lots set quality_state=coalesce((select case result when 'passed' then 'released' else 'rejected' end from public.business_quality_checks where tenant_id=a.tenant_id and lot_id=(v->>'lot_id')::uuid and id<>p_id and status='posted' order by checked_on desc,created_at desc limit 1),'quarantine'),row_version=row_version+1,updated_at=now() where tenant_id=a.tenant_id and id=(v->>'lot_id')::uuid;
  elsif p_kind='lot_links' and v->>'source_receipt_id' is not null then raise exception 'BUSINESS_RECORD_LOCKED';
  end if;
 elsif p_action='reverse' and p_kind='stock_moves' and v->>'status'='posted' and v->>'reversed_by' is null and v->>'source_id' is null then
  reverse_id:=gen_random_uuid();new_state:='posted';
  perform public.business_check_stock(a.tenant_id,(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,case v->>'direction' when 'in' then 'out' else 'in' end,(v->>'quantity')::numeric,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
  insert into public.business_stock_moves(id,tenant_id,code,name,notes,created_by,status,item_id,warehouse_id,lot_id,direction,quantity,unit_cost,document_date,source_kind,source_id,sales_order_id) values(reverse_id,a.tenant_id,'RV-'||p_id::text,'Đảo '||(v->>'code'),p_reason,a.id,'posted',(v->>'item_id')::uuid,(v->>'warehouse_id')::uuid,(v->>'lot_id')::uuid,case v->>'direction' when 'in' then 'out' else 'in' end,(v->>'quantity')::numeric,(v->>'unit_cost')::numeric,(now() at time zone 'Asia/Ho_Chi_Minh')::date,'reversal',p_id,(v->>'sales_order_id')::uuid);
  update public.business_stock_moves set reversed_by=reverse_id where tenant_id=a.tenant_id and id=p_id;
 else raise exception 'BUSINESS_INVALID_TRANSITION';end if;
 execute format('update public.%I set status=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,new_state;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'record.'||p_action,p_kind,p_id,jsonb_build_object('reason',p_reason,'rowVersion',p_expected_version+1));
 r:=jsonb_build_object('recordId',p_id,'rowVersion',p_expected_version+1);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);return r;
exception when unique_violation then raise exception 'BUSINESS_DUPLICATE';when check_violation or not_null_violation or numeric_value_out_of_range then raise exception 'BUSINESS_INVALID_INPUT';
end $$;
