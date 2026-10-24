create function public.business_loan_calculation(p_tenant uuid,v jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.business_loans%rowtype;interest numeric:=0;balance numeric;start_on date:=(v->>'interest_from')::date;end_on date:=(v->>'interest_to')::date;
begin
 select * into s from public.business_loans where tenant_id=p_tenant and id=(v->>'loan_id')::uuid and status='posted';if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if (v->>'posting_date')::date<s.starts_on or (v->>'principal')::numeric+(v->>'fee')::numeric<=0 and start_on is null then raise exception 'BUSINESS_INVALID_INPUT';end if;
 if start_on is not null or end_on is not null then
  if start_on is null or end_on is null or start_on>=end_on or end_on-start_on>3660 or start_on<s.starts_on or end_on>(v->>'posting_date')::date or v->>'movement_type'<>'repay' then raise exception 'BUSINESS_INVALID_DATE';end if;
  if exists(select 1 from public.business_loan_movements where tenant_id=p_tenant and loan_id=s.id and status='posted' and movement_type='repay' and interest_from<end_on and interest_to>start_on) then raise exception 'BUSINESS_PERIOD_OVERLAP';end if;
  select round(coalesce(sum(greatest(0,(select coalesce(sum(case m.movement_type when 'draw' then m.principal else -m.principal end),0) from public.business_loan_movements m where m.tenant_id=p_tenant and m.loan_id=s.id and m.status='posted' and m.posting_date<=d::date))*s.annual_rate/100/case s.day_basis when 'actual360' then 360 else 365 end),0),2) into interest from generate_series(start_on,end_on-1,interval '1 day') d;
 end if;
 select coalesce(sum(case movement_type when 'draw' then principal else -principal end),0) into balance from public.business_loan_movements where tenant_id=p_tenant and loan_id=s.id and status='posted' and posting_date<=(v->>'posting_date')::date;
 return jsonb_build_object('interest',interest,'outstanding',balance,'loanVersion',s.row_version,'rate',s.annual_rate,'dayBasis',s.day_basis);
end $$;
revoke all on function public.business_loan_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_treasury_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;lines jsonb:='[]';balance numeric;total numeric;other numeric;loan public.business_loans%rowtype;statement public.business_bank_statement_lines%rowtype;jline public.business_journal_lines%rowtype;cutoff date:=coalesce(v->>'posting_date',v->>'document_date')::date;
begin
 if p_kind='bank_matches' then
  if p_action='reverse' then return '{}';end if;
  select * into statement from public.business_bank_statement_lines where tenant_id=p_tenant and id=(v->>'statement_line_id')::uuid and status='active' for update;
  if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  select l.* into jline from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.reversed_by is null where l.tenant_id=p_tenant and l.id=(v->>'journal_line_id')::uuid and l.status='active';
  if not found or jline.account_id<>statement.bank_account_id or statement.direction='in' and jline.debit<=0 or statement.direction='out' and jline.credit<=0 then raise exception 'BUSINESS_BANK_MATCH_MISMATCH';end if;
  if cutoff<statement.value_date or exists(select 1 from public.business_journal_entries where tenant_id=p_tenant and id=jline.journal_id and posting_date>cutoff) then raise exception 'BUSINESS_INVALID_DATE';end if;
  select coalesce(sum(amount),0) into total from public.business_bank_matches where tenant_id=p_tenant and statement_line_id=statement.id and status='posted';
  select coalesce(sum(amount),0) into other from public.business_bank_matches where tenant_id=p_tenant and journal_line_id=jline.id and status='posted';
  if total+(v->>'amount')::numeric>statement.amount or other+(v->>'amount')::numeric>greatest(jline.debit,jline.credit) then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
  return jsonb_build_object('snapshot',jsonb_build_object('bankRef',statement.transaction_ref,'bankAccountId',statement.bank_account_id));
 elsif p_kind='advances' then
  if p_action='reverse' then
   if exists(select 1 from public.business_advance_settlements where tenant_id=p_tenant and advance_id=(v->>'id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;return '{}';
  end if;
  if (v->>'due_date')::date<(v->>'document_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  perform public.business_cash_available(p_tenant,(v->>'cash_account_id')::uuid,cutoff,(v->>'amount')::numeric);
  lines:=jsonb_build_array(jsonb_build_object('accountId',v->>'advance_account_id','debit',(v->>'amount')::numeric,'projectId',v->>'project_id'),jsonb_build_object('accountId',v->>'cash_account_id','credit',(v->>'amount')::numeric,'projectId',v->>'project_id'));
 elsif p_kind='advance_settlements' then
  select to_jsonb(x) into s from public.business_advances x where tenant_id=p_tenant and id=(v->>'advance_id')::uuid and status='posted' for update;if s is null then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if p_action='reverse' then return '{}';end if;
  if cutoff<(s->>'posting_date')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  total:=(v->>'expense_amount')::numeric+(v->>'returned_amount')::numeric;
  select coalesce(sum(expense_amount+returned_amount),0) into other from public.business_advance_settlements where tenant_id=p_tenant and advance_id=(s->>'id')::uuid and status='posted';
  if total<=0 or other+total>(s->>'amount')::numeric then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
  if (v->>'expense_amount')::numeric>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'expense_account_id','debit',(v->>'expense_amount')::numeric,'projectId',s->>'project_id'));end if;
  if (v->>'returned_amount')::numeric>0 then
   if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=(v->>'cash_account_id')::uuid and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'cash_account_id','debit',(v->>'returned_amount')::numeric,'projectId',s->>'project_id'));
  end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('accountId',s->>'advance_account_id','credit',total,'projectId',s->>'project_id'));
 elsif p_kind='loans' then
  if p_action='reverse' and exists(select 1 from public.business_loan_movements where tenant_id=p_tenant and loan_id=(v->>'id')::uuid and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  return '{}';
 elsif p_kind='loan_movements' then
  select * into loan from public.business_loans where tenant_id=p_tenant and id=(v->>'loan_id')::uuid and status='posted' for update;if not found then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
  if p_action='reverse' then
   if exists(select 1 from public.business_loan_movements where tenant_id=p_tenant and loan_id=loan.id and status='posted' and id<>(v->>'id')::uuid and (posting_date>cutoff or posting_date=cutoff and created_at>(v->>'created_at')::timestamptz)) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   if v->>'movement_type'='draw' and (v->>'principal')::numeric>(v->>'fee')::numeric then perform public.business_cash_available(p_tenant,loan.cash_account_id,(now() at time zone 'Asia/Ho_Chi_Minh')::date,(v->>'principal')::numeric-(v->>'fee')::numeric);end if;
   return '{}';
  end if;
  if exists(select 1 from public.business_loan_movements where tenant_id=p_tenant and loan_id=loan.id and status='posted' and posting_date>cutoff) then raise exception 'BUSINESS_INVALID_DATE';end if;
  total:=(v->>'principal')::numeric;
  if v->>'movement_type'='draw' then
   select coalesce(sum(principal),0) into other from public.business_loan_movements where tenant_id=p_tenant and loan_id=loan.id and status='posted' and movement_type='draw';
   if total<=0 or other+total>loan.principal_limit then raise exception 'BUSINESS_LOAN_LIMIT_EXCEEDED';end if;
   lines:=jsonb_build_array(jsonb_build_object('accountId',loan.cash_account_id,'debit',total,'partnerId',loan.partner_id),jsonb_build_object('accountId',loan.loan_account_id,'credit',total,'partnerId',loan.partner_id));
  else
   if total>(v->'calculation_snapshot'->>'outstanding')::numeric then raise exception 'BUSINESS_PAYMENT_EXCEEDED';end if;
   if total>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',loan.loan_account_id,'debit',total,'partnerId',loan.partner_id));end if;
   other:=(v->'calculation_snapshot'->>'interest')::numeric;if other>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',loan.interest_account_id,'debit',other,'partnerId',loan.partner_id));end if;
   total:=total+other+(v->>'fee')::numeric;
   perform public.business_cash_available(p_tenant,loan.cash_account_id,cutoff,total);
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',loan.cash_account_id,'credit',total,'partnerId',loan.partner_id));
  end if;
  if (v->>'fee')::numeric>0 then
   if v->>'movement_type'='draw' then
    perform public.business_cash_available(p_tenant,loan.cash_account_id,cutoff,greatest(0.0001,(v->>'fee')::numeric-(v->>'principal')::numeric));
    lines:=lines||jsonb_build_array(jsonb_build_object('accountId',loan.cash_account_id,'credit',(v->>'fee')::numeric,'partnerId',loan.partner_id));
   end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'fee_account_id','debit',(v->>'fee')::numeric,'partnerId',loan.partner_id));
  end if;
 else raise exception 'BUSINESS_INVALID_INPUT';end if;
 return jsonb_build_object('lines',lines);
end $$;
revoke all on function public.business_treasury_effect(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
