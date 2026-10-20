alter table public.employee_insurance_profiles
  add column if not exists contribution_rate_percent numeric(5,2)
    check (contribution_rate_percent is null or contribution_rate_percent between 0 and 100),
  add column if not exists contribution_month date,
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','overdue'));

create index if not exists employee_insurance_profiles_payment_idx
  on public.employee_insurance_profiles(payment_status, contribution_month);
