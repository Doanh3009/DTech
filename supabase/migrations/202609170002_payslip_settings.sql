alter table public.system_settings drop constraint if exists system_settings_group_key_check;
alter table public.system_settings
  add constraint system_settings_group_key_check
  check (group_key in ('branding', 'appearance', 'organization', 'localization', 'navigation', 'dashboard', 'modules', 'payslip'));

alter table public.settings_versions drop constraint if exists settings_versions_group_key_check;
alter table public.settings_versions
  add constraint settings_versions_group_key_check
  check (group_key in ('branding', 'appearance', 'organization', 'localization', 'navigation', 'dashboard', 'modules', 'payslip'));
