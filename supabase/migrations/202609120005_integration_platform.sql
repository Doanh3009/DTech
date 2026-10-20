create extension if not exists pgcrypto;

create table if not exists public.integration_configs (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, connector_type text not null,
  status text not null default 'not_configured' check(status in ('not_configured','connected','degraded','error','disabled')),
  sync_direction text not null default 'push' check(sync_direction in ('push','pull','bidirectional')),
  source_of_truth text not null default 'internal' check(source_of_truth in ('internal','external','field_owned')),
  conflict_policy text not null default 'manual_review' check(conflict_policy in ('internal_wins','external_wins','manual_review','latest_timestamp')),
  capabilities text[] not null default '{}', settings jsonb not null default '{}'::jsonb,
  last_success_at timestamptz, last_failure_at timestamptz, consecutive_failures integer not null default 0,
  last_error_code text, enabled boolean not null default false, created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(), owner_type text not null, owner_id uuid not null, purpose text not null,
  ciphertext text not null, iv text not null, auth_tag text not null, key_version integer not null default 1,
  rotated_from_id uuid references public.integration_secrets(id), active boolean not null default true,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), expires_at timestamptz
);
create unique index if not exists integration_secrets_one_active_idx on public.integration_secrets(owner_type,owner_id,purpose) where active;

