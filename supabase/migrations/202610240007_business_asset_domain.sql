-- Straight-line amounts are configured per asset; no statutory rate is embedded.
create function public.business_asset_expected(p_tenant uuid,p_asset uuid,p_date date) returns numeric language plpgsql security definer set search_path='' as $$
declare s public.business_assets%rowtype;m date;last_day date;first_day date;stop_day date;rate numeric;total numeric:=0;
begin
 select * into s from public.business_assets where tenant_id=p_tenant and id=p_asset;
 if not found or p_date<s.starts_on then return 0;end if;
 stop_day:=least(p_date,(s.starts_on+make_interval(months=>s.useful_months::integer)-interval '1 day')::date);
 rate:=(s.original_cost-s.residual_value)/s.useful_months;
 for m in select generate_series(date_trunc('month',s.starts_on)::date,date_trunc('month',stop_day)::date,interval '1 month')::date loop
  last_day:=(m+interval '1 month - 1 day')::date;first_day:=greatest(m,s.starts_on);
  total:=total+rate*greatest(0,least(stop_day,last_day)-first_day+1)/(last_day-m+1);
 end loop;
 if p_date>=(s.starts_on+make_interval(months=>s.useful_months::integer)-interval '1 day')::date then total:=s.original_cost-s.residual_value;end if;
 return round(least(s.original_cost-s.residual_value,greatest(0,total)),2);
end $$;
revoke all on function public.business_asset_expected(uuid,uuid,date) from public,anon,authenticated,service_role;

