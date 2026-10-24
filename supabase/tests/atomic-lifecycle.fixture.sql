-- Extends atomic-employee.fixture.sql in a newly initialized local database.
-- All values below are synthetic; this file is never sent to Supabase.
insert into public.role_permissions(role_id,permission_key) values
  ('10000000-0000-4000-8000-000000000012','account.delete');
insert into public.roles(id,code,name) values
  ('10000000-0000-4000-8000-000000000015','integration_sensitive','Integration sensitive editor'),
  ('10000000-0000-4000-8000-000000000016','integration_archive','Integration archive'),
  ('10000000-0000-4000-8000-000000000017','integration_creator','Integration basic account creator');
insert into public.role_permissions(role_id,permission_key) values
  ('10000000-0000-4000-8000-000000000015','employee.edit_sensitive'),
  ('10000000-0000-4000-8000-000000000016','employee.archive'),
  ('10000000-0000-4000-8000-000000000017','account.create');
insert into public.app_accounts(id,username,display_name,status) values
  ('20000000-0000-4000-8000-000000000015','integration_sensitive_editor','Sensitive editor','active'),
  ('20000000-0000-4000-8000-000000000016','integration_archiver','Archiver','active'),
  ('20000000-0000-4000-8000-000000000017','integration_creator','Basic account creator','active');
insert into public.account_roles(account_id,role_id) values
  ('20000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000015'),
  ('20000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000016'),
  ('20000000-0000-4000-8000-000000000017','10000000-0000-4000-8000-000000000017');
insert into public.employee_sensitive_profiles(employee_id,national_id_number,national_id_issued_date,national_id_expiry_date,bank_name,bank_account_number,personal_tax_code)
values ('30000000-0000-4000-8000-000000000003','012345678901','2020-01-02','2030-01-02','Synthetic bank','999888777','TEST-TAX-ONLY');
