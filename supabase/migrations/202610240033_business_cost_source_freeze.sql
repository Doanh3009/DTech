-- An earlier movement must not silently change material already consumed by an approved costing run.
create function public.business_guard_costed_material() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'posted' or tg_op='UPDATE' and old.status='posted' then return new;end if;
 if exists(
  select 1 from public.business_costing_lines c join public.business_costing_runs r on r.tenant_id=c.tenant_id and r.id=c.run_id and r.status='posted'
  join public.business_stock_moves m on m.tenant_id=c.tenant_id and m.source_id::text=c.source_id and m.source_kind=case c.source_kind when 'material_issues' then 'material_issue' when 'project_materials' then 'project_material' else null end
  where c.tenant_id=new.tenant_id and c.source_kind in ('material_issues','project_materials') and m.status='posted' and m.item_id=new.item_id and m.warehouse_id=new.warehouse_id and m.lot_id is not distinct from new.lot_id and new.document_date<m.document_date
 ) then raise exception 'BUSINESS_MATERIAL_COST_LOCKED';end if;
 return new;
end $$;
revoke all on function public.business_guard_costed_material() from public,anon,authenticated,service_role;
create trigger business_costed_material_guard before insert or update on public.business_stock_moves for each row execute function public.business_guard_costed_material();

create index business_costing_source_lookup on public.business_costing_lines(tenant_id,source_kind,source_id,run_id);
create index business_receipt_cost_lookup on public.business_cost_receipt_values(tenant_id,receipt_id,run_id);
create index business_cost_link_journal_lookup on public.business_cost_source_links(tenant_id,journal_line_id,status);
create index business_posted_stock_timeline on public.business_stock_moves(tenant_id,item_id,warehouse_id,lot_id,document_date,created_at,id) where status='posted';
create index business_posted_staff_workdate on public.business_timecards(tenant_id,staff_id,work_date) where status='posted';
create index business_leave_balance_lookup on public.business_leave_requests(tenant_id,entitlement_id,status);
create index business_overtime_assignment_lookup on public.business_overtime_requests(tenant_id,assignment_id,status);
create index business_bank_match_statement_lookup on public.business_bank_matches(tenant_id,statement_line_id,status);
create index business_bank_match_journal_lookup on public.business_bank_matches(tenant_id,journal_line_id,status);
