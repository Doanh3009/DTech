create function public.business_payroll_cost_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.business_salary_lines%rowtype;p public.business_salary_runs%rowtype;employer numeric;employer_account uuid;used numeric;salary_share numeric;employer_share numeric;used_salary numeric;used_employer numeric;
begin
 select * into l from public.business_salary_lines where tenant_id=p_tenant and id=(v->>'salary_line_id')::uuid and status='active';
 select * into p from public.business_salary_runs where tenant_id=p_tenant and id=l.salary_run_id and status='posted';
 if p.id is null or (v->>'work_order_id' is null)=(v->>'project_id' is null) or (v->>'document_date')::date<p.posting_date then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 select coalesce(sum(allocation_percent),0) into used from public.business_payroll_cost_allocations where tenant_id=p_tenant and salary_line_id=l.id and status='posted';
 if used+(v->>'allocation_percent')::numeric>100 then raise exception 'BUSINESS_COST_SOURCE_EXCEEDED';end if;
 select coalesce(sum(s.employer_insurance),0),(array_agg(r.employer_expense_account_id))[1] into employer,employer_account from public.business_payroll_statutory_lines s join public.business_payroll_tax_runs r on r.tenant_id=s.tenant_id and r.id=s.run_id and r.status='posted' where s.tenant_id=p_tenant and r.salary_run_id=p.id and s.staff_id=l.staff_id;
 salary_share:=round(l.gross_amount*(v->>'allocation_percent')::numeric/100,2);employer_share:=round(employer*(v->>'allocation_percent')::numeric/100,2);
 if used+(v->>'allocation_percent')::numeric=100 then
  select coalesce(sum((part->>'amount')::numeric) filter(where position=1),0),coalesce(sum((part->>'amount')::numeric) filter(where position=2),0) into used_salary,used_employer from public.business_payroll_cost_allocations a cross join lateral jsonb_array_elements(a.calculation_snapshot->'rows') with ordinality x(part,position) where a.tenant_id=p_tenant and a.salary_line_id=l.id and a.status='posted';
  salary_share:=l.gross_amount-used_salary;employer_share:=employer-used_employer;
 end if;
 return jsonb_build_object('total',salary_share+employer_share,'rows',jsonb_build_array(jsonb_build_object('sourceCode',l.code,'sourceName',l.name,'staffName',l.name,'category','labor','amount',salary_share,'sourceAccountId',p.expense_account_id),jsonb_build_object('sourceCode',l.code,'sourceName','Bảo hiểm doanh nghiệp · '||l.name,'staffName',l.name,'category','labor','amount',employer_share,'sourceAccountId',employer_account)),'salaryVersion',l.row_version,'salaryRunVersion',p.row_version,'salaryRunId',p.id);
end $$;
revoke all on function public.business_payroll_cost_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_payroll_cost_effect(p_tenant uuid,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_action='reverse' and exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=p_tenant and l.source_kind='payroll_cost_allocations' and l.source_id=v->>'id') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 return '{}';
end $$;
revoke all on function public.business_payroll_cost_effect(uuid,jsonb,text) from public,anon,authenticated,service_role;

do $$ declare body text;anchor text:='select * into h from public.business_journal_entries where tenant_id=p_tenant and id=p_id for update;';begin
 select pg_get_functiondef('public.business_reverse_journal(uuid,uuid,uuid,text)'::regprocedure) into body;
 if strpos(body,anchor)=0 then raise exception 'Review payroll cost reversal before upgrading';end if;
 body:=replace(body,anchor,$guard$if exists(select 1 from public.business_payroll_cost_allocations a join public.business_salary_lines l on l.tenant_id=a.tenant_id and l.id=a.salary_line_id join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.source_kind='salary_runs' and j.source_id=l.salary_run_id where a.tenant_id=p_tenant and a.status='posted' and j.id=p_id) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 $guard$||anchor);execute body;
end $$;
