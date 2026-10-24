-- Company read model: full aggregates; bounded detail lists never feed KPI totals.
-- Outstanding balances and operating queues are current; flows use the selected month.
create function public.business_company_dashboard(p_hash text,p_slug text,p_month date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 a public.business_accounts%rowtype;t public.business_tenants%rowtype;
 today date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;start_on date;end_on date;
 finance jsonb;trend jsonb;work jsonb;alerts jsonb;stock jsonb;queues jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 select * into t from public.business_tenants where id=a.tenant_id;
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month>today or p_month<today-interval '10 years' then raise exception 'BUSINESS_INVALID_DATE';end if;
 start_on:=p_month;end_on:=least((p_month+interval '1 month - 1 day')::date,today);
 if t.features ? 'accounting' then
  with lines as (
   select j.id,j.posting_date,j.document_type,g.code,l.debit,l.credit
   from public.business_journal_entries j join public.business_journal_lines l on l.tenant_id=j.tenant_id and l.journal_id=j.id and l.status='active'
   join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id
   where j.tenant_id=a.tenant_id and j.status='posted' and j.posting_date<=today
  ), cash as (
   select id,posting_date,sum(debit-credit) delta from lines where (code like '111%' or code like '112%') and document_type<>'opening' group by id,posting_date
  ) select jsonb_build_object(
   'revenue',coalesce((select sum(credit-debit) from lines where (code like '511%' or code like '521%') and document_type<>'opening' and posting_date between start_on and end_on),0),
   'cashIn',coalesce((select sum(greatest(delta,0)) from cash where posting_date between start_on and end_on),0),
   'cashOut',coalesce((select sum(greatest(-delta,0)) from cash where posting_date between start_on and end_on),0),
   'cashBalance',coalesce((select sum(debit-credit) from lines where code like '111%' or code like '112%'),0),
   'receivables',coalesce((select sum(amount-paid_amount) from public.business_receivables where tenant_id=a.tenant_id and status='posted'),0),
   'overdue',coalesce((select sum(amount-paid_amount) from public.business_receivables where tenant_id=a.tenant_id and status='posted' and due_date<today),0),
   'payables',coalesce((select sum(amount-paid_amount) from public.business_payables where tenant_id=a.tenant_id and status='posted'),0)
  ) into finance;
  with buckets as (select d::date starts_on,least((d+interval '6 days')::date,end_on) ends_on from generate_series(start_on,end_on,interval '7 days') d),
  journal as (
   select j.id,j.posting_date,
    sum(case when g.code like '111%' or g.code like '112%' then l.debit-l.credit else 0 end) cash,
    sum(case when g.code like '511%' or g.code like '521%' then l.credit-l.debit else 0 end) revenue
   from public.business_journal_entries j join public.business_journal_lines l on l.tenant_id=j.tenant_id and l.journal_id=j.id and l.status='active'
   join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id
   where j.tenant_id=a.tenant_id and j.status='posted' and j.document_type<>'opening' and j.posting_date between start_on and end_on group by j.id
  ) select coalesce(jsonb_agg(to_jsonb(x) order by starts_on),'[]') into trend from (
   select b.starts_on,b.ends_on,coalesce(sum(j.revenue),0) revenue,coalesce(sum(greatest(j.cash,0)),0) cash_in,coalesce(sum(greatest(-j.cash,0)),0) cash_out from buckets b left join journal j on j.posting_date between b.starts_on and b.ends_on group by b.starts_on,b.ends_on
  ) x;
 else finance:=null;trend:='[]';end if;

 if t.features ? 'projects' then
  select coalesce(jsonb_agg(to_jsonb(x) order by ends_on nulls last,code),'[]') into work from (
   select p.id,p.code,p.name,'projects' kind,p.status,p.ends_on,p.budget target,
    (select coalesce(sum(quantity*unit_cost),0) from public.business_project_materials where tenant_id=a.tenant_id and project_id=p.id and status='posted')+
    (select coalesce(sum(amount),0) from public.business_project_costs where tenant_id=a.tenant_id and project_id=p.id and status='posted') actual,
    (select completion_percent from public.business_project_updates where tenant_id=a.tenant_id and project_id=p.id and status='posted' order by reported_on desc,created_at desc,id desc limit 1) progress,'đ' unit
   from public.business_projects p where p.tenant_id=a.tenant_id and p.status='active' order by p.ends_on nulls last,p.code limit 6
  ) x;
 elsif t.features ? 'production' then
  select coalesce(jsonb_agg(to_jsonb(x) order by due_date,code),'[]') into work from (
   select w.id,w.code,w.name,'work_orders' kind,w.status,w.due_date,w.quantity target,public.business_terminal_quantity(a.tenant_id,w.id) actual,i.unit,w.mold_snapshot->>'code' mold_code,
    (select coalesce(sum(scrap_quantity),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') scrap,
    (select coalesce(sum(labor_hours),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') labor_hours,
    (select count(*) from public.business_lot_links l join public.business_production_receipts p on p.tenant_id=l.tenant_id and p.id=l.source_receipt_id where p.tenant_id=a.tenant_id and p.work_order_id=w.id and l.status='posted') trace_count,
    (select min(l.expires_on) from public.business_production_receipts p join public.business_lots l on l.tenant_id=p.tenant_id and l.id=p.lot_id where p.tenant_id=a.tenant_id and p.work_order_id=w.id and p.status='posted') expires_on,
    (select coalesce(sum(quantity*unit_cost),0) from public.business_material_issues where tenant_id=a.tenant_id and work_order_id=w.id and status='posted')+
    (select coalesce(sum(labor_cost+machine_cost),0) from public.business_production_reports where tenant_id=a.tenant_id and work_order_id=w.id and status='posted') cost
   from public.business_work_orders w join public.business_items i on i.tenant_id=w.tenant_id and i.id=w.item_id
   where w.tenant_id=a.tenant_id and w.status in ('released','completed') order by (w.status='released') desc,w.due_date,w.code limit 6
  ) x;
 elsif t.features ? 'sales' then
  with orders as (select * from public.business_sales_orders where tenant_id=a.tenant_id and status in ('released','completed') order by (status='released') desc,order_date desc,id limit 6)
  select coalesce(jsonb_agg(to_jsonb(x) order by code),'[]') into work from (
   select o.id,o.code,o.name,'sales_orders' kind,o.status,'đ' unit,coalesce(v.target,0) target,coalesce(v.actual,0) actual
   from orders o left join lateral (
    select sum(l.amount) target,sum(least(l.quantity,greatest(coalesce(s.quantity,0),0))*l.amount/nullif(l.quantity,0)) actual
    from (select item_id,sum(quantity) quantity,sum(quantity*unit_price) amount from public.business_sales_lines where tenant_id=a.tenant_id and sales_order_id=o.id and status='active' group by item_id) l
    left join lateral (select sum(case direction when 'out' then quantity else -quantity end) quantity from public.business_stock_moves where tenant_id=a.tenant_id and sales_order_id=o.id and item_id=l.item_id and status='posted') s on true
   ) v on true
  ) x;
 else work:='[]';end if;

 if t.features ? 'inventory' then
  with balances as (
   select m.lot_id,sum(case direction when 'in' then quantity else -quantity end) quantity from public.business_stock_moves m where m.tenant_id=a.tenant_id and m.status='posted' group by m.lot_id having sum(case direction when 'in' then quantity else -quantity end)>0
  ) select jsonb_build_object('lots',count(*),'blocked',count(*) filter(where t.features ? 'quality' and l.quality_state<>'released'),'expired',count(*) filter(where l.expires_on<today),'expiring',count(*) filter(where l.expires_on between today and today+30)) into stock
   from balances b join public.business_lots l on l.tenant_id=a.tenant_id and l.id=b.lot_id;
 else stock:=null;end if;

 with pending as (
  select 'journal_entries' kind,count(*) total,count(*) filter(where reviewed_by is null) review from public.business_journal_entries where tenant_id=a.tenant_id and status='draft' and t.features ? 'accounting'
  union all select 'sales_invoices',count(*),count(*) filter(where reviewed_by is null) from public.business_sales_invoices where tenant_id=a.tenant_id and status='draft' and t.features ? 'accounting'
  union all select 'vendor_invoices',count(*),count(*) filter(where reviewed_by is null) from public.business_vendor_invoices where tenant_id=a.tenant_id and status='draft' and t.features ? 'accounting'
  union all select 'cash_vouchers',count(*),count(*) filter(where reviewed_by is null) from public.business_cash_vouchers where tenant_id=a.tenant_id and status='draft' and t.features ? 'accounting'
  union all select 'work_orders',count(*),0 from public.business_work_orders where tenant_id=a.tenant_id and status='draft' and t.features ? 'production'
  union all select 'purchase_orders',count(*),0 from public.business_purchase_orders where tenant_id=a.tenant_id and status='draft' and t.features ? 'purchasing'
 ) select coalesce(jsonb_agg(to_jsonb(p) order by total desc,kind) filter(where total>0),'[]') into queues from pending p;

 with problems as (
  select r.code,r.name,'receivables' kind,'danger' tone,'Quá hạn thanh toán' state,r.amount-r.paid_amount amount,r.due_date date from public.business_receivables r where r.tenant_id=a.tenant_id and r.status='posted' and r.amount>r.paid_amount and r.due_date<today and (t.features ? 'sales' or t.features ? 'accounting')
  union all select r.code,r.name,'payables','warning','Đến hạn trả nhà cung cấp',r.amount-r.paid_amount,r.due_date from public.business_payables r where r.tenant_id=a.tenant_id and r.status='posted' and r.amount>r.paid_amount and r.due_date<=today+7 and t.features ? 'accounting'
  union all select l.code,l.name,'lots',case when l.expires_on<today then 'danger' else 'warning' end,case when l.expires_on<today then 'Lô hết hạn' when t.features ? 'quality' and l.quality_state<>'released' then 'Lô chặn xuất' else 'Hạn dùng trong 30 ngày' end,null,l.expires_on from public.business_lots l where l.tenant_id=a.tenant_id and t.features ? 'inventory' and (l.expires_on<=today+30 or (t.features ? 'quality' and l.quality_state<>'released')) and exists(select 1 from public.business_stock_moves m where m.tenant_id=a.tenant_id and m.lot_id=l.id and m.status='posted' group by m.lot_id having sum(case m.direction when 'in' then m.quantity else -m.quantity end)>0)
  union all select w.code,w.name,'work_orders','warning','Lệnh trễ hạn',null,w.due_date from public.business_work_orders w where w.tenant_id=a.tenant_id and w.status='released' and w.due_date<today and t.features ? 'production'
 ) select jsonb_build_object('total',(select count(*) from problems),'items',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from problems order by (tone='danger') desc,date nulls last,code limit 6) x),'[]')) into alerts;
 return jsonb_build_object('from',start_on,'to',end_on,'asOf',today,'generatedAt',now(),'finance',finance,'trend',trend,'work',work,'stock',stock,'queues',queues,'alerts',alerts);
end $$;
revoke all on function public.business_company_dashboard(text,text,date) from public,anon,authenticated,service_role;
grant execute on function public.business_company_dashboard(text,text,date) to service_role;
create index if not exists business_dashboard_journal_date_idx on public.business_journal_entries(tenant_id,posting_date) where status='posted';
create index if not exists business_dashboard_stock_lot_idx on public.business_stock_moves(tenant_id,lot_id) where status='posted';
