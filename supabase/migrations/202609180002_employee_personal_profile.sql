alter table public.employees
  add column if not exists marital_status text,
  alter column personal_phone drop not null,
  alter column normalized_phone drop not null;

comment on column public.employees.marital_status is
  'Tình trạng hôn nhân tự khai; trường không bắt buộc.';
