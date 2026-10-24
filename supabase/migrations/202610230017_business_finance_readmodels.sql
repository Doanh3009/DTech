-- Tenant identity comes exclusively from a revalidated session.
create function public.business_financial_snapshot(p_hash text,p_slug text,p_from date,p_to date,p_account uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;trial jsonb;ledger jsonb;journals jsonb;ar jsonb;ap jsonb;periods jsonb;totals jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);perform public.business_assert_kind(a.tenant_id,'journal_entries');
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 then raise exception 'BUSINESS_INVALID_DATE';end if;
 if p_account is not null and not exists(select 1 from public.business_gl_accounts where tenant_id=a.tenant_id and id=p_account) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 with balances as (
 select g.id,g.code,g.name,g.nature,
 coalesce(sum(l.debit-l.credit) filter(where j.posting_date<p_from),0) opening,
 coalesce(sum(l.debit) filter(where j.posting_date between p_from and p_to),0) debit,
 coalesce(sum(l.credit) filter(where j.posting_date between p_from and p_to),0) credit,
 coalesce(sum(l.debit-l.credit),0) closing
 from public.business_gl_accounts g left join (public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.posting_date<=p_to) on l.tenant_id=g.tenant_id and l.account_id=g.id and l.status='active'
 where g.tenant_id=a.tenant_id and g.account_type='posting' group by g.id
 ) select coalesce(jsonb_agg(to_jsonb(b) order by code),'[]'::jsonb),jsonb_build_object('debit',coalesce(sum(debit),0),'credit',coalesce(sum(credit),0),'cash',coalesce(sum(closing) filter(where code like '111%' or code like '112%'),0)) into trial,totals from balances b;
 select coalesce(jsonb_agg(to_jsonb(x) order by posting_date desc,code desc),'[]'::jsonb) into ledger from (
 select j.code,j.name,j.posting_date,j.document_date,g.code account,g.name account_name,l.debit,l.credit,p.name partner,pr.name project,j.source_kind from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id left join public.business_tenant_partners p on p.tenant_id=l.tenant_id and p.id=l.partner_id left join public.business_projects pr on pr.tenant_id=l.tenant_id and pr.id=l.project_id where l.tenant_id=a.tenant_id and l.status='active' and j.status='posted' and j.posting_date between p_from and p_to and (p_account is null or l.account_id=p_account) order by j.posting_date desc,j.code desc,l.id limit 250
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by posting_date desc,code desc),'[]'::jsonb) into journals from (
 select j.id,j.code,j.name,j.posting_date,j.document_date,j.status,j.row_version,j.source_kind,j.source_id,j.reversed_by,creator.display_name creator,reviewer.display_name reviewer,coalesce(sum(l.debit) filter(where l.status='active'),0) debit,coalesce(sum(l.credit) filter(where l.status='active'),0) credit from public.business_journal_entries j join public.business_accounts creator on creator.tenant_id=j.tenant_id and creator.id=j.created_by left join public.business_accounts reviewer on reviewer.tenant_id=j.tenant_id and reviewer.id=j.reviewed_by left join public.business_journal_lines l on l.tenant_id=j.tenant_id and l.journal_id=j.id where j.tenant_id=a.tenant_id and j.posting_date between p_from and p_to group by j.id,creator.id,reviewer.id order by j.posting_date desc,j.code desc limit 100
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by due_date,code),'[]'::jsonb) into ar from (select r.code,p.name partner,r.amount,r.paid_amount,r.amount-r.paid_amount remaining,r.due_date from public.business_receivables r join public.business_tenant_partners p on p.tenant_id=r.tenant_id and p.id=r.partner_id where r.tenant_id=a.tenant_id and r.status='posted' order by r.due_date,r.code limit 250) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by due_date,code),'[]'::jsonb) into ap from (select r.code,p.name partner,r.amount,r.paid_amount,r.amount-r.paid_amount remaining,r.due_date from public.business_payables r join public.business_tenant_partners p on p.tenant_id=r.tenant_id and p.id=r.partner_id where r.tenant_id=a.tenant_id and r.status='posted' order by r.due_date,r.code limit 250) x;
 select coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'starts_on',starts_on,'ends_on',ends_on,'status',status) order by starts_on desc),'[]'::jsonb) into periods from public.business_accounting_periods where tenant_id=a.tenant_id;
 return jsonb_build_object('trial',trial,'ledger',ledger,'journals',journals,'receivables',ar,'payables',ap,'periods',periods,'totals',totals,'ledgerLimit',250,'journalLimit',100);