create function public.business_asset_calculation(p_tenant uuid,p_row jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:='[]';s record;charged numeric;expected numeric;amount numeric;cutoff date:=(p_row->>'posting_date')::date;
begin
 if cutoff is null or cutoff>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
 for s in select x.* from public.business_assets x where x.tenant_id=p_tenant and x.status='active' and x.service_state<>'disposed' and x.starts_on<=cutoff and (p_row->>'asset_type'='all' or x.asset_type=p_row->>'asset_type') and exists(select 1 from public.business_asset_events e where e.tenant_id=p_tenant and e.asset_id=x.id and e.event_type='register' and e.status='posted' and e.document_date<=cutoff) order by x.id loop
  if exists(select 1 from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant and l.asset_id=s.id and r.status='posted' and r.posting_date>cutoff) then raise exception 'BUSINESS_INVALID_DATE';end if;
  select s.opening_depreciation+coalesce(sum(l.amount),0) into charged from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant and l.asset_id=s.id and r.status='posted';
  expected:=public.business_asset_expected(p_tenant,s.id,cutoff);amount:=greatest(0,expected-charged);
  if amount>0 then result:=result||jsonb_build_array(jsonb_build_object('assetId',s.id,'assetCode',s.code,'assetName',s.name,'assetVersion',s.row_version,'amount',amount,'accumulated',charged+amount,'remaining',s.original_cost-charged-amount,'expenseAccountId',s.expense_account_id,'accumulatedAccountId',s.accumulated_account_id,'projectId',s.project_id));end if;
 end loop;
 return jsonb_build_object('rows',result,'total',coalesce((select sum((x->>'amount')::numeric) from jsonb_array_elements(result) x),0));
end $$;
revoke all on function public.business_asset_calculation(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.business_asset_effect(p_tenant uuid,p_actor uuid,p_kind text,v jsonb,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.business_assets%rowtype;lines jsonb:='[]';x jsonb;old_state jsonb;event_action text:=v->>'event_type';aid uuid:=(v->>'asset_id')::uuid;charged numeric;cost numeric;available numeric;used numeric;cutoff date:=(v->>'document_date')::date;
begin
 if p_kind='asset_charge_runs' then
  if p_action='reverse' then
   if exists(select 1 from public.business_asset_charge_lines l join public.business_asset_events e on e.tenant_id=l.tenant_id and e.asset_id=l.asset_id and e.status='posted' and e.document_date>=(v->>'posting_date')::date where l.tenant_id=p_tenant and l.run_id=(v->>'id')::uuid) or exists(select 1 from public.business_asset_charge_lines l join public.business_asset_charge_lines n on n.tenant_id=l.tenant_id and n.asset_id=l.asset_id join public.business_asset_charge_runs r on r.tenant_id=n.tenant_id and r.id=n.run_id and r.status='posted' and r.posting_date>(v->>'posting_date')::date where l.tenant_id=p_tenant and l.run_id=(v->>'id')::uuid) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
   return '{}';
  end if;
  for x in select value from jsonb_array_elements(v->'calculation_snapshot'->'rows') loop
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',x->>'expenseAccountId','debit',(x->>'amount')::numeric,'projectId',x->>'projectId'),jsonb_build_object('accountId',x->>'accumulatedAccountId','credit',(x->>'amount')::numeric,'projectId',x->>'projectId'));
  end loop;
  if jsonb_array_length(lines)=0 then raise exception 'BUSINESS_ORDER_EMPTY';end if;
  return jsonb_build_object('lines',lines);
 end if;
 select * into s from public.business_assets where tenant_id=p_tenant and id=aid for update;
 if not found or s.status<>'active' then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if p_action='reverse' then
  if exists(select 1 from public.business_asset_events where tenant_id=p_tenant and asset_id=aid and status='posted' and id<>(v->>'id')::uuid and (document_date>cutoff or (document_date=cutoff and created_at>(v->>'created_at')::timestamptz))) or exists(select 1 from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant and l.asset_id=aid and r.status='posted' and r.posting_date>=cutoff) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  old_state:=v->'calculation_snapshot'->'before';if old_state is null then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  update public.business_assets set service_state=old_state->>'serviceState',project_id=(old_state->>'projectId')::uuid,custodian_id=(old_state->>'custodianId')::uuid,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=aid;
  return '{}';
 end if;
 if cutoff<s.acquired_on or exists(select 1 from public.business_asset_events where tenant_id=p_tenant and asset_id=aid and status='posted' and document_date>cutoff) then raise exception 'BUSINESS_INVALID_DATE';end if;
 old_state:=jsonb_build_object('serviceState',s.service_state,'projectId',s.project_id,'custodianId',s.custodian_id);
 if event_action='register' then
  if exists(select 1 from public.business_asset_events where tenant_id=p_tenant and asset_id=aid and event_type='register' and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  select coalesce(sum(l.debit),0) into available from public.business_journal_lines l join public.business_journal_entries j on j.tenant_id=l.tenant_id and j.id=l.journal_id and j.status='posted' and j.reversed_by is null where l.tenant_id=p_tenant and l.journal_id=s.recognition_journal_id and l.account_id=s.asset_account_id and l.status='active' and j.posting_date<=cutoff;
  select coalesce(sum(x.original_cost),0) into used from public.business_assets x where x.tenant_id=p_tenant and x.id<>aid and x.recognition_journal_id=s.recognition_journal_id and x.asset_account_id=s.asset_account_id and exists(select 1 from public.business_asset_events e where e.tenant_id=p_tenant and e.asset_id=x.id and e.status='posted' and e.event_type='register');
  if s.original_cost+used>available then raise exception 'BUSINESS_ASSET_SOURCE_EXCEEDED';end if;
  select coalesce(sum(x.opening_depreciation),0) into used from public.business_assets x where x.tenant_id=p_tenant and x.id<>aid and x.recognition_journal_id=s.recognition_journal_id and x.accumulated_account_id=s.accumulated_account_id and exists(select 1 from public.business_asset_events e where e.tenant_id=p_tenant and e.asset_id=x.id and e.status='posted' and e.event_type='register');
  if s.opening_depreciation>0 and used+s.opening_depreciation>(select coalesce(sum(l.credit),0) from public.business_journal_lines l where l.tenant_id=p_tenant and l.journal_id=s.recognition_journal_id and l.account_id=s.accumulated_account_id and l.status='active') then raise exception 'BUSINESS_ASSET_SOURCE_EXCEEDED';end if;
 elsif not exists(select 1 from public.business_asset_events where tenant_id=p_tenant and asset_id=aid and event_type='register' and status='posted') then raise exception 'BUSINESS_ASSET_NOT_REGISTERED';
 elsif event_action in ('assign','return') then
  if s.service_state in ('maintenance','disposed') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if exists(select 1 from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' and r.posting_date>=cutoff where l.tenant_id=p_tenant and l.asset_id=aid) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  select s.opening_depreciation+coalesce(sum(l.amount),0) into charged from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant and l.asset_id=aid and r.status='posted';
  if charged<public.business_asset_expected(p_tenant,aid,cutoff-1) then raise exception 'BUSINESS_ASSET_DEPRECIATION_REQUIRED';end if;
  if event_action='assign' and v->>'staff_id' is null and v->>'project_id' is null and coalesce(btrim(v->>'location'),'')='' then raise exception 'BUSINESS_INVALID_INPUT';end if;
  if event_action='assign' and s.service_state='in_use' then raise exception 'BUSINESS_ASSET_ALREADY_ASSIGNED';end if;
  update public.business_assets set service_state=case event_action when 'assign' then 'in_use' else 'ready' end,custodian_id=case when event_action='assign' then (v->>'staff_id')::uuid else null end,project_id=(v->>'project_id')::uuid,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=aid;
 elsif event_action='maintenance_start' then
  if s.service_state='disposed' or s.service_state='maintenance' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  update public.business_assets set service_state='maintenance',row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=aid;
 elsif event_action='maintenance_end' then
  if s.service_state<>'maintenance' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  update public.business_assets set service_state=case when custodian_id is not null then 'in_use' else 'ready' end,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=aid;
  cost:=(v->>'maintenance_cost')::numeric;if cost>0 then perform public.business_cash_available(p_tenant,(v->>'counter_account_id')::uuid,(v->>'posting_date')::date,cost);lines:=jsonb_build_array(jsonb_build_object('accountId',s.expense_account_id,'debit',cost,'projectId',s.project_id),jsonb_build_object('accountId',v->>'counter_account_id','credit',cost,'projectId',s.project_id));end if;
 elsif event_action='dispose' then
  if s.service_state='disposed' or s.service_state='maintenance' then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  select s.opening_depreciation+coalesce(sum(l.amount),0) into charged from public.business_asset_charge_lines l join public.business_asset_charge_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id where l.tenant_id=p_tenant and l.asset_id=aid and r.status='posted';
  if charged<public.business_asset_expected(p_tenant,aid,cutoff) then raise exception 'BUSINESS_ASSET_DEPRECIATION_REQUIRED';end if;
  if charged>0 then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',s.accumulated_account_id,'debit',charged,'projectId',s.project_id));end if;
  if s.original_cost>charged then lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'expense_account_id','debit',s.original_cost-charged,'projectId',s.project_id));end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('accountId',s.asset_account_id,'credit',s.original_cost,'projectId',s.project_id));
  cost:=(v->>'proceeds')::numeric;if cost>0 then
   if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=(v->>'cash_account_id')::uuid and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',v->>'cash_account_id','debit',cost),jsonb_build_object('accountId',v->>'income_account_id','credit',cost));
  end if;
  update public.business_assets set service_state='disposed',custodian_id=null,row_version=row_version+1,updated_at=now() where tenant_id=p_tenant and id=aid;
 else raise exception 'BUSINESS_INVALID_INPUT';end if;
 return jsonb_build_object('lines',lines,'snapshot',jsonb_build_object('before',old_state));
end $$;
revoke all on function public.business_asset_effect(uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
