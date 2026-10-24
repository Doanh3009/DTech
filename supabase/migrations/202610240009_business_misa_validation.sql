create function public.business_misa_validate_save(p_tenant uuid,p_kind text,p_id uuid,v jsonb,old jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare k text;parent uuid;previous uuid;source_total numeric;reserved numeric;
begin
 if p_kind='assets' then
  if (v->>'residual_value')::numeric+(v->>'opening_depreciation')::numeric>(v->>'original_cost')::numeric or (v->>'starts_on')::date<(v->>'acquired_on')::date then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if v->>'expense_account_id'=v->>'accumulated_account_id' or v->>'expense_account_id'=v->>'asset_account_id' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if exists(select 1 from public.business_asset_events where tenant_id=p_tenant and asset_id=p_id and event_type='register' and status='posted') then
   for k in select jsonb_object_keys(v) loop if k not in ('name','notes') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;
  end if;
 elsif p_kind='bank_statement_lines' then
  if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=(v->>'bank_account_id')::uuid and code like '112%' and account_type='posting') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if coalesce(v->>'file_hash','')<>'' and v->>'file_hash' !~ '^[a-f0-9]{64}$' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if exists(select 1 from public.business_bank_matches where tenant_id=p_tenant and statement_line_id=p_id and status='posted') then
   for k in select jsonb_object_keys(v) loop if k not in ('name','notes') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;
  end if;
 elsif p_kind='loan_installments' then
  if (v->>'principal')::numeric+(v->>'interest')::numeric<=0 or not exists(select 1 from public.business_loans where tenant_id=p_tenant and id=(v->>'loan_id')::uuid and status='posted' and (v->>'due_date')::date between starts_on and ends_on) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 elsif p_kind='loans' then
  if (v->>'starts_on')::date>(v->>'ends_on')::date or v->>'loan_account_id'=v->>'cash_account_id' then raise exception 'BUSINESS_INVALID_INPUT';end if;
 elsif p_kind='overhead_allocations' then
  parent:=(v->>'pool_id')::uuid;previous:=(old->>'pool_id')::uuid;
  if exists(select 1 from public.business_overhead_pools where tenant_id=p_tenant and id in (parent,previous) and status<>'draft') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if (v->>'work_order_id' is null)=(v->>'project_id' is null) then raise exception 'BUSINESS_INVALID_INPUT';end if;
  update public.business_overhead_pools set reviewed_by=null,calculation_snapshot=null,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id in (parent,previous);
 elsif p_kind='financial_report_lines' then
  if v->>'account_prefix' !~ '^[0-9]{1,12}$' or v->>'effective_to' is not null and (v->>'effective_from')::date>(v->>'effective_to')::date then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and starts_with(code,v->>'account_prefix')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 elsif p_kind='tax_brackets' then
  if v->>'upper_bound' is not null and (v->>'upper_bound')::numeric<=(v->>'lower_bound')::numeric then raise exception 'BUSINESS_TAX_BRACKETS_INVALID';end if;
  if exists(select 1 from public.business_tax_brackets b where b.tenant_id=p_tenant and b.policy_id=(v->>'policy_id')::uuid and b.id<>p_id and b.status='active' and b.lower_bound<coalesce((v->>'upper_bound')::numeric,1e30) and coalesce(b.upper_bound,1e30)>(v->>'lower_bound')::numeric) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
  if exists(select 1 from public.business_payroll_tax_runs where tenant_id=p_tenant and status='posted' and (calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('pitPolicyId',(v->>'policy_id')::uuid)) or calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('pitPolicyId',(old->>'policy_id')::uuid)))) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 elsif p_kind='staff_tax_profiles' then
  if v->>'ends_on' is not null and (v->>'starts_on')::date>(v->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if exists(select 1 from public.business_staff_tax_profiles p where p.tenant_id=p_tenant and p.staff_id=(v->>'staff_id')::uuid and p.id<>p_id and p.status='active' and p.starts_on<=coalesce((v->>'ends_on')::date,'infinity'::date) and coalesce(p.ends_on,'infinity'::date)>=(v->>'starts_on')::date) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
  if exists(select 1 from public.business_payroll_tax_runs where tenant_id=p_tenant and status='posted' and calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('profileId',p_id))) then
   for k in select jsonb_object_keys(v) loop if k not in ('name','notes','ends_on') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;
   if v->>'ends_on' is not null and exists(select 1 from public.business_payroll_tax_runs r join public.business_salary_runs s on s.tenant_id=r.tenant_id and s.id=r.salary_run_id where r.tenant_id=p_tenant and r.status='posted' and r.calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('profileId',p_id)) and s.ends_on>(v->>'ends_on')::date) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  end if;
 elsif p_kind='tax_policies' then
  if v->>'ends_on' is not null and (v->>'starts_on')::date>(v->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if exists(select 1 from public.business_tax_filings where tenant_id=p_tenant and policy_id=p_id and status='posted') or exists(select 1 from public.business_payroll_tax_runs where tenant_id=p_tenant and status='posted' and (calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('pitPolicyId',p_id)) or calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('insurancePolicyId',p_id)))) then
   for k in select jsonb_object_keys(v) loop if k not in ('name','notes','ends_on') and v->k is distinct from old->k then raise exception 'BUSINESS_RECORD_LOCKED';end if;end loop;
   if v->>'ends_on' is not null and (exists(select 1 from public.business_tax_filings where tenant_id=p_tenant and policy_id=p_id and status='posted' and ends_on>(v->>'ends_on')::date) or exists(select 1 from public.business_payroll_tax_runs r join public.business_salary_runs s on s.tenant_id=r.tenant_id and s.id=r.salary_run_id where r.tenant_id=p_tenant and r.status='posted' and (r.calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('pitPolicyId',p_id)) or r.calculation_snapshot->'rows' @> jsonb_build_array(jsonb_build_object('insurancePolicyId',p_id))) and s.ends_on>(v->>'ends_on')::date)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  end if;
 end if;
 if p_kind in ('costing_runs','stock_valuation_runs','closing_runs','tax_filings','overhead_pools') then
  if (v->>'starts_on')::date>(v->>'ends_on')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  if p_kind in ('costing_runs','stock_valuation_runs','closing_runs','tax_filings') and (v->>'ends_on')::date>(v->>'posting_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 end if;
 if p_kind='costing_runs' and ((v->>'target_type'='production' and (v->>'work_order_id' is null or v->>'project_id' is not null)) or (v->>'target_type'='project' and (v->>'project_id' is null or v->>'work_order_id' is not null))) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_kind='invoice_adjustments' and ((v->>'side'='sale' and (v->>'sales_invoice_id' is null or v->>'vendor_invoice_id' is not null)) or (v->>'side'='purchase' and (v->>'vendor_invoice_id' is null or v->>'sales_invoice_id' is not null))) then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if p_kind='asset_events' then
  if v->>'event_type'='maintenance_end' and (v->>'maintenance_cost')::numeric>0 and v->>'counter_account_id' is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if v->>'event_type'='dispose' and (v->>'expense_account_id' is null or (v->>'proceeds')::numeric>0 and (v->>'cash_account_id' is null or v->>'income_account_id' is null)) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 end if;
 if p_kind='loan_movements' and (v->>'fee')::numeric>0 and v->>'fee_account_id' is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
end $$;
revoke all on function public.business_misa_validate_save(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- A child edit must invalidate review of the previous AND new owner.
create function public.business_overhead_parent_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.business_overhead_pools where tenant_id=new.tenant_id and id=new.pool_id and status<>'draft') then
  if tg_op='INSERT' or new.pool_id is distinct from old.pool_id or new.basis is distinct from old.basis or new.work_order_id is distinct from old.work_order_id or new.project_id is distinct from old.project_id or new.status is distinct from old.status then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 end if;
 return new;
end $$;
revoke all on function public.business_overhead_parent_guard() from public,anon,authenticated,service_role;
create trigger business_overhead_parent_guard before insert or update on public.business_overhead_allocations for each row execute function public.business_overhead_parent_guard();
