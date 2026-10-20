-- Remove only the fixed development dataset. Run in local/staging only.
-- Legacy helper: posted/audit records remain protected. Prefer test:reset.
do $$ begin
  if not exists(select 1 from public.app_configurations where key='testing.environment.guard' and value->>'owner'='ct-noibo-test-v1') then
    raise exception 'TEST_DATABASE_CONFIRMATION_REQUIRED';
  end if;
end $$;
begin;
delete from public.message_attachments where conversation_id='98600000-0000-4000-8000-000000000001';
delete from public.message_attachments where conversation_id='98600000-0000-4000-8000-000000000002';
delete from public.attendance_photos where id='98900000-0000-4000-8000-000000000002';
delete from public.worker_attendance_photos where id='98900000-0000-4000-8000-000000000003';
delete from public.file_assets where metadata->>'testData'='true';
delete from public.conversations where id in('98600000-0000-4000-8000-000000000001','98600000-0000-4000-8000-000000000002');
delete from public.notifications where delivery_key like 'test:%';
delete from public.user_todos where user_id in('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
delete from public.user_dashboard_notes where account_id in('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
delete from public.payslips where id::text like '98420000-0000-4000-8000-%';
delete from public.payslips where id::text like '98440000-0000-4000-8000-%';
delete from public.payroll_periods where id::text like '98400000-0000-4000-8000-%';
delete from public.timesheet_periods where id::text like '98300000-0000-4000-8000-%';
delete from public.shipments where id='98200000-0000-4000-8000-000000000001';
delete from public.import_contracts where id='98100000-0000-4000-8000-000000000001';
delete from public.business_partners where id in('98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000002');
delete from public.inventory_documents where id='97000000-0000-4000-8000-000000000001';
delete from public.worker_attendance_sessions where id='95000000-0000-4000-8000-000000000001';
delete from public.attendance_events where id in('94000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000002');
delete from public.attendance_events where id::text like '94200000-0000-4000-8000-%';
delete from public.leave_requests where id='96000000-0000-4000-8000-000000000001';
delete from public.project_assignments where id='93000000-0000-4000-8000-000000000001';
delete from public.project_assignments where id::text like '93010000-0000-4000-8000-%';
delete from public.employee_contracts where id in('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002');
delete from public.app_accounts where id in('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
delete from public.employees where id in('90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002');
commit;
