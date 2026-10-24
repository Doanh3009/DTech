create function public.business_salary_payment_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.business_salary_runs%rowtype;l public.business_salary_lines%rowtype;paid numeric;staff_name text;
begin
 select * into r from public.business_salary_runs where tenant_id=p_tenant and id=(v->>'salary_run_id')::uuid and status='posted';
 select * into l from public.business_salary_lines where tenant_id=p_tenant and salary_run_id=r.id and staff_id=(v->>'staff_id')::uuid and status='active';
 if l.id is null or (v->>'posting_date')::date<r.posting_date or (v->>'document_date')::date<r.ends_on then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if (v->>'document_date')::date>(v->>'posting_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 select coalesce(sum(amount),0) into paid from public.business_salary_payments where tenant_id=p_tenant and salary_run_id=r.id and staff_id=l.staff_id and status='posted';
 if (v->>'amount')::numeric>l.net_amount-paid then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
 select name into staff_name from public.business_staff where tenant_id=p_tenant and id=l.staff_id;
 return jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('staffName',staff_name,'sourceCode',r.code,'netSalary',l.net_amount,'paidBefore',paid,'remainingBefore',l.net_amount-paid,'amount',(v->>'amount')::numeric,'sourceVersion',l.row_version)),'total',(v->>'amount')::numeric,'netSalary',l.net_amount,'paidBefore',paid,'remainingBefore',l.net_amount-paid,'runVersion',r.row_version);
end $$;
revoke all on function public.business_salary_payment_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_salary_payment_effect(p_tenant uuid,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare account uuid;
begin
 if p_action='reverse' then return '{}';end if;
 select payable_account_id into account from public.business_salary_runs where tenant_id=p_tenant and id=(v->>'salary_run_id')::uuid and status='posted';if account is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 perform public.business_cash_available(p_tenant,(v->>'cash_account_id')::uuid,(v->>'posting_date')::date,(v->>'amount')::numeric);
 return jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('accountId',account,'debit',(v->>'amount')::numeric),jsonb_build_object('accountId',v->>'cash_account_id','credit',(v->>'amount')::numeric)));
end $$;
revoke all on function public.business_salary_payment_effect(uuid,jsonb,text) from public,anon,authenticated,service_role;

do $$ declare body text;anchor text;begin
 select pg_get_functiondef('public.business_misa_calculate(uuid,text,jsonb)'::regprocedure) into body;execute replace(body,E'begin\n',E'begin\n if p_kind=''salary_payments'' then return public.business_salary_payment_calculation(p_tenant,v);end if;\n');
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;execute replace(body,E'begin\n',E'begin\n if p_kind=''salary_payments'' then return public.business_salary_payment_effect(p_tenant,v,p_action);end if;\n');
 select pg_get_functiondef('public.business_misa_store_calculation(uuid,uuid,text,jsonb,jsonb)'::regprocedure) into body;execute replace(body,E'begin\n',E'begin\n if p_kind=''salary_payments'' then update public.business_salary_payments set net_salary=(c->>''netSalary'')::numeric,paid_before=(c->>''paidBefore'')::numeric,remaining_before=(c->>''remainingBefore'')::numeric where tenant_id=p_tenant and id=(v->>''id'')::uuid;return;end if;\n');
 select pg_get_functiondef('public.business_reverse_journal(uuid,uuid,uuid,text)'::regprocedure) into body;anchor:='select * into h from public.business_journal_entries where tenant_id=p_tenant and id=p_id for update;';
 if strpos(body,anchor)=0 then raise exception 'Review paid payroll source reversal';end if;
 execute replace(body,anchor,'if exists(select 1 from public.business_salary_payments p join public.business_journal_entries j on j.tenant_id=p.tenant_id and j.source_kind=''salary_runs'' and j.source_id=p.salary_run_id where p.tenant_id=p_tenant and p.status=''posted'' and j.id=p_id) then raise exception ''BUSINESS_RECORD_LOCKED'';end if;'||anchor);
 select pg_get_functiondef('public.business_misa_snapshot(text,text,text,date,date,integer)'::regprocedure) into body;
 body:=replace(body,'when ''reports'' then ''financial_report_lines''','when ''payroll'' then ''salary_payments'' when ''reports'' then ''financial_report_lines''');
 anchor:=E'else\n  source_sql:=$q$with ledger as (';if strpos(body,anchor)=0 then raise exception 'Review payroll balances readmodel';end if;
 body:=replace(body,anchor,$branch$elsif p_view='payroll' then
  source_sql:=$q$select l.id,r.code,r.name,s.name staff,r.posting_date,l.net_amount,coalesce(p.paid,0) paid,l.net_amount-coalesce(p.paid,0) remaining from public.business_salary_lines l join public.business_salary_runs r on r.tenant_id=l.tenant_id and r.id=l.salary_run_id and r.status='posted' join public.business_staff s on s.tenant_id=l.tenant_id and s.id=l.staff_id left join lateral(select sum(amount) paid from public.business_salary_payments where tenant_id=l.tenant_id and salary_run_id=r.id and staff_id=l.staff_id and status='posted') p on true where l.tenant_id=$1 and l.status='active' and r.ends_on between $2 and $3$q$;
  stats_sql:=$q$jsonb_build_object('net',coalesce(sum(net_amount),0),'paid',coalesce(sum(paid),0),'remaining',coalesce(sum(remaining),0),'unpaidStaffRows',count(*) filter(where remaining>0))$q$;
 $branch$||anchor);execute body;
end $$;
