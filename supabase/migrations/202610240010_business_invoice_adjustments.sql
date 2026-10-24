alter table public.business_receivables drop constraint business_receivables_amount_check;
alter table public.business_receivables add constraint business_receivables_amount_check check(amount>=0);
alter table public.business_payables drop constraint business_payables_amount_check;
alter table public.business_payables add constraint business_payables_amount_check check(amount>=0);

create function public.business_invoice_adjustment_effect(p_tenant uuid,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare inv jsonb;credit_note public.business_invoice_adjustments%rowtype;ar jsonb;total numeric;offset_amount numeric;unused numeric;already_base numeric;already_tax numeric;side text:=v->>'side';lines jsonb:='[]';account uuid;kind text;
begin
 if v ? 'adjustment_id' then
  select * into credit_note from public.business_invoice_adjustments where tenant_id=p_tenant and id=(v->>'adjustment_id')::uuid and status='posted' for update;
  if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if p_action='reverse' then return '{}';end if;
  select coalesce(sum(amount),0) into unused from public.business_invoice_refunds where tenant_id=p_tenant and adjustment_id=credit_note.id and status='posted';
  if unused+(v->>'amount')::numeric>credit_note.refund_credit then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
  if credit_note.side='sale' then
   select to_jsonb(i) into inv from public.business_sales_invoices i where tenant_id=p_tenant and id=credit_note.sales_invoice_id;
   perform public.business_cash_available(p_tenant,(v->>'cash_account_id')::uuid,(v->>'posting_date')::date,(v->>'amount')::numeric);
   account:=(inv->>'receivable_account_id')::uuid;
   lines:=jsonb_build_array(jsonb_build_object('accountId',account,'debit',(v->>'amount')::numeric,'partnerId',inv->>'partner_id'),jsonb_build_object('accountId',v->>'cash_account_id','credit',(v->>'amount')::numeric,'partnerId',inv->>'partner_id'));
  else
   select to_jsonb(i) into inv from public.business_vendor_invoices i where tenant_id=p_tenant and id=credit_note.vendor_invoice_id;
   if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=(v->>'cash_account_id')::uuid and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   account:=(inv->>'payable_account_id')::uuid;
   lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'cash_account_id','debit',(v->>'amount')::numeric,'partnerId',inv->>'partner_id'),jsonb_build_object('accountId',account,'credit',(v->>'amount')::numeric,'partnerId',inv->>'partner_id'));
  end if;
  return jsonb_build_object('lines',lines);
 end if;
 if side='sale' then
  select to_jsonb(i) into inv from public.business_sales_invoices i where tenant_id=p_tenant and id=(v->>'sales_invoice_id')::uuid and status='posted' for update;
  select to_jsonb(r) into ar from public.business_receivables r where tenant_id=p_tenant and sales_order_id=(inv->>'sales_order_id')::uuid and status='posted' for update;
 else
  select to_jsonb(i) into inv from public.business_vendor_invoices i where tenant_id=p_tenant and id=(v->>'vendor_invoice_id')::uuid and status='posted' for update;
  select to_jsonb(r) into ar from public.business_payables r where tenant_id=p_tenant and vendor_invoice_id=(inv->>'id')::uuid and status='posted' for update;
 end if;
 if inv is null or ar is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if p_action='reverse' then
  if exists(select 1 from public.business_invoice_refunds where tenant_id=p_tenant and adjustment_id=(v->>'id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if side='sale' then update public.business_receivables set amount=amount+(v->>'unpaid_offset')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(ar->>'id')::uuid;
  else update public.business_payables set amount=amount+(v->>'unpaid_offset')::numeric,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(ar->>'id')::uuid;end if;
  return '{}';
 end if;
 if (v->>'document_date')::date<(inv->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 select coalesce(sum(base_amount),0),coalesce(sum(tax_amount),0) into already_base,already_tax from public.business_invoice_adjustments where tenant_id=p_tenant and status='posted' and (case when v->>'side'='sale' then sales_invoice_id=(inv->>'id')::uuid else vendor_invoice_id=(inv->>'id')::uuid end);
 if already_base+(v->>'base_amount')::numeric>(inv->>'base_amount')::numeric or already_tax+(v->>'tax_amount')::numeric>(inv->>'tax_amount')::numeric then raise exception 'BUSINESS_CREDIT_EXCEEDED';end if;
 total:=(v->>'base_amount')::numeric+(v->>'tax_amount')::numeric;offset_amount:=least(total,(ar->>'amount')::numeric-(ar->>'paid_amount')::numeric);
 if side='sale' then
  lines:=jsonb_build_array(jsonb_build_object('accountId',inv->>'revenue_account_id','debit',(v->>'base_amount')::numeric,'partnerId',inv->>'partner_id'),jsonb_build_object('accountId',inv->>'receivable_account_id','credit',total,'partnerId',inv->>'partner_id'));
  if (v->>'tax_amount')::numeric>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',inv->>'tax_account_id','debit',(v->>'tax_amount')::numeric,'partnerId',inv->>'partner_id'));end if;
  update public.business_receivables set amount=amount-offset_amount,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(ar->>'id')::uuid;
 else
  lines:=jsonb_build_array(jsonb_build_object('accountId',inv->>'payable_account_id','debit',total,'partnerId',inv->>'partner_id'),jsonb_build_object('accountId',inv->>'expense_account_id','credit',(v->>'base_amount')::numeric,'partnerId',inv->>'partner_id'));
  if (v->>'tax_amount')::numeric>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',inv->>'tax_account_id','credit',(v->>'tax_amount')::numeric,'partnerId',inv->>'partner_id'));end if;
  update public.business_payables set amount=amount-offset_amount,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(ar->>'id')::uuid;
 end if;
 update public.business_invoice_adjustments set unpaid_offset=offset_amount,refund_credit=total-offset_amount where tenant_id=p_tenant and id=(v->>'id')::uuid;
 return jsonb_build_object('lines',lines,'snapshot',jsonb_build_object('originalInvoiceId',inv->>'id','unpaidOffset',offset_amount,'refundCredit',total-offset_amount));
end $$;
revoke all on function public.business_invoice_adjustment_effect(uuid,jsonb,text) from public,anon,authenticated,service_role;

create function public.business_guard_invoice_adjustment_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='posted' and new.status<>'posted' and exists(select 1 from public.business_invoice_adjustments where tenant_id=old.tenant_id and status='posted' and case tg_table_name when 'business_sales_invoices' then sales_invoice_id=old.id else vendor_invoice_id=old.id end) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_guard_invoice_adjustment_source() from public,anon,authenticated,service_role;
create trigger business_guard_sales_adjustment_source before update on public.business_sales_invoices for each row execute function public.business_guard_invoice_adjustment_source();
create trigger business_guard_purchase_adjustment_source before update on public.business_vendor_invoices for each row execute function public.business_guard_invoice_adjustment_source();
