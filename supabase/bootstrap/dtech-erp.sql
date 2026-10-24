-- First-install bootstrap for the empty DTech project tcjjhxqtreemccdbvyza.
-- Removes only fixtures just introduced by the historical migrations.
-- Refuses any database with Auth users, unexpected entities or transactions.
begin;

do $$
begin
  if exists (select 1 from auth.users)
    or exists (select 1 from public.app_accounts where id <> 'a0000000-0000-4000-8000-000000000001' or auth_user_id is not null)
    or exists (select 1 from public.employees where id not in ('40000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003'))
    or exists (select 1 from public.projects where id <> 'b0000000-0000-4000-8000-000000000001')
    or exists (select 1 from public.inventory_items where id not in ('e2000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000003'))
    or exists (select 1 from public.warehouses where id not in ('e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002'))
    or exists (select 1 from public.attendance_events)
    or exists (select 1 from public.worker_attendance_sessions)
    or exists (select 1 from public.leave_requests)
    or exists (select 1 from public.inventory_documents)
    or exists (select 1 from public.shipments)
    or exists (select 1 from public.payroll_periods)
  then
    raise exception 'ERP_BOOTSTRAP_REQUIRES_FRESH_DATABASE';
  end if;
end $$;

delete from public.item_warehouse_settings where item_id in ('e2000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000003');
delete from public.inventory_items where id in ('e2000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000003');
delete from public.warehouses where id in ('e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002');
delete from public.item_categories where id in ('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003');
delete from public.project_issues where project_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.project_updates where project_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.project_assignments where project_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.worksites where project_id = 'b0000000-0000-4000-8000-000000000001';
delete from public.projects where id = 'b0000000-0000-4000-8000-000000000001';
delete from public.leave_ledger where employee_id = '40000000-0000-4000-8000-000000000004' and reference_type = 'opening_grant';
delete from public.employee_attendance_locations where employee_id = '40000000-0000-4000-8000-000000000004';
delete from public.shift_assignments where scope_type = 'employee' and scope_id in ('40000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
delete from public.account_roles where account_id = 'a0000000-0000-4000-8000-000000000001';
delete from public.app_accounts where id = 'a0000000-0000-4000-8000-000000000001';
delete from public.employees where id in ('40000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003');
delete from public.attendance_locations where name = 'Văn phòng Châu Tuấn';

commit;
