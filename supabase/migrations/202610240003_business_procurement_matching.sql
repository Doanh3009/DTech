-- A linked purchase invoice cannot exceed the remaining approved order value.
-- Receiving and invoicing remain separate events; invoice-before-receipt is visible, not prohibited.
create function public.business_guard_purchase_invoice_value() returns trigger language plpgsql security definer set search_path='' as $$
declare ordered numeric;billed numeric;
begin
 if new.status='posted' and old.status<>'posted' and new.purchase_order_id is not null then
  perform 1 from public.business_purchase_orders where tenant_id=new.tenant_id and id=new.purchase_order_id for update;
  select coalesce(sum(quantity*unit_price),0) into ordered from public.business_purchase_lines where tenant_id=new.tenant_id and purchase_order_id=new.purchase_order_id and status='active';
  select coalesce(sum(base_amount),0) into billed from public.business_vendor_invoices where tenant_id=new.tenant_id and purchase_order_id=new.purchase_order_id and id<>new.id and status='posted';
  if new.base_amount+billed>ordered then raise exception 'BUSINESS_PURCHASE_INVOICE_EXCEEDED';end if;
 end if;
 return new;
end $$;
revoke all on function public.business_guard_purchase_invoice_value() from public,anon,authenticated,service_role;
create trigger business_purchase_invoice_value before update on public.business_vendor_invoices for each row execute function public.business_guard_purchase_invoice_value();

create function public.business_procurement_matching(p_hash text,p_slug text,p_page integer default 1,p_query text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;r jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);select * into t from public.business_tenants where id=a.tenant_id;
 if not(t.features ? 'purchasing') then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_page is null or p_page<1 or p_page>100000 or p_query is null or char_length(p_query)>100 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 with ordered as (
  select purchase_order_id,item_id,sum(quantity) quantity,sum(quantity*unit_price) amount from public.business_purchase_lines where tenant_id=a.tenant_id and status='active' group by purchase_order_id,item_id
 ), received as (
  select purchase_order_id,item_id,sum(quantity) quantity,sum(quantity*unit_cost) amount from public.business_purchase_receipts where tenant_id=a.tenant_id and status='posted' group by purchase_order_id,item_id
 ), values_by_order as (
  select l.purchase_order_id,sum(l.amount) ordered,sum(coalesce(r.quantity,0)*l.amount/nullif(l.quantity,0)) received_agreed,sum(coalesce(r.amount,0)) received_actual
  from ordered l left join received r on r.purchase_order_id=l.purchase_order_id and r.item_id=l.item_id group by l.purchase_order_id
 ), invoices as (
  select i.purchase_order_id,sum(i.base_amount) invoiced,sum(coalesce(p.amount-p.paid_amount,0)) payable from public.business_vendor_invoices i left join public.business_payables p on p.tenant_id=i.tenant_id and p.vendor_invoice_id=i.id and p.status='posted'
  where i.tenant_id=a.tenant_id and i.status='posted' and t.features ? 'accounting' group by i.purchase_order_id
 ), matched as (
  select o.id,o.code,o.name,o.expected_on,p.name supplier,coalesce(v.ordered,0) ordered,coalesce(v.received_agreed,0) received_agreed,coalesce(v.received_actual,0) received_actual,
   case when t.features ? 'accounting' then coalesce(i.invoiced,0) else null end invoiced,case when t.features ? 'accounting' then coalesce(i.payable,0) else null end payable,
   case when i.invoiced>v.ordered then 'over_invoiced' when i.invoiced>v.received_agreed then 'invoice_ahead_receipt' when abs(v.received_actual-v.received_agreed)>=1 then 'price_variance' when v.received_agreed<v.ordered then 'awaiting_receipt' when t.features ? 'accounting' and coalesce(i.invoiced,0)<v.ordered then 'awaiting_invoice' else 'matched' end match_state
  from public.business_purchase_orders o join public.business_tenant_partners p on p.tenant_id=o.tenant_id and p.id=o.partner_id left join values_by_order v on v.purchase_order_id=o.id left join invoices i on i.purchase_order_id=o.id
  where o.tenant_id=a.tenant_id and o.status in ('released','completed') and (p_query='' or position(lower(p_query) in lower(o.code||' '||o.name||' '||p.name))>0)
 ), totals as (
  select count(*) count,coalesce(sum(ordered),0) ordered,coalesce(sum(received_actual),0) received_actual,case when t.features ? 'accounting' then coalesce(sum(invoiced),0) else null end invoiced,case when t.features ? 'accounting' then coalesce(sum(payable),0) else null end payable,count(*) filter(where match_state in ('over_invoiced','invoice_ahead_receipt','price_variance')) discrepancies from matched
 ) select jsonb_build_object('totals',(select to_jsonb(totals) from totals),'rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from matched order by expected_on,code,id offset (p_page-1)*25 limit 25) x),'[]'),'accountingEnabled',t.features ? 'accounting') into r;
 return r;
end $$;
revoke all on function public.business_procurement_matching(text,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.business_procurement_matching(text,text,integer,text) to service_role;
