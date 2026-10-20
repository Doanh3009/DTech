create table if not exists public.employee_insurance_profiles (
  employee_id uuid primary key references public.employees(id) on delete restrict,
  social_insurance_number text not null,
  participation_status text not null check(participation_status in ('active','suspended','ended','not_participating')),
  start_date date,
  contribution_base numeric(18,2) check(contribution_base is null or contribution_base >= 0),
  social_insurance_enabled boolean not null default true,
  health_insurance_enabled boolean not null default true,
  unemployment_insurance_enabled boolean not null default true,
  updated_by uuid not null references public.app_accounts(id),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_insurance_profiles_number_idx
  on public.employee_insurance_profiles(social_insurance_number)
  where social_insurance_number <> '';

create table if not exists public.employee_insurance_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  change_type text not null check(change_type in ('joined','adjusted','suspended','resumed','ended')),
  effective_date date not null,
  snapshot jsonb not null,
  reason text not null check(length(trim(reason)) >= 3),
  document_file_id uuid references public.file_assets(id) on delete restrict,
  changed_by uuid not null references public.app_accounts(id),
  changed_at timestamptz not null default now()
);

create index if not exists employee_insurance_events_employee_idx
  on public.employee_insurance_events(employee_id,effective_date desc,changed_at desc);

alter table public.employee_insurance_profiles enable row level security;
alter table public.employee_insurance_events enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('insurance-private','insurance-private',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.permissions(key,module,description) values
  ('insurance.view','human_resources','Xem hồ sơ bảo hiểm xã hội'),
  ('insurance.edit','human_resources','Cập nhật hồ sơ bảo hiểm xã hội'),
  ('insurance.history.view','human_resources','Xem lịch sử biến động bảo hiểm'),
  ('insurance.document.view','human_resources','Xem tài liệu bảo hiểm private'),
  ('insurance.document.upload','human_resources','Tải tài liệu bảo hiểm private'),
  ('payroll.export','accounting','Xuất bảng lương ra Excel')
on conflict(key) do update set module=excluded.module,description=excluded.description;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in (
  'insurance.view','insurance.edit','insurance.history.view','insurance.document.view','insurance.document.upload','payroll.export'
) where r.code='admin'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key in (
  'insurance.view','insurance.edit','insurance.history.view','insurance.document.view','insurance.document.upload'
) where r.code='hr'
on conflict do nothing;

insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r join public.permissions p on p.key='payroll.export'
where r.code='accountant'
on conflict do nothing;
