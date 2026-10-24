-- Source documents cannot be reversed while a downstream posted document consumes them.
do $$ declare body text;anchor text:='select * into h from public.business_journal_entries where tenant_id=p_tenant and id=p_id for update;';begin
 select pg_get_functiondef('public.business_reverse_journal(uuid,uuid,uuid,text)'::regprocedure) into body;
 if strpos(body,anchor)=0 then raise exception 'Review journal reversal before upgrading';end if;
 body:=replace(body,anchor,$guard$
 if exists(select 1 from public.business_assets s where s.tenant_id=p_tenant and s.recognition_journal_id=p_id and exists(select 1 from public.business_asset_events e where e.tenant_id=p_tenant and e.asset_id=s.id and e.event_type='register' and e.status='posted'))
 or exists(select 1 from public.business_bank_matches b join public.business_journal_lines l on l.tenant_id=b.tenant_id and l.id=b.journal_line_id where b.tenant_id=p_tenant and b.status='posted' and l.journal_id=p_id)
 or exists(select 1 from public.business_cost_source_links c join public.business_journal_lines l on l.tenant_id=c.tenant_id and l.id=c.journal_line_id where c.tenant_id=p_tenant and c.status='posted' and l.journal_id=p_id)
 or exists(select 1 from public.business_overhead_pools where tenant_id=p_tenant and source_journal_id=p_id and status='posted') then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 $guard$||anchor);execute body;
end $$;

create function public.business_guard_consumed_cost_source() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text:=substr(tg_table_name,10);
begin
 if old.status='posted' and new.status<>'posted' and (
 exists(select 1 from public.business_cost_source_links where tenant_id=old.tenant_id and source_kind=kind and source_record_id=old.id::text and status='posted') or
 exists(select 1 from public.business_costing_lines l join public.business_costing_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' where l.tenant_id=old.tenant_id and l.source_kind=kind and l.source_id=old.id::text)
 ) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_guard_consumed_cost_source() from public,anon,authenticated,service_role;
create trigger business_guard_consumed_material before update on public.business_material_issues for each row execute function public.business_guard_consumed_cost_source();
create trigger business_guard_consumed_project_material before update on public.business_project_materials for each row execute function public.business_guard_consumed_cost_source();
create trigger business_guard_consumed_project_cost before update on public.business_project_costs for each row execute function public.business_guard_consumed_cost_source();
create trigger business_guard_consumed_production_report before update on public.business_production_reports for each row execute function public.business_guard_consumed_cost_source();

create function public.business_guard_valued_production_cost() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.work_order_id is not null and (old.status='posted' or new.status='posted') and new.status<>old.status and exists(
  select 1 from public.business_stock_valuation_lines l join public.business_stock_valuation_runs r on r.tenant_id=l.tenant_id and r.id=l.run_id and r.status='posted' join public.business_work_orders w on w.tenant_id=l.tenant_id and w.item_id=l.item_id
  where l.tenant_id=new.tenant_id and w.id=new.work_order_id
 ) then raise exception 'BUSINESS_STOCK_VALUATION_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_guard_valued_production_cost() from public,anon,authenticated,service_role;
create trigger business_guard_valued_production_cost before update on public.business_costing_runs for each row execute function public.business_guard_valued_production_cost();

-- Closing does not erase the operating revenue metric.
do $$ declare body text;begin
 select pg_get_functiondef('public.business_company_dashboard(text,text,date)'::regprocedure) into body;
 if strpos(body,'j.document_type,g.code')=0 then raise exception 'Review revenue metric before upgrading';end if;
 body:=replace(body,'j.document_type,g.code','j.document_type,j.source_kind,g.code');
 body:=replace(body,'document_type<>''opening''','document_type<>''opening'' and source_kind is distinct from ''closing_runs''');execute body;
end $$;
