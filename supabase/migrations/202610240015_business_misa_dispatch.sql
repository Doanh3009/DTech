create function public.business_misa_calculate(p_tenant uuid,p_kind text,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 case p_kind
 when 'asset_charge_runs' then return public.business_asset_calculation(p_tenant,v);
 when 'loan_movements' then return public.business_loan_calculation(p_tenant,v);
 when 'costing_runs' then return public.business_costing_calculation(p_tenant,v);
 when 'stock_valuation_runs' then return public.business_stock_valuation_calculation(p_tenant,v);
 when 'closing_runs' then return public.business_closing_calculation(p_tenant,v);
 when 'tax_filings' then return public.business_tax_calculation(p_tenant,v);
 when 'payroll_tax_runs' then return public.business_payroll_tax_calculation(p_tenant,v);
 when 'payroll_cost_allocations' then return public.business_payroll_cost_calculation(p_tenant,v);
 else raise exception 'BUSINESS_INVALID_INPUT';end case;
end $$;
revoke all on function public.business_misa_calculate(uuid,text,jsonb) from public,anon,authenticated,service_role;

create function public.business_misa_store_calculation(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,c jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x jsonb;n integer:=0;run uuid:=(v->>'id')::uuid;code text;name text;allocated numeric:=0;output_value numeric;output_count integer;output_index integer:=0;
begin
 if p_kind='asset_charge_runs' then delete from public.business_asset_charge_lines where tenant_id=p_tenant and run_id=run;
 elsif p_kind='costing_runs' then delete from public.business_costing_lines where tenant_id=p_tenant and run_id=run;delete from public.business_cost_receipt_values where tenant_id=p_tenant and run_id=run;
 elsif p_kind='stock_valuation_runs' then delete from public.business_stock_valuation_lines where tenant_id=p_tenant and run_id=run;
 elsif p_kind='tax_filings' then delete from public.business_tax_filing_lines where tenant_id=p_tenant and filing_id=run;
 elsif p_kind='payroll_tax_runs' then delete from public.business_payroll_statutory_lines where tenant_id=p_tenant and run_id=run;
 end if;
 for x in select value from jsonb_array_elements(coalesce(c->'rows','[]')) loop
  n:=n+1;code:='CT-'||run::text||'-'||n;name:=left((v->>'name')||' · '||n,180);
  if p_kind='asset_charge_runs' then
   insert into public.business_asset_charge_lines(tenant_id,created_by,code,name,run_id,asset_id,amount,accumulated,remaining,project_id) values(p_tenant,p_actor,code,name,run,(x->>'assetId')::uuid,(x->>'amount')::numeric,(x->>'accumulated')::numeric,(x->>'remaining')::numeric,(x->>'projectId')::uuid);
  elsif p_kind='costing_runs' then
   insert into public.business_costing_lines(tenant_id,created_by,code,name,run_id,source_kind,source_id,category,amount,calculation_snapshot) values(p_tenant,p_actor,code,name,run,x->>'sourceKind',x->>'sourceId',x->>'category',(x->>'amount')::numeric,x);
  elsif p_kind='stock_valuation_runs' then
   insert into public.business_stock_valuation_lines(tenant_id,created_by,code,name,run_id,stock_move_id,item_id,quantity,unit_cost,amount) values(p_tenant,p_actor,code,name,run,(x->>'stockMoveId')::uuid,(x->>'itemId')::uuid,(x->>'quantity')::numeric,(x->>'unitCost')::numeric,(x->>'amount')::numeric);
  elsif p_kind='tax_filings' then
   insert into public.business_tax_filing_lines(tenant_id,created_by,code,name,filing_id,indicator,source_kind,source_id,base_amount,tax_amount) values(p_tenant,p_actor,code,name,run,x->>'indicator',x->>'source_kind',x->>'source_id',(x->>'base_amount')::numeric,(x->>'tax_amount')::numeric);
  elsif p_kind='payroll_tax_runs' then
   insert into public.business_payroll_statutory_lines(tenant_id,created_by,code,name,run_id,staff_id,gross_amount,taxable_amount,employee_insurance,employer_insurance,pit,manual_deductions) values(p_tenant,p_actor,code,name,run,(x->>'staffId')::uuid,(x->>'gross')::numeric,(x->>'taxable')::numeric,(x->>'employeeInsurance')::numeric,(x->>'employerInsurance')::numeric,(x->>'pit')::numeric,(x->>'manual')::numeric);
  end if;
 end loop;
 if p_kind='costing_runs' and (c->>'finishedQuantity')::numeric>0 then
  output_count:=jsonb_array_length(c->'outputs');
  for x in select value from jsonb_array_elements(c->'outputs') loop
   output_index:=output_index+1;output_value:=case when output_index=output_count then (c->>'completed')::numeric-allocated else round((c->>'completed')::numeric*(x->>'quantity')::numeric/(c->>'finishedQuantity')::numeric,2) end;allocated:=allocated+output_value;
   insert into public.business_cost_receipt_values(tenant_id,created_by,code,name,run_id,receipt_id,quantity,amount,unit_cost) values(p_tenant,p_actor,'GT-'||run::text||'-'||output_index,left('Giá thành '||(x->>'code'),180),run,(x->>'receiptId')::uuid,(x->>'quantity')::numeric,output_value,round(output_value/(x->>'quantity')::numeric,4));
  end loop;
 end if;
 if p_kind='asset_charge_runs' then update public.business_asset_charge_runs set total_amount=(c->>'total')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='loan_movements' then update public.business_loan_movements set interest=(c->>'interest')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='costing_runs' then update public.business_costing_runs set total_amount=(c->>'total')::numeric,completed_amount=(c->>'completed')::numeric,finished_quantity=(c->>'finishedQuantity')::numeric,completion_percent=(c->>'completionPercent')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='stock_valuation_runs' then update public.business_stock_valuation_runs set total_amount=(c->>'total')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='closing_runs' then update public.business_closing_runs set total_amount=(c->>'total')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='tax_filings' then update public.business_tax_filings set base_amount=(c->>'base')::numeric,tax_amount=(c->>'tax')::numeric,tax_credit=(c->>'credit')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='payroll_tax_runs' then update public.business_payroll_tax_runs set total_amount=(c->>'total')::numeric where tenant_id=p_tenant and id=run;
 elsif p_kind='payroll_cost_allocations' then update public.business_payroll_cost_allocations set amount=(c->>'total')::numeric where tenant_id=p_tenant and id=run;
 end if;
end $$;
revoke all on function public.business_misa_store_calculation(uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.business_misa_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text,p_reason text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_kind in ('asset_events','asset_charge_runs') then return public.business_asset_effect(p_tenant,p_actor,p_kind,v,p_action);
 elsif p_kind in ('bank_matches','advances','advance_settlements','loans','loan_movements') then return public.business_treasury_effect(p_tenant,p_actor,p_kind,v,p_action);
 elsif p_kind in ('invoice_adjustments','invoice_refunds') then return public.business_invoice_adjustment_effect(p_tenant,v,p_action);
 elsif p_kind in ('costing_runs','cost_source_links','overhead_pools') then return public.business_costing_effect(p_tenant,p_actor,p_kind,v,p_action);
 elsif p_kind='stock_valuation_runs' then return public.business_stock_valuation_effect(p_tenant,v,p_action);
 elsif p_kind in ('closing_runs','tax_filings') then return public.business_closing_tax_effect(p_tenant,p_kind,v,p_action);
 elsif p_kind='payroll_tax_runs' then return public.business_payroll_tax_effect(p_tenant,v,p_action);
 elsif p_kind='payroll_cost_allocations' then return public.business_payroll_cost_effect(p_tenant,v,p_action);
 else raise exception 'BUSINESS_INVALID_INPUT';end if;
end $$;
revoke all on function public.business_misa_effect(uuid,uuid,text,jsonb,text,text) from public,anon,authenticated,service_role;

create function public.business_guard_extended_period_close() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;pending boolean;
begin
 if new.status='completed' and old.status<>'completed' then
  foreach kind in array array['asset_events','asset_charge_runs','advances','advance_settlements','loan_movements','costing_runs','stock_valuation_runs','invoice_adjustments','invoice_refunds','closing_runs','tax_filings','payroll_tax_runs'] loop
   execute format('select exists(select 1 from public.%I where tenant_id=$1 and status=''draft'' and posting_date between $2 and $3)',public.business_entity_table(kind)) into pending using new.tenant_id,new.starts_on,new.ends_on;
   if pending then raise exception 'BUSINESS_UNPOSTED_DOCUMENTS';end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.business_guard_extended_period_close() from public,anon,authenticated,service_role;
create trigger business_guard_extended_period_close before update on public.business_accounting_periods for each row execute function public.business_guard_extended_period_close();
