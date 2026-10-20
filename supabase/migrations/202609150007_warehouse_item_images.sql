alter table public.inventory_items
  add column if not exists primary_image_file_id uuid references public.file_assets(id) on delete restrict;

create index if not exists inventory_items_primary_image_idx
  on public.inventory_items (primary_image_file_id)
  where primary_image_file_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'warehouse-item-images',
  'warehouse-item-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
