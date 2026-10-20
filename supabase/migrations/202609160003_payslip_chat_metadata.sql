alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists messages_payslip_metadata_idx
  on public.messages((metadata->>'payslipId'))
  where metadata ? 'payslipId';