end $$;
revoke all on function public.business_financial_snapshot(text,text,date,date,uuid) from public,anon,authenticated,service_role;
grant execute on function public.business_financial_snapshot(text,text,date,date,uuid) to service_role;

alter function public.business_operations_view(text,text,text) rename to business_operations_view_core;
revoke all on function public.business_operations_view_core(text,text,text) from public,anon,authenticated,service_role;
create function public.business_operations_view(p_hash text,p_slug text,p_feature text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;rows jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if not exists(select 1 from public.business_tenants where id=a.tenant_id and features ? p_feature) then raise exception 'BUSINESS_FORBIDDEN';end if;
 if p_feature='purchasing' then
 select coalesce(jsonb_agg(to_jsonb(x) order by code desc),'[]'::jsonb) into rows from (
 select o.code,o.name,p.name customer,o.status,o.expected_on,coalesce(l.amount,0) amount,coalesce(l.ordered,0) ordered,coalesce(r.received,0) received,coalesce(l.ordered,0)-coalesce(r.received,0) remaining from public.business_purchase_orders o join public.business_tenant_partners p on p.tenant_id=o.tenant_id and p.id=o.partner_id left join lateral(select sum(quantity) ordered,sum(quantity*unit_price) amount from public.business_purchase_lines where tenant_id=o.tenant_id and purchase_order_id=o.id and status='active') l on true left join lateral(select sum(quantity) received from public.business_purchase_receipts where tenant_id=o.tenant_id and purchase_order_id=o.id and status='posted') r on true where o.tenant_id=a.tenant_id order by o.created_at desc limit 100
 ) x;
 elsif p_feature='people' then
 select coalesce(jsonb_agg(to_jsonb(x) order by code),'[]'::jsonb) into rows from (
 select s.code,s.name,s.department,s.position,s.joined_on,coalesce(t.worked_hours,0) worked_hours,coalesce(t.overtime_hours,0) overtime_hours from public.business_staff s left join lateral(select sum(worked_hours) worked_hours,sum(overtime_hours) overtime_hours from public.business_timecards where tenant_id=s.tenant_id and staff_id=s.id and status='posted' and work_date>=date_trunc('month',now())::date) t on true where s.tenant_id=a.tenant_id and s.status='active' order by s.code limit 100
 ) x;
 elsif p_feature='accounting' then
 return jsonb_build_object('rows',(public.business_financial_snapshot(p_hash,p_slug,date_trunc('month',now())::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date))->'journals','details','[]'::jsonb,'limit',100);
 else return public.business_operations_view_core(p_hash,p_slug,p_feature);end if;
 return jsonb_build_object('rows',rows,'details','[]'::jsonb,'limit',100);
end $$;
revoke all on function public.business_operations_view(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.business_operations_view(text,text,text) to service_role;

create or replace function public.business_session_workspace(p_hash text,p_slug text) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;t public.business_tenants%rowtype;
begin
 a:=public.business_assert_session(p_hash,p_slug,false,true);select * into t from public.business_tenants where id=a.tenant_id;
 return jsonb_build_object('tenantId',t.id,'slug',t.slug,'name',t.name,'systemName',t.system_name,'industry',t.industry,'features',t.features,'status',t.status,'trialEndsAt',t.trial_ends_at,'accountId',a.id,'displayName',a.display_name,'username',a.username,'role',a.role,'mustChangePassword',a.must_change_password,'isDemo',t.is_demo);
end $$;
