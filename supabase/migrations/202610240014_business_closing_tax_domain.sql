create function public.business_closing_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb;profit numeric;
begin
 if exists(select 1 from public.business_closing_runs where tenant_id=p_tenant and status='posted' and starts_on<=(v->>'ends_on')::date and ends_on>=(v->>'starts_on')::date) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by code),'[]'),-coalesce(sum(balance),0) into rows,profit from (
  select g.id account_id,g.code,g.name,sum(l.debit-l.credit) balance from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.source_kind is distinct from 'closing_runs' join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id where l.tenant_id=p_tenant and l.status='active' and j.posting_date between (v->>'starts_on')::date and (v->>'ends_on')::date and left(g.code,1) in ('5','6','7','8') group by g.id,g.code,g.name having sum(l.debit-l.credit)<>0
 ) x;
 return jsonb_build_object('rows',rows,'profit',profit,'total',(select coalesce(sum(abs((r->>'balance')::numeric)),0) from jsonb_array_elements(rows) r));
end $$;
revoke all on function public.business_closing_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_tax_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.business_tax_policies%rowtype;rows jsonb:='[]';output numeric:=0;input numeric:=0;carry numeric:=0;offset_amount numeric:=0;tax_base numeric:=0;tax numeric:=0;credit numeric:=0;previous record;
begin
 select * into p from public.business_tax_policies where tenant_id=p_tenant and id=(v->>'policy_id')::uuid and status='active' and tax_type=v->>'tax_type' and starts_on<=(v->>'starts_on')::date and (ends_on is null or ends_on>=(v->>'ends_on')::date);
 if not found then raise exception 'BUSINESS_TAX_PROFILE_REQUIRED';end if;
 if exists(select 1 from public.business_tax_filings where tenant_id=p_tenant and status='posted' and tax_type=p.tax_type and starts_on<=(v->>'ends_on')::date and ends_on>=(v->>'starts_on')::date and (starts_on<>(v->>'starts_on')::date or ends_on<>(v->>'ends_on')::date)) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
 select count(*) count,coalesce(max(filing_version),0) version from public.business_tax_filings where tenant_id=p_tenant and tax_type=p.tax_type and starts_on=(v->>'starts_on')::date and ends_on=(v->>'ends_on')::date and status='posted' into previous;
 if (v->>'filing_version')::integer<>previous.version+1 then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p.tax_type='vat' then
  if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=(v->>'tax_account_id')::uuid and code like '3331%' and account_type='posting') or not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=(v->>'expense_account_id')::uuid and code like '133%' and account_type='posting') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  select greatest(0,coalesce(sum(l.debit-l.credit),0)) into carry from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' where l.tenant_id=p_tenant and l.status='active' and l.account_id=(v->>'expense_account_id')::uuid and j.posting_date<(v->>'starts_on')::date;
  select coalesce(jsonb_agg(to_jsonb(x) order by source_kind,source_id),'[]') into rows from (
   select 'sales_invoices' source_kind,i.id source_id,i.code source_code,'output' indicator,i.base_amount base_amount,i.tax_amount tax_amount from public.business_sales_invoices i where i.tenant_id=p_tenant and i.tax_account_id=(v->>'tax_account_id')::uuid and i.status='posted' and i.posting_date between (v->>'starts_on')::date and (v->>'ends_on')::date
   union all select 'vendor_invoices',i.id,i.code,'input',i.base_amount,i.tax_amount from public.business_vendor_invoices i where i.tenant_id=p_tenant and i.tax_account_id=(v->>'expense_account_id')::uuid and i.status='posted' and i.posting_date between (v->>'starts_on')::date and (v->>'ends_on')::date
   union all select 'invoice_adjustments',i.id,i.code,case i.side when 'sale' then 'output' else 'input' end,-i.base_amount,-i.tax_amount from public.business_invoice_adjustments i left join public.business_sales_invoices s on s.tenant_id=i.tenant_id and s.id=i.sales_invoice_id left join public.business_vendor_invoices b on b.tenant_id=i.tenant_id and b.id=i.vendor_invoice_id where i.tenant_id=p_tenant and i.status='posted' and ((i.side='sale' and s.tax_account_id=(v->>'tax_account_id')::uuid) or (i.side='purchase' and b.tax_account_id=(v->>'expense_account_id')::uuid)) and i.posting_date between (v->>'starts_on')::date and (v->>'ends_on')::date
  ) x;
  select coalesce(sum((x->>'tax_amount')::numeric) filter(where x->>'indicator'='output'),0),coalesce(sum((x->>'tax_amount')::numeric) filter(where x->>'indicator'='input'),0),coalesce(sum((x->>'base_amount')::numeric) filter(where x->>'indicator'='output'),0) into output,input,tax_base from jsonb_array_elements(rows) x;
  offset_amount:=greatest(0,least(carry+input,output));
  tax:=greatest(0,output-offset_amount+(v->>'adjustment')::numeric);credit:=greatest(0,carry+input-offset_amount);
  rows:=jsonb_build_array(jsonb_build_object('source_kind','general_ledger','source_id',null,'source_code','Số dư khấu trừ đầu kỳ','indicator','input_carry','base_amount',0,'tax_amount',carry))||rows;
 elsif p.tax_type='cit' then
  select greatest(0,coalesce(sum(l.credit-l.debit),0)-p.deductible_amount) into tax_base from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.source_kind is distinct from 'closing_runs' and j.source_kind is distinct from 'tax_filings' join public.business_gl_accounts g on g.tenant_id=l.tenant_id and g.id=l.account_id where l.tenant_id=p_tenant and l.status='active' and left(g.code,1) in ('5','6','7','8') and j.posting_date between (v->>'starts_on')::date and (v->>'ends_on')::date;
  tax:=greatest(0,round(tax_base*p.rate/100,2)+(v->>'adjustment')::numeric);
  rows:=jsonb_build_array(jsonb_build_object('source_kind','general_ledger','source_id',null,'source_code','Sổ cái trong kỳ','indicator','taxable_income','base_amount',tax_base,'tax_amount',tax));
 else
  select coalesce(jsonb_agg(to_jsonb(x) order by source_id),'[]') into rows from (
   select 'payroll_statutory_lines' source_kind,l.id source_id,l.name source_code,case p.tax_type when 'pit' then 'withheld_pit' else 'insurance' end indicator,case p.tax_type when 'pit' then l.taxable_amount else 0 end base_amount,case p.tax_type when 'pit' then l.pit else l.employee_insurance+l.employer_insurance end tax_amount
   from public.business_payroll_statutory_lines l join public.business_payroll_tax_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' join public.business_salary_runs s on s.tenant_id=r.tenant_id and s.id=r.salary_run_id and s.status='posted'
   where l.tenant_id=p_tenant and s.ends_on between (v->>'starts_on')::date and (v->>'ends_on')::date and r.calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('staffId',l.staff_id,case p.tax_type when 'pit' then 'pitPolicyId' else 'insurancePolicyId' end,p.id))
  ) x;
  select coalesce(sum((x->>'base_amount')::numeric),0),greatest(0,coalesce(sum((x->>'tax_amount')::numeric),0)+(v->>'adjustment')::numeric) into tax_base,tax from jsonb_array_elements(rows) x;
 end if;
 return jsonb_build_object('rows',rows,'base',tax_base,'tax',tax,'credit',credit,'offset',offset_amount,'policyId',p.id,'policyVersion',p.row_version,'total',tax);
