-- Word templates and generated documents for employee contracts.

create table if not exists public.employee_contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  file_asset_id uuid not null references public.file_assets(id) on delete restrict,
  active boolean not null default true,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employee_contract_templates_name_unique_idx
  on public.employee_contract_templates(lower(name));

drop trigger if exists employee_contract_templates_touch_updated_at on public.employee_contract_templates;
create trigger employee_contract_templates_touch_updated_at
before update on public.employee_contract_templates
for each row execute function public.touch_updated_at();

alter table public.employee_contract_templates enable row level security;

alter table public.employee_contracts
  add column if not exists template_id uuid references public.employee_contract_templates(id) on delete set null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'employee-private','employee-private',false,15728640,
  array[
    'image/jpeg','image/png','image/webp','application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

