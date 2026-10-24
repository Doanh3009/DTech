create function public.business_misa_snapshot(p_hash text,p_slug text,p_view text,p_from date,p_to date,p_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;source_sql text;stats_sql text;kind text;result jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug);
 if p_from is null or p_to is null or p_from>p_to or p_to-p_from>366 or p_page is null or p_page<1 or p_page>100000 then raise exception 'BUSINESS_INVALID_DATE';end if;
 kind:=case p_view when 'assets' then 'assets' when 'bank' then 'bank_statement_lines' when 'advances' then 'advances' when 'loans' then 'loans' when 'costing' then 'costing_runs' when 'tax' then 'tax_filings' when 'reports' then 'financial_report_lines' else null end;
 if kind is null then raise exception 'BUSINESS_INVALID_INPUT';end if;perform public.business_assert_kind(a.tenant_id,kind);
 if p_view='assets' then
  source_sql:=$q$select s.id,s.code,s.name,s.asset_type,s.service_state,s.acquired_on,s.original_cost,s.opening_depreciation+coalesce(c.amount,0) accumulated,case when s.service_state='disposed' then 0 else s.original_cost-s.opening_depreciation-coalesce(c.amount,0) end remaining,p.name project,u.name custodian,
   exists(select 1 from public.business_asset_events e where e.tenant_id=s.tenant_id and e.asset_id=s.id and e.event_type='register' and e.status='posted') registered
   from public.business_assets s left join lateral(select sum(l.amount) amount from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=s.tenant_id and l.asset_id=s.id) c on true left join public.business_projects p on p.tenant_id=s.tenant_id and p.id=s.project_id left join public.business_staff u on u.tenant_id=s.tenant_id and u.id=s.custodian_id where s.tenant_id=$1 and s.status='active'$q$;
  stats_sql:=$q$jsonb_build_object('original',coalesce(sum(original_cost) filter(where registered and service_state<>'disposed'),0),'accumulated',coalesce(sum(accumulated) filter(where registered and service_state<>'disposed'),0),'remaining',coalesce(sum(remaining) filter(where registered and service_state<>'disposed'),0),'maintenance',count(*) filter(where service_state='maintenance'))$q$;
 elsif p_view='bank' then
  source_sql:=$q$select s.id,s.code,s.name,g.code account,s.transaction_ref,s.value_date,s.direction,s.amount,coalesce(c.amount,0) matched,s.amount-coalesce(c.amount,0) remaining,case when coalesce(c.amount,0)=s.amount then 'matched' when coalesce(c.amount,0)>0 then 'partial' else 'unmatched' end match_state from public.business_bank_statement_lines s join public.business_gl_accounts g on g.tenant_id=s.tenant_id and g.id=s.bank_account_id left join lateral(select sum(amount) amount from public.business_bank_matches where tenant_id=s.tenant_id and statement_line_id=s.id and status='posted') c on true where s.tenant_id=$1 and s.status='active' and s.value_date between $2 and $3$q$;
  stats_sql:=$q$jsonb_build_object('statementIn',coalesce(sum(amount) filter(where direction='in'),0),'statementOut',coalesce(sum(amount) filter(where direction='out'),0),'matched',coalesce(sum(matched),0),'unmatched',coalesce(sum(remaining),0))$q$;
 elsif p_view='advances' then
  source_sql:=$q$select s.id,s.code,s.name,u.name staff,p.name project,s.posting_date,s.due_date,s.amount,coalesce(c.expense,0) expense,coalesce(c.returned,0) returned,s.amount-coalesce(c.expense,0)-coalesce(c.returned,0) remaining from public.business_advances s join public.business_staff u on u.tenant_id=s.tenant_id and u.id=s.staff_id left join public.business_projects p on p.tenant_id=s.tenant_id and p.id=s.project_id left join lateral(select sum(expense_amount) expense,sum(returned_amount) returned from public.business_advance_settlements where tenant_id=s.tenant_id and advance_id=s.id and status='posted') c on true where s.tenant_id=$1 and s.status='posted'$q$;
  stats_sql:=$q$jsonb_build_object('advanced',coalesce(sum(amount),0),'settled',coalesce(sum(expense),0),'returned',coalesce(sum(returned),0),'remaining',coalesce(sum(remaining),0))$q$;
 elsif p_view='loans' then
  source_sql:=$q$select s.id,s.code,s.name,p.name partner,s.principal_limit,s.annual_rate,s.ends_on,coalesce(c.drawn,0) drawn,coalesce(c.repaid,0) repaid,coalesce(c.drawn,0)-coalesce(c.repaid,0) remaining,coalesce(c.interest,0) interest from public.business_loans s join public.business_tenant_partners p on p.tenant_id=s.tenant_id and p.id=s.partner_id left join lateral(select sum(principal) filter(where movement_type='draw') drawn,sum(principal) filter(where movement_type='repay') repaid,sum(interest) interest from public.business_loan_movements where tenant_id=s.tenant_id and loan_id=s.id and status='posted') c on true where s.tenant_id=$1 and s.status='posted'$q$;
  stats_sql:=$q$jsonb_build_object('drawn',coalesce(sum(drawn),0),'repaid',coalesce(sum(repaid),0),'remaining',coalesce(sum(remaining),0),'interest',coalesce(sum(interest),0))$q$;
 elsif p_view='costing' then
  source_sql:=$q$select r.id,r.code,r.name,r.target_type,coalesce(w.name,p.name) target,r.posting_date,r.status,r.total_amount,r.completed_amount,coalesce((r.calculation_snapshot->>'closingWip')::numeric,0) closing_wip,r.completion_percent from public.business_costing_runs r left join public.business_work_orders w on w.tenant_id=r.tenant_id and w.id=r.work_order_id left join public.business_projects p on p.tenant_id=r.tenant_id and p.id=r.project_id where r.tenant_id=$1 and r.posting_date between $2 and $3$q$;
  stats_sql:=$q$jsonb_build_object('costs',coalesce(sum(total_amount) filter(where status='posted'),0),'completed',coalesce(sum(completed_amount) filter(where status='posted'),0),'draft',count(*) filter(where status='draft'),'posted',count(*) filter(where status='posted'))$q$;
 elsif p_view='tax' then
  source_sql:=$q$select s.id,s.code,s.name,s.tax_type,s.starts_on,s.ends_on,s.filing_version,s.status,s.submission_state,s.base_amount,s.tax_amount,s.tax_credit,not exists(select 1 from public.business_tax_filings n where n.tenant_id=s.tenant_id and n.tax_type=s.tax_type and n.starts_on=s.starts_on and n.ends_on=s.ends_on and n.status='posted' and n.filing_version>s.filing_version) latest from public.business_tax_filings s where s.tenant_id=$1 and s.starts_on<=$3 and s.ends_on>=$2$q$;
  stats_sql:=$q$jsonb_build_object('obligation',coalesce(sum(tax_amount) filter(where status='posted' and latest),0),'credit',coalesce(sum(tax_credit) filter(where status='posted' and latest),0),'draft',count(*) filter(where status='draft'),'accepted',count(*) filter(where submission_state='accepted'))$q$;
 else
  source_sql:=$q$with ledger as (
   select g.id,g.code,g.nature,j.id journal_id,j.posting_date,j.document_type,j.source_kind,l.partner_id,l.debit,l.credit
   from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.posting_date<=$3 join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id
   where l.tenant_id=$1 and l.status='active' and g.account_type='posting'
  ),account_values as (
   select id,code,case when nature='both' or code like '131%' or code like '331%' then partner_id else null end partner_id,sum(debit-credit) closing,
   coalesce(sum(debit) filter(where posting_date between $2 and $3 and document_type<>'opening' and source_kind is distinct from 'closing_runs'),0) debit,
   coalesce(sum(credit) filter(where posting_date between $2 and $3 and document_type<>'opening' and source_kind is distinct from 'closing_runs'),0) credit
   from ledger group by id,code,case when nature='both' or code like '131%' or code like '331%' then partner_id else null end
  ),cash_journals as (
   select journal_id,
    sum(case when code like '111%' or code like '112%' then debit else 0 end) cash_debit,
    sum(case when code like '111%' or code like '112%' then credit else 0 end) cash_credit,
    sum(case when code not like '111%' and code not like '112%' then debit else 0 end) other_debit,
    sum(case when code not like '111%' and code not like '112%' then credit else 0 end) other_credit
   from ledger where posting_date between $2 and $3 and document_type<>'opening' and source_kind is distinct from 'closing_runs' group by journal_id
  ),cash_values as (
   select l.id,l.code,sum(least(c.cash_debit,c.other_credit)*l.credit/nullif(c.other_credit,0)) cash_in,sum(least(c.cash_credit,c.other_debit)*l.debit/nullif(c.other_debit,0)) cash_out
   from ledger l join cash_journals c on c.journal_id=l.journal_id where l.code not like '111%' and l.code not like '112%' group by l.id,l.code
  ),components as (
   select s.id,s.code,s.name,s.report,s.line_number,a.code account,
    (case s.calculation when 'debit_balance' then greatest(a.closing,0) when 'credit_balance' then greatest(-a.closing,0) when 'debit_turnover' then a.debit when 'credit_turnover' then a.credit when 'net_debit' then a.debit-a.credit else a.credit-a.debit end)*case s.sign when 'minus' then -1 else 1 end amount
   from public.business_financial_report_lines s left join account_values a on starts_with(a.code,s.account_prefix) where s.tenant_id=$1 and s.status='active' and s.report<>'cash' and s.effective_from<=$2 and (s.effective_to is null or s.effective_to>=$3)
   union all select s.id,s.code,s.name,s.report,s.line_number,a.code,
    (case s.calculation when 'debit_turnover' then coalesce(a.cash_out,0) when 'credit_turnover' then coalesce(a.cash_in,0) when 'net_debit' then coalesce(a.cash_out,0)-coalesce(a.cash_in,0) else coalesce(a.cash_in,0)-coalesce(a.cash_out,0) end)*case s.sign when 'minus' then -1 else 1 end
   from public.business_financial_report_lines s left join cash_values a on starts_with(a.code,s.account_prefix) where s.tenant_id=$1 and s.status='active' and s.report='cash' and s.effective_from<=$2 and (s.effective_to is null or s.effective_to>=$3)
  ) select min(id::text)::uuid id,min(code) code,name,report,line_number,coalesce(sum(amount),0) amount,string_agg(distinct account,', ' order by account) accounts from components group by report,line_number,name$q$;
  stats_sql:=$q$jsonb_build_object('indicators',count(*),'balanceIndicators',count(*) filter(where report='balance'),'incomeIndicators',count(*) filter(where report='income'),'cashIndicators',count(*) filter(where report='cash'))$q$;
 end if;
 execute format('with source as (%s),stats as(select count(*) total,%s totals from source),page as(select * from source order by code,id limit 25 offset $4) select jsonb_build_object(''rows'',coalesce((select jsonb_agg(to_jsonb(page)) from page),''[]''::jsonb),''total'',stats.total,''totals'',stats.totals) from stats',source_sql,stats_sql) into result using a.tenant_id,p_from,p_to,(p_page-1)*25;
 return result||jsonb_build_object('from',p_from,'to',p_to,'asOf',(now() at time zone 'Asia/Ho_Chi_Minh')::date,'page',p_page,'pageSize',25,'view',p_view);
end $$;
revoke all on function public.business_misa_snapshot(text,text,text,date,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.business_misa_snapshot(text,text,text,date,date,integer) to service_role;
