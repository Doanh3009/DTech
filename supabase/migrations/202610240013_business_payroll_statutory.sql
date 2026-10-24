create function public.business_progressive_tax(p_tenant uuid,p_policy uuid,p_base numeric) returns numeric language plpgsql security definer set search_path='' as $$
declare b record;last_upper numeric:=0;result numeric:=0;unlimited boolean:=false;
begin
 for b in select * from public.business_tax_brackets where tenant_id=p_tenant and policy_id=p_policy and status='active' order by lower_bound,id loop
  if unlimited or b.lower_bound<>last_upper or b.upper_bound is not null and b.upper_bound<=b.lower_bound then raise exception 'BUSINESS_TAX_BRACKETS_INVALID';end if;
  result:=result+greatest(0,least(p_base,coalesce(b.upper_bound,p_base))-b.lower_bound)*b.rate/100;
  unlimited:=b.upper_bound is null;last_upper:=b.upper_bound;
 end loop;
 if not unlimited then raise exception 'BUSINESS_TAX_BRACKETS_INVALID';end if;
 return round(result,2);
end $$;
revoke all on function public.business_progressive_tax(uuid,uuid,numeric) from public,anon,authenticated,service_role;

create function public.business_payroll_tax_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare payroll public.business_salary_runs%rowtype;p public.business_staff_tax_profiles%rowtype;pit_policy public.business_tax_policies%rowtype;insurance_policy public.business_tax_policies%rowtype;l record;rows jsonb:='[]';gross numeric;prior_gross numeric;prior_employee numeric;prior_employer numeric;prior_pit numeric;employee numeric;employer numeric;pit numeric;taxable numeric;manual_amount numeric;
begin
 select * into payroll from public.business_salary_runs where tenant_id=p_tenant and id=(v->>'salary_run_id')::uuid and status='draft' for update;if not found then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if date_trunc('month',payroll.starts_on)<>date_trunc('month',payroll.ends_on) then raise exception 'BUSINESS_INVALID_DATE';end if;
 if exists(select 1 from public.business_payroll_tax_runs where tenant_id=p_tenant and salary_run_id=payroll.id and status='posted' and id<>(v->>'id')::uuid) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 for l in select * from public.business_salary_lines where tenant_id=p_tenant and salary_run_id=payroll.id and status='active' order by id loop
  select * into p from public.business_staff_tax_profiles where tenant_id=p_tenant and staff_id=l.staff_id and status='active' and starts_on<=payroll.starts_on and (ends_on is null or ends_on>=payroll.ends_on);
  if not found then raise exception 'BUSINESS_TAX_PROFILE_REQUIRED';end if;
  select * into pit_policy from public.business_tax_policies where tenant_id=p_tenant and id=p.pit_policy_id and tax_type='pit' and status='active' and starts_on<=payroll.starts_on and (ends_on is null or ends_on>=payroll.ends_on);
  if not found then raise exception 'BUSINESS_TAX_PROFILE_REQUIRED';end if;
  select * into insurance_policy from public.business_tax_policies where tenant_id=p_tenant and id=p.insurance_policy_id and tax_type='insurance' and status='active' and starts_on<=payroll.starts_on and (ends_on is null or ends_on>=payroll.ends_on);
  if not found then raise exception 'BUSINESS_TAX_PROFILE_REQUIRED';end if;
  select coalesce(sum(s.gross_amount),0) into prior_gross from public.business_salary_lines s join public.business_salary_runs r on r.tenant_id=s.tenant_id and r.id=s.salary_run_id and r.status='posted' where s.tenant_id=p_tenant and s.staff_id=l.staff_id and s.status='active' and date_trunc('month',r.ends_on)=date_trunc('month',payroll.ends_on);
  select coalesce(sum(s.employee_insurance),0),coalesce(sum(s.employer_insurance),0),coalesce(sum(s.pit),0) into prior_employee,prior_employer,prior_pit from public.business_payroll_statutory_lines s join public.business_payroll_tax_runs r on r.tenant_id=s.tenant_id and r.id=s.run_id and r.status='posted' join public.business_salary_runs pay on pay.tenant_id=r.tenant_id and pay.id=r.salary_run_id and pay.status='posted' where s.tenant_id=p_tenant and s.staff_id=l.staff_id and date_trunc('month',pay.ends_on)=date_trunc('month',payroll.ends_on);
  employee:=greatest(0,round(p.insurance_base*insurance_policy.employee_rate/100,2)-prior_employee);
  employer:=greatest(0,round(p.insurance_base*insurance_policy.employer_rate/100,2)-prior_employer);
  taxable:=greatest(0,l.gross_amount+prior_gross-prior_employee-employee-pit_policy.deductible_amount-p.dependent_count*p.dependent_deduction);
  pit:=greatest(0,public.business_progressive_tax(p_tenant,pit_policy.id,taxable)-prior_pit);manual_amount:=l.deductions;
  if manual_amount+employee+pit>l.gross_amount then raise exception 'BUSINESS_PAYROLL_DEDUCTIONS_EXCEEDED';end if;
  rows:=rows||jsonb_build_array(jsonb_build_object('salaryLineId',l.id,'staffId',l.staff_id,'staffName',l.name,'gross',l.gross_amount,'manual',manual_amount,'taxable',taxable,'employeeInsurance',employee,'employerInsurance',employer,'pit',pit,'profileId',p.id,'profileVersion',p.row_version,'pitPolicyId',pit_policy.id,'pitPolicyVersion',pit_policy.row_version,'insurancePolicyId',insurance_policy.id,'insurancePolicyVersion',insurance_policy.row_version));
 end loop;
 if jsonb_array_length(rows)=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
 return jsonb_build_object('rows',rows,'salaryStartsOn',payroll.starts_on,'salaryEndsOn',payroll.ends_on,'standardDays',payroll.standard_days,'standardHours',payroll.standard_hours,'total',(select sum((x->>'employeeInsurance')::numeric+(x->>'employerInsurance')::numeric+(x->>'pit')::numeric) from jsonb_array_elements(rows) x));
