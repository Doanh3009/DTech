-- Document counters are internal state; only server/RPC operations may access them.
alter table public.import_contract_number_sequences enable row level security;
alter table public.inventory_number_sequences enable row level security;
alter table public.shipment_number_sequences enable row level security;
alter table public.stock_count_number_sequences enable row level security;

revoke all on table public.import_contract_number_sequences,
  public.inventory_number_sequences,
  public.shipment_number_sequences,
  public.stock_count_number_sequences from public, anon, authenticated;

grant all on table public.import_contract_number_sequences,
  public.inventory_number_sequences,
  public.shipment_number_sequences,
  public.stock_count_number_sequences to service_role;
