-- Non-destructive initial product configuration for project tcjjhxqtreemccdbvyza.
begin;
insert into public.system_settings (group_key, value, version)
values
  ('branding', '{"systemName":"DTech ERP","loginSubtitle":"Quản trị doanh nghiệp","logoMainUrl":null,"logoCompactUrl":null,"logoDarkUrl":null,"faviconUrl":null,"assetVersion":0}'::jsonb, 2),
  ('organization', '{"companyName":"DTech","shortName":"DTECH","address":"","phone":"","email":"","taxCode":"","representativeName":""}'::jsonb, 2),
  ('appearance', '{"primaryColor":"#2E9B67","density":"standard","tableDensity":"standard","defaultPageSize":20,"sidebarDefault":"expanded","appearanceMode":"light"}'::jsonb, 2),
  ('modules', '{"human_resources":true,"attendance":true,"projects":true,"warehouse":true,"import_export":true,"accounting":true,"operations":true,"reports":true,"messaging":true,"industryPreset":"general"}'::jsonb, 2),
  ('payslip', '{"companyName":"DTECH","title":"PHIẾU LƯƠNG THÁNG {month}","footer":"Tài liệu nội bộ · Dữ liệu lương riêng tư","primaryColor":"#2E9B67","showWorkDays":true,"showBaseSalary":true,"showAllowance":true,"showBonus":true,"showDeduction":true}'::jsonb, 2)
on conflict (group_key) do update set value = excluded.value, version = excluded.version, updated_at = now();
insert into public.settings_versions (group_key, version, snapshot, change_type)
select group_key, version, value, 'publish'
from public.system_settings where group_key in ('branding','organization','appearance','modules','payslip')
on conflict (group_key, version) do nothing;
commit;