end $$;
revoke all on function public.business_payroll_tax_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_payroll_tax_effect(p_tenant uuid,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb;payroll public.business_salary_runs%rowtype;
begin
 select * into payroll from public.business_salary_runs where tenant_id=p_tenant and id=(v->>'salary_run_id')::uuid for update;
 if payroll.status not in ('draft','cancelled') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if p_action='reverse' then update public.business_payroll_tax_runs set status='cancelled' where tenant_id=p_tenant and id=(v->>'id')::uuid;end if;
 if payroll.status='draft' then
  for x in select value from jsonb_array_elements(v->'calculation_snapshot'->'rows') loop
   update public.business_salary_lines set deductions=(x->>'manual')::numeric+case p_action when 'reverse' then 0 else (x->>'employeeInsurance')::numeric+(x->>'pit')::numeric end,net_amount=gross_amount-(x->>'manual')::numeric-case p_action when 'reverse' then 0 else (x->>'employeeInsurance')::numeric+(x->>'pit')::numeric end,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=(x->>'salaryLineId')::uuid;
  end loop;
  update public.business_salary_runs set reviewed_by=null,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=payroll.id;
 end if;
 return '{}';
end $$;
revoke all on function public.business_payroll_tax_effect(uuid,jsonb,text) from public,anon,authenticated,service_role;

create function public.business_payroll_journal_lines(p_tenant uuid,v jsonb,p_fallback jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare calculation public.business_payroll_tax_runs%rowtype;x jsonb;gross numeric:=0;net numeric:=0;manual numeric:=0;employee numeric:=0;employer numeric:=0;pit numeric:=0;result jsonb;row_count bigint;
begin
 select * into calculation from public.business_payroll_tax_runs where tenant_id=p_tenant and salary_run_id=(v->>'id')::uuid and status='posted';if not found then return p_fallback;end if;
 if v->>'starts_on'<>calculation.calculation_snapshot->>'salaryStartsOn' or v->>'ends_on'<>calculation.calculation_snapshot->>'salaryEndsOn' or (v->>'standard_days')::numeric<>(calculation.calculation_snapshot->>'standardDays')::numeric or (v->>'standard_hours')::numeric<>(calculation.calculation_snapshot->>'standardHours')::numeric then raise exception 'BUSINESS_CALCULATION_STALE';end if;
 select count(*) into row_count from public.business_salary_lines where tenant_id=p_tenant and salary_run_id=(v->>'id')::uuid and status='active';
 if row_count<>jsonb_array_length(calculation.calculation_snapshot->'rows') then raise exception 'BUSINESS_CALCULATION_STALE';end if;
 for x in select value from jsonb_array_elements(calculation.calculation_snapshot->'rows') loop
  if not exists(select 1 from public.business_salary_lines where tenant_id=p_tenant and id=(x->>'salaryLineId')::uuid and salary_run_id=(v->>'id')::uuid and staff_id=(x->>'staffId')::uuid and status='active' and gross_amount=(x->>'gross')::numeric and deductions=(x->>'manual')::numeric+(x->>'employeeInsurance')::numeric+(x->>'pit')::numeric) then raise exception 'BUSINESS_CALCULATION_STALE';end if;
  gross:=gross+(x->>'gross')::numeric;manual:=manual+(x->>'manual')::numeric;employee:=employee+(x->>'employeeInsurance')::numeric;employer:=employer+(x->>'employerInsurance')::numeric;pit:=pit+(x->>'pit')::numeric;
 end loop;
 net:=gross-manual-employee-pit;
 result:=jsonb_build_array(jsonb_build_object('accountId',v->>'expense_account_id','debit',gross));
 if net>0 then result:=result||jsonb_build_array(jsonb_build_object('accountId',v->>'payable_account_id','credit',net));end if;
 if manual>0 then result:=result||jsonb_build_array(jsonb_build_object('accountId',v->>'deduction_account_id','credit',manual));end if;
 if pit>0 then result:=result||jsonb_build_array(jsonb_build_object('accountId',calculation.pit_account_id,'credit',pit));end if;
 if employee+employer>0 then result:=result||jsonb_build_array(jsonb_build_object('accountId',calculation.insurance_account_id,'credit',employee+employer));end if;
 if employer>0 then result:=result||jsonb_build_array(jsonb_build_object('accountId',calculation.employer_expense_account_id,'debit',employer));end if;
 return result;
end $$;
revoke all on function public.business_payroll_journal_lines(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

do $$ declare f text;anchor text:='if lines is not null then journal:=';begin
 select pg_get_functiondef('public.business_record_action_before_misa(text,text,text,uuid,integer,text,text,uuid,text)'::regprocedure) into f;
 if strpos(f,anchor)=0 then raise exception 'Review payroll posting before upgrading';end if;
 f:=replace(f,anchor,E'if p_kind=''salary_runs'' then lines:=public.business_payroll_journal_lines(a.tenant_id,v,lines);end if;\n  '||anchor);execute f;
end $$;

create function public.business_guard_statutory_salary_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.business_payroll_tax_runs where tenant_id=new.tenant_id and salary_run_id=new.salary_run_id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_guard_statutory_salary_line() from public,anon,authenticated,service_role;
create trigger business_guard_statutory_salary_line before insert or update on public.business_salary_lines for each row execute function public.business_guard_statutory_salary_line();