end $$;
revoke all on function public.business_tax_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_closing_tax_effect(p_tenant uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare lines jsonb:='[]';x jsonb;balance numeric;profit numeric;previous numeric;delta numeric;
begin
 if p_action='reverse' then
  if p_kind='closing_runs' and exists(select 1 from public.business_closing_runs where tenant_id=p_tenant and status='posted' and starts_on>(v->>'ends_on')::date) or p_kind='tax_filings' and (v->>'submission_state') not in ('internal','rejected') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if p_kind='tax_filings' and exists(select 1 from public.business_tax_filings where tenant_id=p_tenant and status='posted' and tax_type=v->>'tax_type' and starts_on=(v->>'starts_on')::date and ends_on=(v->>'ends_on')::date and filing_version>(v->>'filing_version')::integer) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  return '{}';
 end if;
 if p_kind='closing_runs' then
  for x in select value from jsonb_array_elements(v->'calculation_snapshot'->'rows') loop
   balance:=(x->>'balance')::numeric;
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',x->>'account_id','debit',greatest(-balance,0),'credit',greatest(balance,0)),jsonb_build_object('accountId',v->>'result_account_id','debit',greatest(balance,0),'credit',greatest(-balance,0)));
  end loop;
  profit:=(v->'calculation_snapshot'->>'profit')::numeric;
  if profit<>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'result_account_id','debit',greatest(profit,0),'credit',greatest(-profit,0)),jsonb_build_object('accountId',v->>'retained_account_id','credit',greatest(profit,0),'debit',greatest(-profit,0)));end if;
  if jsonb_array_length(lines)=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
 else
  if v->>'tax_type'='cit' then
   select coalesce(sum((calculation_snapshot->>'bookedDelta')::numeric),0) into previous from public.business_tax_filings where tenant_id=p_tenant and status='posted' and tax_type='cit' and starts_on=(v->>'starts_on')::date and ends_on=(v->>'ends_on')::date;
   delta:=(v->'calculation_snapshot'->>'tax')::numeric-previous;
   if delta<>0 then lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'expense_account_id','debit',greatest(delta,0),'credit',greatest(-delta,0)),jsonb_build_object('accountId',v->>'tax_account_id','credit',greatest(delta,0),'debit',greatest(-delta,0)));end if;
  elsif v->>'tax_type'='vat' then
   select coalesce(sum((calculation_snapshot->>'bookedDelta')::numeric),0) into previous from public.business_tax_filings where tenant_id=p_tenant and status='posted' and tax_type='vat' and starts_on=(v->>'starts_on')::date and ends_on=(v->>'ends_on')::date;
   delta:=(v->'calculation_snapshot'->>'offset')::numeric-previous;
   if delta<>0 then lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'tax_account_id','debit',greatest(delta,0),'credit',greatest(-delta,0)),jsonb_build_object('accountId',v->>'expense_account_id','credit',greatest(delta,0),'debit',greatest(-delta,0)));end if;
  else delta:=0;end if;
  return jsonb_build_object('lines',lines,'snapshot',jsonb_build_object('bookedDelta',delta));
 end if;
 return jsonb_build_object('lines',lines);
end $$;
revoke all on function public.business_closing_tax_effect(uuid,text,jsonb,text) from public,anon,authenticated,service_role;
