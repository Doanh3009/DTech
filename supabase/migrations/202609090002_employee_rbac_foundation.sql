create extension if not exists pgcrypto;

do $$
begin
  alter type public.account_status add value if not exists 'pending_activation';
  alter type public.account_status add value if not exists 'locked';
exception
  when undefined_object then null;
end $$;

do $$
begin
  create type public.employee_gender as enum ('male', 'female', 'other', 'undisclosed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.employee_status as enum (
    'pending_onboarding',
    'probation',
    'active',
    'on_leave',
    'terminated'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.employee_profile_status as enum (
    'pending_hr_completion',
    'complete',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.employee_history_event_type as enum (
    'joined',
    'department_changed',
    'position_changed',
    'manager_changed',
    'employment_type_changed',
    'probation_confirmed',
    'on_leave',
    'returned',
    'terminated',
    'profile_updated',
    'sensitive_updated',
    'account_provisioned',
    'account_disabled',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.contract_status as enum ('draft', 'active', 'expired', 'terminated');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.employee_document_type as enum (
    'national_id',
    'contract',
    'cv',
    'degree',
    'certificate',
    'health_check',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_department_id uuid references public.departments(id),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_department_id is null or parent_department_id <> id)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  department_id uuid references public.departments(id),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employment_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  worker_category text not null check (
    worker_category in ('office', 'engineer', 'supervisor', 'worker', 'seasonal', 'contractor', 'support')
  ),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  full_name text not null,
  display_name text,
  date_of_birth date,
  gender public.employee_gender,
  avatar_file_id uuid references public.file_assets(id),
  personal_phone text not null,
  normalized_phone text not null,
  personal_email text,
  company_email text,
  current_address text,
  permanent_address text,
  province text,
  ward text,
  country text not null default 'Việt Nam',
  department_id uuid not null references public.departments(id),
  position_id uuid not null references public.positions(id),
  employment_type_id uuid not null references public.employment_types(id),
  manager_employee_id uuid references public.employees(id),
  contractor_name text,
  join_date date not null,
  probation_start_date date,
  official_date date,
  termination_date date,
  termination_reason text,
  employment_status public.employee_status not null default 'active',
  profile_status public.employee_profile_status not null default 'pending_hr_completion',
  profile_completeness integer not null default 0 check (profile_completeness between 0 and 100),
  note text,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  check (employee_code <> ''),
  check (full_name <> ''),
  check (manager_employee_id is null or manager_employee_id <> id),
  check (official_date is null or official_date >= join_date),
  check (termination_date is null or termination_date >= join_date)
);

create unique index if not exists employees_employee_code_unique_idx
  on public.employees (lower(employee_code));

create index if not exists employees_department_status_idx
  on public.employees (department_id, employment_status);

create index if not exists employees_position_idx
  on public.employees (position_id);

create index if not exists employees_type_idx
  on public.employees (employment_type_id);

create index if not exists employees_manager_idx
  on public.employees (manager_employee_id);

alter table public.departments
  add column if not exists manager_employee_id uuid;

do $$
begin
  alter table public.departments
    add constraint departments_manager_employee_fk
    foreign key (manager_employee_id) references public.employees(id);
exception
  when duplicate_object then null;
end $$;

alter table public.app_accounts
  add column if not exists employee_id uuid;

do $$
begin
  alter table public.app_accounts
    add constraint app_accounts_employee_fk
    foreign key (employee_id) references public.employees(id);
exception
  when duplicate_object then null;
end $$;

create unique index if not exists app_accounts_employee_unique_idx
  on public.app_accounts (employee_id)
  where employee_id is not null;

create table if not exists public.employee_sensitive_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  national_id_number text,
  national_id_issued_date date,
  national_id_issued_place text,
  national_id_expiry_date date,
  national_id_front_file_id uuid references public.file_assets(id),
  national_id_back_file_id uuid references public.file_assets(id),
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  bank_branch text,
  personal_tax_code text,
  social_insurance_code text,
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_sensitive_national_id_unique_idx
  on public.employee_sensitive_profiles (national_id_number)
  where national_id_number is not null;

create table if not exists public.employee_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  full_name text not null,
  relation text not null,
  phone text not null,
  note text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_emergency_contacts_employee_idx
  on public.employee_emergency_contacts (employee_id);

create table if not exists public.employee_contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  contract_number text not null,
  contract_type text not null,
  start_date date not null,
  end_date date,
  status public.contract_status not null default 'active',
  attachment_file_id uuid references public.file_assets(id),
  note text,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date <= end_date)
);

