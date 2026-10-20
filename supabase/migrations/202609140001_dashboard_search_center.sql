alter table public.system_settings drop constraint if exists system_settings_group_key_check;
alter table public.system_settings add constraint system_settings_group_key_check
  check (group_key in ('branding','appearance','organization','localization','navigation','dashboard','modules'));

alter table public.settings_versions drop constraint if exists settings_versions_group_key_check;
alter table public.settings_versions add constraint settings_versions_group_key_check
  check (group_key in ('branding','appearance','organization','localization','navigation','dashboard','modules'));

insert into public.system_settings (group_key, value)
values ('dashboard', '{
  "presetOrder":["management","import_export","warehouse","hr","supervisor","employee"],
  "presets":[
    {"profile":"management","landingPage":"/dashboard/management","enabledWidgets":["my_approvals","project_attention","hr_summary","timesheet_exceptions","warehouse_low_stock","shipment_attention","recent_activity","quick_actions"]},
    {"profile":"import_export","landingPage":"/dashboard/import-export","enabledWidgets":["shipment_attention","my_approvals","recent_notifications","recent_activity","quick_actions"]},
    {"profile":"warehouse","landingPage":"/dashboard/warehouse","enabledWidgets":["warehouse_low_stock","my_approvals","recent_notifications","recent_activity","quick_actions"]},
    {"profile":"hr","landingPage":"/dashboard/hr","enabledWidgets":["my_approvals","timesheet_exceptions","hr_summary","recent_notifications","recent_activity","quick_actions"]},
    {"profile":"supervisor","landingPage":"/home","enabledWidgets":["supervisor_today","project_attention","my_approvals","recent_notifications","quick_actions"]},
    {"profile":"employee","landingPage":"/home","enabledWidgets":["employee_today","my_approvals","recent_notifications","quick_actions"]}
  ]
}'::jsonb)
on conflict (group_key) do nothing;

create table if not exists public.recent_entity_access (
  user_id uuid not null references public.app_accounts(id) on delete cascade,
  entity_type text not null check (entity_type in ('employee','project','worksite','warehouse_item','warehouse_document','shipment','import_contract','leave_request','timesheet_period','document')),
  entity_id text not null,
  title text not null check (length(title) between 1 and 240),
  subtitle text check (subtitle is null or length(subtitle) <= 300),
  deep_link text not null check (deep_link ~ '^/[^/]'),
  last_accessed_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create index if not exists recent_entity_access_user_idx on public.recent_entity_access (user_id, last_accessed_at desc);
alter table public.recent_entity_access enable row level security;

create index if not exists employees_search_name_idx on public.employees (lower(full_name) text_pattern_ops);
create index if not exists employees_search_company_email_idx on public.employees (lower(company_email) text_pattern_ops) where company_email is not null;
create index if not exists projects_search_name_idx on public.projects (lower(name) text_pattern_ops);
create index if not exists worksites_search_name_idx on public.worksites (lower(name) text_pattern_ops);
create index if not exists inventory_documents_search_number_idx on public.inventory_documents (lower(document_number) text_pattern_ops);
create index if not exists shipments_search_number_idx on public.shipments (lower(shipment_number) text_pattern_ops);
create index if not exists shipments_search_bl_idx on public.shipments (lower(bill_of_lading_number) text_pattern_ops) where bill_of_lading_number is not null;
create index if not exists shipment_containers_search_number_idx on public.shipment_containers (lower(container_number) text_pattern_ops);
create index if not exists import_contracts_search_number_idx on public.import_contracts (lower(contract_number) text_pattern_ops);
create index if not exists documents_search_title_idx on public.documents (lower(title) text_pattern_ops);
