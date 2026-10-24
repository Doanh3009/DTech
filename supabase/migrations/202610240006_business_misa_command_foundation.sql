-- New domains retain the original tenant session, UUID receipt, CAS and journal engine.
create function public.business_cash_available(p_tenant uuid,p_account uuid,p_date date,p_amount numeric) returns void
language plpgsql security definer set search_path='' as $$
declare minimum_balance numeric;
begin
 if not exists(select 1 from public.business_gl_accounts where tenant_id=p_tenant and id=p_account and status='active' and account_type='posting' and (code like '111%' or code like '112%')) then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 with daily as (select j.posting_date,sum(l.debit-l.credit) change from public.business_journal_entries j join public.business_journal_lines l on l.tenant_id=j.tenant_id and l.journal_id=j.id and l.status='active' where j.tenant_id=p_tenant and l.account_id=p_account and j.status='posted' group by j.posting_date), balances as (
  select posting_date,sum(change) over(order by posting_date) balance from daily
 ) select least(coalesce((select sum(change) from daily where posting_date<=p_date),0),coalesce((select min(balance) from balances where posting_date>p_date),1e30)) into minimum_balance;
 if p_amount<=0 or minimum_balance<p_amount then raise exception 'BUSINESS_INSUFFICIENT_FUNDS';end if;
end $$;
revoke all on function public.business_cash_available(uuid,uuid,date,numeric) from public,anon,authenticated,service_role;