create unique index if not exists employee_contract_number_unique_idx
  on public.employee_contracts (lower(contract_number));

create index if not exists employee_contracts_employee_idx
  on public.employee_contracts (employee_id, start_date desc);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  document_type public.employee_document_type not null,
  title text not null,
  file_id uuid not null references public.file_assets(id),
  issued_date date,
  expiry_date date,
  note text,
  sensitive boolean not null default false,
  deleted_at timestamptz,
  uploaded_by uuid references public.app_accounts(id),
  uploaded_at timestamptz not null default now(),
  check (expiry_date is null or issued_date is null or issued_date <= expiry_date)
);

create index if not exists employee_documents_employee_idx
  on public.employee_documents (employee_id, uploaded_at desc)
  where deleted_at is null;

create table if not exists public.employee_history_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  event_type public.employee_history_event_type not null,
  event_date date not null,
  actor_account_id uuid references public.app_accounts(id),
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists employee_history_employee_idx
  on public.employee_history_events (employee_id, event_date desc, created_at desc);

create or replace function public.touch_employee_record()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.row_version = old.row_version + 1;
  return new;
end;
$$;

drop trigger if exists employees_touch_record on public.employees;
create trigger employees_touch_record
before update on public.employees
for each row execute function public.touch_employee_record();

drop trigger if exists departments_touch_updated_at on public.departments;
create trigger departments_touch_updated_at
before update on public.departments
for each row execute function public.touch_updated_at();

drop trigger if exists positions_touch_updated_at on public.positions;
create trigger positions_touch_updated_at
before update on public.positions
for each row execute function public.touch_updated_at();

drop trigger if exists employment_types_touch_updated_at on public.employment_types;
create trigger employment_types_touch_updated_at
before update on public.employment_types
for each row execute function public.touch_updated_at();

drop trigger if exists employee_sensitive_profiles_touch_updated_at on public.employee_sensitive_profiles;
create trigger employee_sensitive_profiles_touch_updated_at
before update on public.employee_sensitive_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists employee_emergency_contacts_touch_updated_at on public.employee_emergency_contacts;
create trigger employee_emergency_contacts_touch_updated_at
before update on public.employee_emergency_contacts
for each row execute function public.touch_updated_at();

drop trigger if exists employee_contracts_touch_updated_at on public.employee_contracts;
create trigger employee_contracts_touch_updated_at
before update on public.employee_contracts
for each row execute function public.touch_updated_at();

create or replace function public.prevent_employee_manager_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.manager_employee_id is null then
    return new;
  end if;

  if new.manager_employee_id = new.id then
    raise exception 'employee cannot manage themselves';
  end if;

  if exists (
    with recursive manager_chain as (
      select id, manager_employee_id
      from public.employees
      where id = new.manager_employee_id
      union all
      select e.id, e.manager_employee_id
      from public.employees e
      join manager_chain c on e.id = c.manager_employee_id
    )
    select 1 from manager_chain where id = new.id
  ) then
    raise exception 'employee manager cycle detected';
  end if;

  return new;
end;
$$;

drop trigger if exists employees_prevent_manager_cycle on public.employees;
create trigger employees_prevent_manager_cycle
before insert or update of manager_employee_id on public.employees
for each row execute function public.prevent_employee_manager_cycle();

alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employment_types enable row level security;
alter table public.employees enable row level security;
alter table public.employee_sensitive_profiles enable row level security;
alter table public.employee_emergency_contacts enable row level security;
alter table public.employee_contracts enable row level security;
alter table public.employee_documents enable row level security;
alter table public.employee_history_events enable row level security;

insert into public.departments (code, name, sort_order)
values
  ('board', 'Ban giám đốc', 10),
  ('hr', 'Nhân sự', 20),
  ('engineering', 'Kỹ thuật', 30),
  ('construction', 'Công trường', 40),
  ('warehouse', 'Kho', 50),
  ('import_export', 'Xuất nhập khẩu', 60),
  ('accounting', 'Kế toán', 70)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.positions (code, name, sort_order)
