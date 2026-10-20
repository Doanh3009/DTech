update public.system_settings
set value = jsonb_set(value, '{timeFormat}', '"HH:mm"'::jsonb, true),
    version = version + 1,
    updated_at = now()
where group_key = 'localization'
  and value ->> 'timeFormat' is distinct from 'HH:mm';