create table if not exists public.service_accounts (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  status text not null default 'active' check(status in ('active','disabled','revoked')),
  scopes text[] not null default '{}', created_by uuid not null references public.app_accounts(id),
  last_used_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(), service_account_id uuid not null references public.service_accounts(id) on delete restrict,
  name text not null, description text, key_prefix text not null unique, key_hash text not null,
  environment text not null default 'live' check(environment in ('live','test')), scopes text[] not null default '{}',
  allowed_ips text[] not null default '{}', rate_limit_per_minute integer not null default 100 check(rate_limit_per_minute between 1 and 10000),
  status text not null default 'active' check(status in ('active','revoked','expired')), expires_at timestamptz,
  last_used_at timestamptz, revoked_at timestamptz, revoked_by uuid references public.app_accounts(id),
  rotated_from_id uuid references public.api_keys(id), created_by uuid not null references public.app_accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists api_keys_service_status_idx on public.api_keys(service_account_id,status,expires_at);

create table if not exists public.api_rate_limit_windows (
  api_key_id uuid not null references public.api_keys(id) on delete cascade, bucket text not null,
  window_started_at timestamptz not null, request_count integer not null default 0,
  primary key(api_key_id,bucket,window_started_at)
);
create table if not exists public.external_api_requests (
  id uuid primary key default gen_random_uuid(), request_id text not null, correlation_id uuid not null,
  api_key_id uuid references public.api_keys(id), service_account_id uuid references public.service_accounts(id),
  method text not null, path text not null, endpoint_category text not null, source_ip inet,
  response_status integer, duration_ms integer, error_code text, created_at timestamptz not null default now()
);
create index if not exists external_api_requests_key_time_idx on public.external_api_requests(api_key_id,created_at desc);
create index if not exists external_api_requests_request_id_idx on public.external_api_requests(request_id,created_at desc);
create table if not exists public.api_idempotency_records (
  api_key_id uuid not null references public.api_keys(id) on delete cascade, route_key text not null, idempotency_key text not null,
  request_hash text not null, response_status integer, response_body jsonb, state text not null default 'processing' check(state in ('processing','completed','failed')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '24 hours',
  primary key(api_key_id,route_key,idempotency_key)
);

alter table public.webhook_endpoints add column if not exists status text not null default 'active' check(status in ('active','disabled','error'));
alter table public.webhook_endpoints add column if not exists timeout_seconds integer not null default 10 check(timeout_seconds between 1 and 30);
alter table public.webhook_endpoints add column if not exists max_attempts integer not null default 5 check(max_attempts between 1 and 10);
alter table public.webhook_endpoints add column if not exists last_delivery_at timestamptz;
alter table public.webhook_endpoints add column if not exists last_success_at timestamptz;
alter table public.webhook_endpoints add column if not exists last_failure_at timestamptz;
alter table public.webhook_endpoints add column if not exists consecutive_failures integer not null default 0;
alter table public.webhook_endpoints add column if not exists rotated_at timestamptz;

alter table public.webhook_deliveries drop constraint if exists webhook_deliveries_status_check;
alter table public.webhook_deliveries add constraint webhook_deliveries_status_check check(status in ('pending','delivering','retry_scheduled','delivered','failed','dead_letter'));
alter table public.webhook_deliveries add column if not exists response_status integer;
alter table public.webhook_deliveries add column if not exists response_body_excerpt text;
alter table public.webhook_deliveries add column if not exists duration_ms integer;
alter table public.webhook_deliveries add column if not exists error_category text check(error_category is null or error_category in ('transient','auth','validation','rate_limit','permanent','network'));
alter table public.webhook_deliveries add column if not exists request_time timestamptz;
alter table public.webhook_deliveries add column if not exists updated_at timestamptz not null default now();
create unique index if not exists webhook_deliveries_endpoint_event_idx on public.webhook_deliveries(endpoint_id,event_id);
create table if not exists public.webhook_delivery_attempts (
  id uuid primary key default gen_random_uuid(), delivery_id uuid not null references public.webhook_deliveries(id) on delete cascade,
  attempt integer not null, request_time timestamptz not null, response_status integer, response_time timestamptz,
  duration_ms integer, error_category text, response_body_excerpt text, created_at timestamptz not null default now(),
  unique(delivery_id,attempt)
);

create table if not exists public.inbound_webhooks (
  id uuid primary key default gen_random_uuid(), integration_id uuid references public.integration_configs(id) on delete restrict,
  endpoint_key text not null unique, name text not null, handler_type text not null,
  auth_type text not null default 'hmac' check(auth_type in ('hmac','bearer','provider_signature')),
  status text not null default 'active' check(status in ('active','disabled')), timestamp_tolerance_seconds integer not null default 300,
  created_by uuid not null references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.inbound_webhook_receipts (
  id uuid primary key default gen_random_uuid(), inbound_webhook_id uuid not null references public.inbound_webhooks(id) on delete restrict,
  provider_event_id text not null, body_hash text not null, request_id text not null, status text not null check(status in ('received','processed','rejected','duplicate')),
  error_code text, received_at timestamptz not null default now(), processed_at timestamptz,
  unique(inbound_webhook_id,provider_event_id)
);

create table if not exists public.event_schema_registry (
  event_key text not null, version integer not null default 1, schema_definition jsonb not null,
  sensitive_fields text[] not null default '{}', active boolean not null default true, created_at timestamptz not null default now(),
  primary key(event_key,version)
);

create table if not exists public.integration_sync_jobs (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integration_configs(id) on delete restrict,
  sync_type text not null, direction text not null check(direction in ('push','pull','bidirectional')),
  status text not null default 'queued' check(status in ('queued','running','completed','partial','failed','cancelled')),
  started_at timestamptz, completed_at timestamptz, records_read integer not null default 0, records_written integer not null default 0,
  records_failed integer not null default 0, cursor jsonb, error_summary text, idempotency_key text not null,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), unique(integration_id,idempotency_key)
);
create unique index if not exists integration_sync_jobs_one_running_idx on public.integration_sync_jobs(integration_id,sync_type) where status='running';
create table if not exists public.integration_logs (
  id uuid primary key default gen_random_uuid(), integration_id uuid references public.integration_configs(id),
  job_id uuid references public.integration_sync_jobs(id), level text not null check(level in ('info','warning','error')),
  event_code text not null, message text not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists integration_logs_lookup_idx on public.integration_logs(integration_id,created_at desc);
create table if not exists public.external_id_mappings (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integration_configs(id) on delete restrict,
  entity_type text not null, internal_id text not null, external_id text not null, mapping_status text not null default 'active' check(mapping_status in ('active','inactive','conflict')),
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(integration_id,entity_type,internal_id), unique(integration_id,entity_type,external_id)
);
create table if not exists public.integration_field_mappings (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integration_configs(id) on delete cascade,
  entity_type text not null, source_field text not null, target_field text not null,
  transform_preset text not null default 'direct' check(transform_preset in ('direct','trim','uppercase','date_format','enum_mapping')),
  transform_config jsonb not null default '{}'::jsonb, source_of_truth text not null default 'internal' check(source_of_truth in ('internal','external')),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(integration_id,entity_type,source_field,target_field)
);
create table if not exists public.integration_conflicts (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references public.integration_configs(id) on delete restrict,
  entity_type text not null, entity_id text not null, field_name text not null, internal_value jsonb, external_value jsonb,
  status text not null default 'open' check(status in ('open','resolved_internal','resolved_external','ignored')),
  detected_at timestamptz not null default now(), resolved_at timestamptz, resolved_by uuid references public.app_accounts(id), resolution_note text
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(), import_type text not null, file_id uuid references public.file_assets(id),
  file_name text not null, policy text not null check(policy in ('create_only','update_by_key','upsert')),
  status text not null default 'uploaded' check(status in ('uploaded','validating','validated','confirmed','processing','completed','partial','failed')),
  rows_total integer not null default 0, rows_valid integer not null default 0, rows_invalid integer not null default 0, rows_imported integer not null default 0,
  column_mapping jsonb not null default '{}'::jsonb, preview jsonb not null default '[]'::jsonb,
  requested_by uuid not null references public.app_accounts(id), started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.import_job_errors (
  id uuid primary key default gen_random_uuid(), import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number integer not null, field text not null, error_code text not null, message text not null, created_at timestamptz not null default now()
);

create table if not exists public.attendance_devices (
  id uuid primary key default gen_random_uuid(), device_code text not null unique, name text not null, location_id uuid references public.attendance_locations(id),
  provider text not null, model text, timezone text not null default 'Asia/Ho_Chi_Minh', status text not null default 'active' check(status in ('active','disabled','error')),
  last_heartbeat_at timestamptz, created_by uuid not null references public.app_accounts(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.attendance_device_mappings (
  device_id uuid not null references public.attendance_devices(id) on delete cascade, external_user_code text not null,
  employee_id uuid not null references public.employees(id) on delete restrict, active boolean not null default true,
  created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(), primary key(device_id,external_user_code)
);
create table if not exists public.attendance_device_raw_events (
  id uuid primary key default gen_random_uuid(), device_id uuid not null references public.attendance_devices(id) on delete restrict,
  external_event_id text not null, external_user_code text not null, employee_id uuid references public.employees(id),
  event_type text not null check(event_type in ('check_in','check_out')), occurred_at timestamptz not null, raw_occurred_at text not null,
  source text not null default 'ATTENDANCE_DEVICE' check(source='ATTENDANCE_DEVICE'),
  status text not null default 'received' check(status in ('received','unmatched','ready','processed','ignored','failed')),
  payload jsonb not null default '{}'::jsonb, received_at timestamptz not null default now(), processed_at timestamptz,
  unique(device_id,external_event_id)
);
create table if not exists public.unmatched_external_events (
  id uuid primary key default gen_random_uuid(), raw_event_id uuid not null unique references public.attendance_device_raw_events(id) on delete cascade,
  reason text not null, status text not null default 'open' check(status in ('open','mapped','ignored')),
  resolved_by uuid references public.app_accounts(id), resolved_at timestamptz, created_at timestamptz not null default now()
);

create or replace function public.consume_external_rate_limit(p_api_key_id uuid,p_bucket text,p_limit integer)
returns table(allowed boolean,remaining integer,reset_at timestamptz) language plpgsql security definer set search_path=public as $$
declare v_window timestamptz:=date_trunc('minute',now()); v_count integer;
begin
  insert into api_rate_limit_windows(api_key_id,bucket,window_started_at,request_count) values(p_api_key_id,p_bucket,v_window,1)
  on conflict(api_key_id,bucket,window_started_at) do update set request_count=api_rate_limit_windows.request_count+1
  returning request_count into v_count;
  return query select v_count<=p_limit,greatest(p_limit-v_count,0),v_window+interval '1 minute';
end $$;
revoke all on function public.consume_external_rate_limit(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.consume_external_rate_limit(uuid,text,integer) to service_role;

create or replace function public.enqueue_domain_event_webhooks() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into webhook_deliveries(endpoint_id,event_type,event_id,payload,status,next_attempt_at)
  select w.id,new.event_key,new.id,jsonb_build_object('id',new.id,'event',new.event_key,'version','1','occurred_at',new.occurred_at,'data',new.payload),'pending',now()
  from webhook_endpoints w where w.enabled=true and w.status='active' and w.event_types @> array[new.event_key]
  on conflict(endpoint_id,event_id) do nothing;
  return new;
end $$;
drop trigger if exists domain_events_enqueue_webhooks on public.domain_events;
create trigger domain_events_enqueue_webhooks after insert on public.domain_events for each row execute function public.enqueue_domain_event_webhooks();

drop trigger if exists integration_configs_touch on public.integration_configs;
create trigger integration_configs_touch before update on public.integration_configs for each row execute function public.touch_shared_platform_updated_at();
drop trigger if exists service_accounts_touch on public.service_accounts;
create trigger service_accounts_touch before update on public.service_accounts for each row execute function public.touch_shared_platform_updated_at();
drop trigger if exists api_keys_touch on public.api_keys;
create trigger api_keys_touch before update on public.api_keys for each row execute function public.touch_shared_platform_updated_at();
drop trigger if exists external_id_mappings_touch on public.external_id_mappings;
create trigger external_id_mappings_touch before update on public.external_id_mappings for each row execute function public.touch_shared_platform_updated_at();
drop trigger if exists integration_field_mappings_touch on public.integration_field_mappings;
create trigger integration_field_mappings_touch before update on public.integration_field_mappings for each row execute function public.touch_shared_platform_updated_at();
drop trigger if exists attendance_devices_touch on public.attendance_devices;
create trigger attendance_devices_touch before update on public.attendance_devices for each row execute function public.touch_shared_platform_updated_at();

insert into public.integration_configs(code,name,connector_type,status,sync_direction,source_of_truth,capabilities,enabled) values
 ('MISA','MISA','misa','not_configured','push','field_owned',array['employee_export','timesheet_export','warehouse_document_export'],false),
 ('POWER_BI','Power BI','power_bi','not_configured','pull','internal',array['reporting_read'],false),
 ('ZALO','Zalo','zalo','not_configured','push','internal',array['notification_delivery'],false),
 ('EMAIL','Email','email','not_configured','push','internal',array['notification_delivery'],false),
 ('ATTENDANCE_DEVICE','Máy chấm công','attendance_device','not_configured','pull','internal',array['raw_attendance_ingestion'],false)
on conflict(code) do update set name=excluded.name,connector_type=excluded.connector_type,capabilities=excluded.capabilities;

insert into public.event_schema_registry(event_key,version,schema_definition,sensitive_fields) values
 ('test.event',1,'{"type":"object","required":["message"]}'::jsonb,'{}'),
 ('employee.created',1,'{"type":"object","required":["employee_id","employee_code"]}'::jsonb,array['personal_phone']),
 ('employee.updated',1,'{"type":"object","required":["employee_id"]}'::jsonb,array['personal_phone']),
 ('attendance.checked_in',1,'{"type":"object","required":["employee_id","occurred_at"]}'::jsonb,'{}'),
 ('attendance.checked_out',1,'{"type":"object","required":["employee_id","occurred_at"]}'::jsonb,'{}'),
 ('leave.approved',1,'{"type":"object","required":[]}'::jsonb,'{}'),
 ('project.issue.created',1,'{"type":"object","required":[]}'::jsonb,'{}'),
 ('warehouse.receipt.posted',1,'{"type":"object","required":[]}'::jsonb,'{}'),
 ('warehouse.issue.posted',1,'{"type":"object","required":[]}'::jsonb,'{}'),
 ('shipment.eta.changed',1,'{"type":"object","required":[]}'::jsonb,'{}'),
 ('shipment.received',1,'{"type":"object","required":[]}'::jsonb,'{}')
on conflict(event_key,version) do update set schema_definition=excluded.schema_definition,sensitive_fields=excluded.sensitive_fields;

insert into public.permissions(key,module,description) values
 ('integration.manage','integrations','Quản lý tích hợp'),('api_key.view','integrations','Xem API key'),('api_key.create','integrations','Tạo API key'),('api_key.revoke','integrations','Thu hồi API key'),
 ('service_account.manage','integrations','Quản lý service account'),('webhook.view','integrations','Xem webhook'),('webhook.manage','integrations','Quản lý webhook'),('webhook.retry','integrations','Gửi lại webhook'),
 ('integration_log.view','integrations','Xem log tích hợp'),('integration_conflict.view','integrations','Xem xung đột tích hợp'),('integration_conflict.resolve','integrations','Xử lý xung đột tích hợp'),
 ('import.create','integrations','Tạo import'),('import.execute','integrations','Thực thi import'),('api_docs.view','integrations','Xem tài liệu API')
on conflict(key) do update set module=excluded.module,description=excluded.description;
insert into public.role_permissions(role_id,permission_key)
select r.id,p.key from public.roles r cross join public.permissions p where r.code='admin' and p.module='integrations' on conflict do nothing;

insert into public.business_configuration_catalog(key,group_key,label,route,permission_key,sort_order) values
 ('integration_dashboard','integrations','Tổng quan tích hợp','/settings/integrations','integration.view',10),
 ('integration_api_keys','integrations','API key','/settings/integrations/api-keys','api_key.view',20),
 ('integration_service_accounts','integrations','Service account','/settings/integrations/service-accounts','service_account.manage',30),
 ('integration_webhooks','integrations','Webhook','/settings/integrations/webhooks','webhook.view',40),
 ('integration_deliveries','integrations','Webhook deliveries','/settings/integrations/webhook-deliveries','webhook.view',50),
 ('integration_conflicts','integrations','Xung đột đồng bộ','/settings/integrations/conflicts','integration_conflict.view',60),
 ('integration_imports','integrations','Import dữ liệu','/settings/integrations/imports','import.create',70),
 ('integration_devices','integrations','Máy chấm công','/settings/integrations/attendance-devices','integration.manage',80),
 ('integration_api_docs','integrations','Tài liệu API','/settings/integrations/api-docs','api_docs.view',90)
on conflict(key) do update set label=excluded.label,route=excluded.route,permission_key=excluded.permission_key,sort_order=excluded.sort_order;

alter table public.integration_configs enable row level security; alter table public.integration_secrets enable row level security;
alter table public.service_accounts enable row level security; alter table public.api_keys enable row level security;
alter table public.api_rate_limit_windows enable row level security; alter table public.external_api_requests enable row level security; alter table public.api_idempotency_records enable row level security;
alter table public.webhook_delivery_attempts enable row level security; alter table public.inbound_webhooks enable row level security; alter table public.inbound_webhook_receipts enable row level security;
alter table public.event_schema_registry enable row level security; alter table public.integration_sync_jobs enable row level security; alter table public.integration_logs enable row level security;
alter table public.external_id_mappings enable row level security; alter table public.integration_field_mappings enable row level security; alter table public.integration_conflicts enable row level security;
alter table public.import_jobs enable row level security; alter table public.import_job_errors enable row level security;
alter table public.attendance_devices enable row level security; alter table public.attendance_device_mappings enable row level security; alter table public.attendance_device_raw_events enable row level security; alter table public.unmatched_external_events enable row level security;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('integration-imports','integration-imports',false,10485760,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