create or replace function public.business_assert_kind(p_tenant uuid,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb;t public.business_tenants%rowtype;
begin
 select * into t from public.business_tenants where id=p_tenant;
 select definition into d from public.business_entity_definitions where kind=p_kind;
 if d is null or not(t.features ? (d->>'feature')) or (d ? 'industries' and not(d->'industries' ? t.industry)) or (d ? 'requiresFeatures' and not(t.features @> (d->'requiresFeatures'))) then raise exception 'BUSINESS_FORBIDDEN';end if;
 if (d->>'feature' in ('assets','costing')) and not(t.features ? 'accounting') then raise exception 'BUSINESS_FORBIDDEN';end if;
 return d;
end $$;

alter function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text) rename to business_save_record_before_misa;
alter function public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) rename to business_record_action_before_misa;
revoke all on function public.business_save_record_before_misa(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action_before_misa(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;

create function public.business_save_record(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;r jsonb;old jsonb;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'save:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 if coalesce((d->>'generatedOnly')::boolean,false) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into old using a.tenant_id,p_id;
 if d ? 'misaDomain' then
  perform public.business_misa_validate_save(a.tenant_id,p_kind,p_id,p_data,old);
 end if;
 r:=public.business_save_record_before_misa(p_hash,p_slug,p_kind,p_id,p_expected_version,p_data,p_request_id,p_payload_hash);
 if coalesce((d->>'requiresApproval')::boolean,false) then execute format('update public.%I set reviewed_by=null,calculation_snapshot=null where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id;end if;
 return r;
end $$;

create function public.business_record_action(p_hash text,p_slug text,p_kind text,p_id uuid,p_expected_version integer,p_action text,p_reason text,p_request_id uuid,p_payload_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.business_accounts%rowtype;d jsonb;v jsonb;r jsonb;calculation jsonb;effect jsonb;journal uuid;effective_date date;calculable boolean;
begin
 a:=public.business_assert_session(p_hash,p_slug,true);d:=public.business_assert_kind(a.tenant_id,p_kind);
 if not(d ? 'requiresApproval') then return public.business_record_action_before_misa(p_hash,p_slug,p_kind,p_id,p_expected_version,p_action,p_reason,p_request_id,p_payload_hash);end if;
 perform pg_advisory_xact_lock(hashtextextended('business:'||a.tenant_id,0));
 r:=public.business_command_replay(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash);if r is not null then return r;end if;
 execute format('select to_jsonb(x) from public.%I x where tenant_id=$1 and id=$2 for update',public.business_entity_table(p_kind)) into v using a.tenant_id,p_id;
 if v is null then raise exception 'BUSINESS_NOT_FOUND';end if;
 if p_expected_version is null or p_expected_version<>(v->>'row_version')::integer then raise exception 'BUSINESS_VERSION_CONFLICT';end if;
 if p_reason is null or char_length(btrim(p_reason)) not between 3 and 500 then raise exception 'BUSINESS_INVALID_INPUT';end if;
 calculable:=p_kind in ('asset_charge_runs','loan_movements','costing_runs','stock_valuation_runs','closing_runs','tax_filings','payroll_tax_runs','payroll_cost_allocations');
 if p_action='calculate' and v->>'status'='draft' and calculable then
  calculation:=public.business_misa_calculate(a.tenant_id,p_kind,v);
  perform public.business_misa_store_calculation(a.tenant_id,a.id,p_kind,v,calculation);
  execute format('update public.%I set calculation_snapshot=$3,reviewed_by=null,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,calculation;
 elsif p_action='approve' and v->>'status'='draft' then
  if a.id=(v->>'created_by')::uuid then raise exception 'BUSINESS_REVIEW_REQUIRED';end if;
  if calculable and (v->'calculation_snapshot' is null or v->'calculation_snapshot'='null'::jsonb or v->'calculation_snapshot'<>public.business_misa_calculate(a.tenant_id,p_kind,v)) then raise exception 'BUSINESS_CALCULATION_STALE';end if;
  execute format('update public.%I set reviewed_by=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,a.id;
 elsif p_action='cancel' and v->>'status'='draft' then
  execute format('update public.%I set status=''cancelled'',row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id;
 elsif p_action='post' and v->>'status'='draft' then
  if v->>'reviewed_by' is null or v->>'reviewed_by'=v->>'created_by' then raise exception 'BUSINESS_REVIEW_REQUIRED';end if;
  if calculable and (v->'calculation_snapshot' is null or v->'calculation_snapshot'='null'::jsonb or v->'calculation_snapshot'<>public.business_misa_calculate(a.tenant_id,p_kind,v)) then raise exception 'BUSINESS_CALCULATION_STALE';end if;
  effective_date:=coalesce(v->>'posting_date',v->>'document_date')::date;
  if effective_date is null or effective_date>(now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'BUSINESS_INVALID_DATE';end if;
  effect:=public.business_misa_effect(a.tenant_id,a.id,p_kind,v,'post',p_reason);
  if jsonb_array_length(coalesce(effect->'lines','[]'::jsonb))>0 then
   journal:=public.business_generated_journal(a.tenant_id,(v->>'created_by')::uuid,(v->>'reviewed_by')::uuid,p_kind,p_id,v->>'name',coalesce(v->>'document_date',v->>'posting_date')::date,effective_date,case when p_kind in ('costing_runs','stock_valuation_runs') then 'costing' else 'general' end,effect->'lines');
  end if;
  execute format('update public.%I set status=''posted'',posted_journal_id=$3,calculation_snapshot=coalesce(calculation_snapshot,''{}''::jsonb)||$4,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,journal,coalesce(effect->'snapshot','{}'::jsonb);
 elsif p_action='reverse' and v->>'status'='posted' and a.role='owner' then
  perform public.business_misa_effect(a.tenant_id,a.id,p_kind,v,'reverse',p_reason);
  if v->>'posted_journal_id' is not null then journal:=public.business_reverse_journal(a.tenant_id,(v->>'posted_journal_id')::uuid,a.id,p_reason);end if;
  execute format('update public.%I set status=''cancelled'',reversed_journal_id=$3,row_version=row_version+1,updated_at=now() where tenant_id=$1 and id=$2',public.business_entity_table(p_kind)) using a.tenant_id,p_id,journal;
 else raise exception 'BUSINESS_RECORD_LOCKED';end if;
 insert into public.business_audit(tenant_id,actor_id,action,entity_kind,entity_id,details) values(a.tenant_id,a.id,'misa.'||p_action,p_kind,p_id,jsonb_build_object('reason',p_reason,'journalId',journal,'beforeVersion',p_expected_version));
 r:=jsonb_build_object('recordId',p_id,'rowVersion',p_expected_version+1,'journalId',journal);
 insert into public.business_commands(request_id,tenant_id,actor_id,kind,payload_hash,receipt) values(p_request_id,a.tenant_id,a.id,'action:'||p_kind,p_payload_hash,r);return r;
end $$;
revoke all on function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.business_save_record(text,text,text,uuid,integer,jsonb,uuid,text),public.business_record_action(text,text,text,uuid,integer,text,text,uuid,text) to service_role;
