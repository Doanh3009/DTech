-- Additive command for customer setup. Existing single-group publishers remain
-- compatible; consumers must explicitly select this command after deployment.
create table if not exists public.system_settings_commands (
  request_id uuid primary key,
  actor_account_id uuid not null references public.app_accounts(id),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.system_settings_commands enable row level security;
-- Supabase may grant service_role ALL through default table privileges. Receipt
-- writes must go through the command owner so callers cannot forge retries.
revoke all on public.system_settings_commands from public, anon, authenticated, service_role;
grant select on public.system_settings_commands to service_role;

-- Application schemas remain authoritative for labels and normalization. This
-- independent database boundary rejects unknown fields and malformed snapshots,
-- even when the service credential is used without the application validator.
create or replace function public.is_valid_system_settings_command_group(p_group text, p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_required text[];
  v_allowed text[];
  v_strings text[];
  v_booleans text[] := '{}';
  v_key text;
  v_item jsonb;
  v_paths constant text[] := array[
    '/employees','/employees/departments','/employees/positions','/employees/contracts','/employees/insurance',
    '/attendance/today','/attendance/logs','/timesheets/matrix','/timesheets','/timesheets/adjustments',
    '/shifts','/shifts/calendar','/leave/manage','/attendance','/attendance/me','/attendance/history',
    '/attendance/requests','/attendance/notifications','/leave','/projects','/projects/updates','/worker-attendance',
    '/warehouse/items','/warehouse/receipts','/warehouse/issues','/warehouse/transfers','/warehouse/inventory',
    '/import-export','/import-export/shipments','/import-export/transport','/import-export/contracts',
    '/import-export/documents','/import-export/customs','/import-export/partners','/approvals','/documents','/reports'
  ];
  v_profiles constant text[] := array['management','supervisor','import_export','warehouse','accounting','hr','employee'];
  v_widgets constant text[] := array[
    'attendance_overview','employee_today','supervisor_today','my_approvals','timesheet_exceptions',
    'project_attention','warehouse_low_stock','shipment_attention','accounting_summary','hr_summary',
    'recent_activity','recent_notifications','quick_actions'
  ];
  v_landing_pages constant text[] := array[
    '/applications','/attendance','/attendance/me','/attendance/history','/attendance/requests','/employees',
    '/project-monitoring','/warehouse/inventory','/import-export/shipments','/accounting/salaries',
    '/accounting/payroll','/accounting/payslips','/approvals','/documents','/reports','/messages','/search',
    '/settings','/system-admin','/profile','/worker-attendance/today','/projects'
  ];
begin
  if p_group is null or jsonb_typeof(p_value) is distinct from 'object' or octet_length(p_value::text) > 131072 then
    return false;
  end if;

  case p_group
    when 'branding' then
      v_required := array['systemName','loginSubtitle','logoMainUrl','logoCompactUrl','logoDarkUrl','faviconUrl','assetVersion'];
      v_strings := array['systemName','loginSubtitle'];
    when 'appearance' then
      v_required := array['primaryColor','density','tableDensity','defaultPageSize','sidebarDefault','appearanceMode'];
      v_strings := array['primaryColor','density','tableDensity','sidebarDefault','appearanceMode'];
    when 'organization' then
      v_required := array['companyName','shortName','address','phone','email','taxCode','representativeName'];
      v_strings := v_required;
    when 'localization' then
      v_required := array['timezone','dateFormat','timeFormat','weekStartsOn','locale'];
      v_strings := v_required;
    when 'navigation' then
      v_required := array['hiddenItems','itemOrder','defaultLandingPage','groupsExpanded'];
      v_strings := array['defaultLandingPage'];
      v_booleans := array['groupsExpanded'];
    when 'dashboard' then
      v_required := array['presetOrder','presets'];
      v_strings := '{}';
    when 'modules' then
      v_required := array['human_resources','attendance','projects','warehouse','import_export','reports'];
      v_allowed := v_required || array['accounting','operations','messaging','industryPreset'];
      v_strings := '{}';
      v_booleans := v_required || array['accounting','operations','messaging'];
    when 'payslip' then
      v_required := array['companyName','title','footer','primaryColor','showWorkDays','showBaseSalary','showAllowance','showBonus','showDeduction'];
      v_strings := array['companyName','title','footer','primaryColor'];
      v_booleans := array['showWorkDays','showBaseSalary','showAllowance','showBonus','showDeduction'];
    else return false;
  end case;

  v_allowed := coalesce(v_allowed, v_required);
  if not (p_value ?& v_required) or exists (
    select 1 from jsonb_object_keys(p_value) as fields(key) where not (key = any(v_allowed))
  ) then return false; end if;

  foreach v_key in array v_strings loop
    if jsonb_typeof(p_value -> v_key) is distinct from 'string' then return false; end if;
  end loop;
  foreach v_key in array v_booleans loop
    if p_value ? v_key and jsonb_typeof(p_value -> v_key) is distinct from 'boolean' then return false; end if;
  end loop;

  case p_group
    when 'branding' then
      if length(btrim(p_value ->> 'systemName')) not between 2 and 100
        or length(btrim(p_value ->> 'loginSubtitle')) > 140
        or jsonb_typeof(p_value -> 'assetVersion') is distinct from 'number'
      then return false; end if;
      if (p_value ->> 'assetVersion')::numeric < 0
        or (p_value ->> 'assetVersion')::numeric > 9007199254740991
        or trunc((p_value ->> 'assetVersion')::numeric) <> (p_value ->> 'assetVersion')::numeric
      then return false; end if;
      foreach v_key in array array['logoMainUrl','logoCompactUrl','logoDarkUrl','faviconUrl'] loop
        if p_value -> v_key = 'null'::jsonb then continue; end if;
        if jsonb_typeof(p_value -> v_key) is distinct from 'string'
          or length(p_value ->> v_key) > 2000
          or not ((p_value ->> v_key) ~* '^/[A-Za-z0-9/_-]+\.(png|jpe?g|webp|ico)$'
            or (p_value ->> v_key) ~ '^[A-Za-z][A-Za-z0-9+.-]*:[^[:space:]]+$')
        then return false; end if;
      end loop;
    when 'appearance' then
      if not ((p_value ->> 'primaryColor') ~ '^#[0-9A-Fa-f]{6}$')
        or not ((p_value ->> 'density') = any(array['comfortable','standard','compact']))
        or not ((p_value ->> 'tableDensity') = any(array['standard','compact']))
        or not ((p_value ->> 'sidebarDefault') = any(array['expanded','collapsed']))
        or p_value ->> 'appearanceMode' <> 'light'
        or jsonb_typeof(p_value -> 'defaultPageSize') is distinct from 'number'
        or not (p_value -> 'defaultPageSize' = any(array['10'::jsonb,'20'::jsonb,'50'::jsonb,'100'::jsonb]))
      then return false; end if;
    when 'organization' then
      if length(btrim(p_value ->> 'companyName')) not between 2 and 120
        or length(btrim(p_value ->> 'shortName')) not between 2 and 30
        or length(btrim(p_value ->> 'address')) > 240
        or length(btrim(p_value ->> 'phone')) > 30
        or length(btrim(p_value ->> 'taxCode')) > 30
        or length(btrim(p_value ->> 'representativeName')) > 100
        or (p_value ->> 'email' <> '' and not ((p_value ->> 'email') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
      then return false; end if;
    when 'localization' then
      if p_value ->> 'timezone' <> 'Asia/Ho_Chi_Minh'
        or not ((p_value ->> 'dateFormat') = any(array['DD/MM/YYYY','YYYY-MM-DD']))
        or p_value ->> 'timeFormat' <> 'HH:mm'
        or p_value ->> 'weekStartsOn' <> 'monday'
        or p_value ->> 'locale' <> 'vi-VN'
      then return false; end if;
    when 'navigation' then
      if jsonb_typeof(p_value -> 'hiddenItems') is distinct from 'array'
        or jsonb_typeof(p_value -> 'itemOrder') is distinct from 'array'
        or not ((p_value ->> 'defaultLandingPage') = any(array['/applications','/attendance','/projects']))
      then return false; end if;
      if jsonb_array_length(p_value -> 'hiddenItems') > cardinality(v_paths)
        or jsonb_array_length(p_value -> 'itemOrder') <> cardinality(v_paths)
        or (select count(distinct item) from jsonb_array_elements(p_value -> 'itemOrder') item) <> cardinality(v_paths)
      then return false; end if;
      for v_item in select value from jsonb_array_elements((p_value -> 'hiddenItems') || (p_value -> 'itemOrder')) loop
        if jsonb_typeof(v_item) is distinct from 'string' or not ((v_item #>> '{}') = any(v_paths)) then return false; end if;
      end loop;
    when 'dashboard' then
      if jsonb_typeof(p_value -> 'presetOrder') is distinct from 'array'
        or jsonb_typeof(p_value -> 'presets') is distinct from 'array'
      then return false; end if;
      if jsonb_array_length(p_value -> 'presetOrder') <> cardinality(v_profiles)
        or jsonb_array_length(p_value -> 'presets') <> cardinality(v_profiles)
        or (select count(distinct item) from jsonb_array_elements(p_value -> 'presetOrder') item) <> cardinality(v_profiles)
        or (select count(distinct item ->> 'profile') from jsonb_array_elements(p_value -> 'presets') item) <> cardinality(v_profiles)
      then return false; end if;
      for v_item in select value from jsonb_array_elements(p_value -> 'presetOrder') loop
        if jsonb_typeof(v_item) is distinct from 'string' or not ((v_item #>> '{}') = any(v_profiles)) then return false; end if;
      end loop;
      for v_item in select value from jsonb_array_elements(p_value -> 'presets') loop
        if jsonb_typeof(v_item) is distinct from 'object' then return false; end if;
        if not (v_item ?& array['profile','landingPage','enabledWidgets'])
          or exists(select 1 from jsonb_object_keys(v_item) fields(key) where not (key = any(array['profile','landingPage','enabledWidgets'])))
          or jsonb_typeof(v_item -> 'profile') is distinct from 'string'
          or not ((v_item ->> 'profile') = any(v_profiles))
          or jsonb_typeof(v_item -> 'landingPage') is distinct from 'string'
          or not ((v_item ->> 'landingPage') = any(v_landing_pages))
          or jsonb_typeof(v_item -> 'enabledWidgets') is distinct from 'array'
        then return false; end if;
        if jsonb_array_length(v_item -> 'enabledWidgets') > cardinality(v_widgets)
          or (select count(distinct widget) from jsonb_array_elements(v_item -> 'enabledWidgets') widget) <> jsonb_array_length(v_item -> 'enabledWidgets')
          or exists(select 1 from jsonb_array_elements(v_item -> 'enabledWidgets') widget where jsonb_typeof(widget) is distinct from 'string' or not ((widget #>> '{}') = any(v_widgets)))
        then return false; end if;
      end loop;
    when 'modules' then
      if p_value ? 'industryPreset' and (jsonb_typeof(p_value -> 'industryPreset') is distinct from 'string'
        or not ((p_value ->> 'industryPreset') = any(array['general','garment','construction','trading','services'])))
      then return false; end if;
    when 'payslip' then
      if length(btrim(p_value ->> 'companyName')) not between 2 and 120
        or length(btrim(p_value ->> 'title')) not between 2 and 120
        or length(btrim(p_value ->> 'footer')) > 180
        or not ((p_value ->> 'primaryColor') ~ '^#[0-9A-Fa-f]{6}$')
      then return false; end if;
  end case;
  return true;
end;
$$;

create or replace function public.publish_system_settings_command(
  p_actor_id uuid,
  p_request_id uuid,
  p_groups jsonb,
  p_expected_versions jsonb,
  p_change_type text default 'publish'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group text;
  v_permission text;
  v_permissions text[];
  v_current_version integer;
  v_expected_version integer;
  v_before jsonb;
  v_versions jsonb := '{}'::jsonb;
  v_receipt jsonb;
  v_hash text;
  v_existing public.system_settings_commands%rowtype;
begin
  if p_actor_id is null or p_request_id is null
    or p_change_type is null or p_change_type not in ('publish','restore')
    or jsonb_typeof(p_groups) is distinct from 'object'
    or jsonb_typeof(p_expected_versions) is distinct from 'object'
    or octet_length(p_groups::text) > 262144
    or octet_length(p_expected_versions::text) > 2048
  then raise exception using errcode = 'P0001', message = 'SETTINGS_INVALID_INPUT'; end if;

  if (select count(*) from jsonb_object_keys(p_groups)) not between 1 and 8
    or (select array_agg(key order by key) from jsonb_object_keys(p_groups) fields(key))
      is distinct from (select array_agg(key order by key) from jsonb_object_keys(p_expected_versions) fields(key))
  then raise exception using errcode = 'P0001', message = 'SETTINGS_INVALID_INPUT'; end if;

  for v_group in select key from jsonb_object_keys(p_groups) fields(key) order by key loop
    if not public.is_valid_system_settings_command_group(v_group, p_groups -> v_group)
      or jsonb_typeof(p_expected_versions -> v_group) is distinct from 'number'
    then raise exception using errcode = 'P0001', message = 'SETTINGS_INVALID_INPUT'; end if;
    if not ((p_expected_versions ->> v_group) ~ '^(0|[1-9][0-9]*)$')
      or length(p_expected_versions ->> v_group) > 10
    then raise exception using errcode = 'P0001', message = 'SETTINGS_INVALID_INPUT'; end if;
    if (p_expected_versions ->> v_group)::numeric > 2147483646
    then raise exception using errcode = 'P0001', message = 'SETTINGS_INVALID_INPUT'; end if;
  end loop;

  -- One command lock serializes all group combinations, including missing rows.
  -- It also serializes simultaneous retries before the receipt can exist.
  perform pg_advisory_xact_lock(hashtextextended('dtech:system-settings-command', 0));

  perform 1 from public.app_accounts where id = p_actor_id and status = 'active' for share;
  if not found then raise exception using errcode = 'P0001', message = 'SETTINGS_ACTOR_FORBIDDEN'; end if;

  select coalesce(array_agg(grants.permission_key), '{}'::text[]) into v_permissions
  from (
    select rp.permission_key
    from public.account_roles ar
    join public.role_permissions rp on rp.role_id = ar.role_id
    where ar.account_id = p_actor_id
    for share of ar, rp
  ) grants;
  if not ('system_admin.access' = any(v_permissions))
    or (p_change_type = 'restore' and not ('config_history.restore' = any(v_permissions)))
  then raise exception using errcode = 'P0001', message = 'SETTINGS_ACTOR_FORBIDDEN'; end if;

  for v_group in select key from jsonb_object_keys(p_groups) fields(key) order by key loop
    v_permission := case v_group
      when 'branding' then 'branding.manage'
      when 'appearance' then 'appearance.manage'
      when 'organization' then 'organization_settings.manage'
      when 'localization' then 'localization.manage'
      when 'navigation' then 'navigation.manage'
      when 'dashboard' then 'navigation.manage'
      when 'modules' then 'module.manage'
      when 'payslip' then 'module.manage'
    end;
    if not (v_permission = any(v_permissions))
    then raise exception using errcode = 'P0001', message = 'SETTINGS_ACTOR_FORBIDDEN'; end if;
  end loop;

  v_hash := encode(sha256(convert_to(jsonb_build_object(
    'groups', p_groups, 'expectedVersions', p_expected_versions, 'changeType', p_change_type
  )::text, 'UTF8')), 'hex');
  select * into v_existing from public.system_settings_commands where request_id = p_request_id;
  if found then
    if v_existing.actor_account_id <> p_actor_id or v_existing.payload_hash <> v_hash
    then raise exception using errcode = 'P0001', message = 'SETTINGS_REQUEST_CONFLICT'; end if;
    return v_existing.receipt;
  end if;

  -- Validate every expected version before the first update. Existing rows are
  -- locked as well, to coordinate with compatible legacy row updates.
  for v_group in select key from jsonb_object_keys(p_groups) fields(key) order by key loop
    select version into v_current_version from public.system_settings where group_key = v_group for update;
    v_current_version := coalesce(v_current_version, 0);
    v_expected_version := (p_expected_versions ->> v_group)::integer;
    if v_current_version <> v_expected_version
    then raise exception using errcode = 'P0001', message = 'SETTINGS_VERSION_CONFLICT'; end if;
  end loop;

  for v_group in select key from jsonb_object_keys(p_groups) fields(key) order by key loop
    v_current_version := (p_expected_versions ->> v_group)::integer + 1;
    select value into v_before from public.system_settings where group_key = v_group;
    insert into public.system_settings(group_key, value, version, updated_by)
    values(v_group, p_groups -> v_group, v_current_version, p_actor_id)
    on conflict(group_key) do update
      set value = excluded.value, version = excluded.version, updated_by = excluded.updated_by
      where public.system_settings.version = (p_expected_versions ->> v_group)::integer;
    if not found then raise exception using errcode = 'P0001', message = 'SETTINGS_VERSION_CONFLICT'; end if;

    insert into public.settings_versions(group_key, version, snapshot, change_type, created_by)
    values(v_group, v_current_version, p_groups -> v_group, p_change_type, p_actor_id);

    insert into public.audit_logs(actor_account_id, action, entity_type, entity_id, before_data, after_data, metadata)
    values(p_actor_id, 'system_settings.' || p_change_type, 'system_settings', v_group, v_before, p_groups -> v_group,
      jsonb_build_object('requestId', p_request_id, 'version', v_current_version));
    v_versions := v_versions || jsonb_build_object(v_group, v_current_version);
  end loop;

  v_receipt := jsonb_build_object('requestId', p_request_id, 'versions', v_versions);
  insert into public.system_settings_commands(request_id, actor_account_id, payload_hash, receipt)
  values(p_request_id, p_actor_id, v_hash, v_receipt);
  return v_receipt;
end;
$$;

revoke all on function public.is_valid_system_settings_command_group(text,jsonb) from public, anon, authenticated;
revoke all on function public.publish_system_settings_command(uuid,uuid,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.is_valid_system_settings_command_group(text,jsonb) to service_role;
grant execute on function public.publish_system_settings_command(uuid,uuid,jsonb,jsonb,text) to service_role;