values
  ('director', 'Giám đốc', 10),
  ('hr_specialist', 'Nhân viên nhân sự', 20),
  ('engineer', 'Kỹ sư', 30),
  ('site_supervisor', 'Giám sát hiện trường', 40),
  ('worker', 'Công nhân', 50),
  ('warehouse_keeper', 'Thủ kho', 60),
  ('accountant', 'Kế toán', 70)
on conflict (code) do update
set name = excluded.name,
    sort_order = excluded.sort_order;

insert into public.employment_types (code, name, worker_category, sort_order)
values
  ('office_employee', 'Nhân viên văn phòng', 'office', 10),
  ('engineer', 'Kỹ sư', 'engineer', 20),
  ('supervisor', 'Giám sát', 'supervisor', 30),
  ('worker', 'Công nhân', 'worker', 40),
  ('seasonal_worker', 'Nhân sự thời vụ', 'seasonal', 50),
  ('subcontractor_worker', 'Nhân sự nhà thầu phụ', 'contractor', 60),
  ('support_staff', 'Nhân sự hỗ trợ', 'support', 70)
on conflict (code) do update
set name = excluded.name,
    worker_category = excluded.worker_category,
    sort_order = excluded.sort_order;

insert into public.permissions (key, module, description)
values
  ('employee.view_sensitive', 'employees', 'Xem thông tin nhân sự nhạy cảm'),
  ('employee.edit', 'employees', 'Chỉnh sửa hồ sơ nhân sự'),
  ('employee.edit_sensitive', 'employees', 'Chỉnh sửa thông tin nhân sự nhạy cảm'),
  ('employee.archive', 'employees', 'Lưu trữ hồ sơ nhân sự'),
  ('employee.offboard', 'employees', 'Xử lý nghỉ việc và vô hiệu hóa tài khoản liên quan'),
  ('employee.export_basic', 'employees', 'Xuất dữ liệu nhân sự cơ bản'),
  ('employee.export_sensitive', 'employees', 'Xuất dữ liệu nhân sự nhạy cảm'),
  ('account.view', 'accounts', 'Xem tài khoản đăng nhập'),
  ('account.create', 'accounts', 'Cấp tài khoản đăng nhập cho nhân sự'),
  ('account.disable', 'accounts', 'Vô hiệu hóa tài khoản đăng nhập'),
  ('account.enable', 'accounts', 'Kích hoạt lại tài khoản đăng nhập'),
  ('account.assign_role', 'accounts', 'Gán vai trò cho tài khoản'),
  ('account.revoke_sessions', 'accounts', 'Thu hồi phiên đăng nhập'),
  ('role.manage', 'settings', 'Quản lý vai trò và bộ quyền'),
  ('department.manage', 'settings', 'Quản lý phòng ban'),
  ('position.manage', 'settings', 'Quản lý chức vụ')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.roles (code, name, description, is_system)
values
  ('admin', 'Admin', 'Quản trị hệ thống với toàn bộ quyền hiện có.', true),
  ('hr', 'HR', 'Quản lý hồ sơ nhân sự, tài khoản và dữ liệu nhạy cảm theo phân quyền.', true),
  ('employee', 'Nhân viên', 'Xem thông tin cá nhân và các module self-service cơ bản.', true),
  ('supervisor', 'Giám sát', 'Theo dõi nhân sự hiện trường và điểm danh công nhân.', true)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_system = excluded.is_system;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.code = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on p.key = any(array[
  'dashboard.view',
  'employee.view',
  'employee.view_sensitive',
  'employee.create',
  'employee.edit',
  'employee.edit_sensitive',
  'employee.archive',
  'employee.offboard',
  'employee.export_basic',
  'account.view',
  'account.create',
  'account.disable',
  'account.assign_role',
  'role.view',
  'permission.view',
  'department.manage',
  'position.manage',
  'audit.view',
  'file.read'
])
where r.code = 'hr'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on p.key = any(array[
  'dashboard.view',
  'profile.view',
  'notification.view',
  'attendance.view',
  'timesheet.view',
  'leave.view',
  'file.read'
])
where r.code = 'employee'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
join public.permissions p on p.key = any(array[
  'dashboard.view',
  'employee.view',
  'worker_attendance.view',
  'project.view',
  'notification.view',
  'profile.view',
  'file.read'
])
where r.code = 'supervisor'
on conflict do nothing;
