create table if not exists public.worker_attendance_checklist_items (
  id uuid primary key default gen_random_uuid(),
  group_name text not null default 'An toàn',
  content text not null check (length(trim(content)) between 2 and 300),
  required boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_by uuid references public.app_accounts(id),
  updated_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1
);

create index if not exists worker_attendance_checklist_order_idx
  on public.worker_attendance_checklist_items(active, sort_order, created_at);

alter table public.worker_attendance_sessions
  add column if not exists checklist_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists checklist_responses jsonb not null default '[]'::jsonb;

alter table public.worker_attendance_checklist_items enable row level security;

drop trigger if exists worker_attendance_checklist_touch_updated_at on public.worker_attendance_checklist_items;
create trigger worker_attendance_checklist_touch_updated_at
before update on public.worker_attendance_checklist_items
for each row execute function public.touch_updated_at();

insert into public.worker_attendance_checklist_items(group_name,content,required,active,sort_order)
select seed.group_name,seed.content,true,true,seed.sort_order
from (values
  ('PPE','Đã trang bị đầy đủ bảo hộ lao động',10),
  ('An toàn','Đã phổ biến nội dung an toàn đầu ca',20),
  ('Công cụ','Công cụ và thiết bị làm việc bảo đảm an toàn',30),
  ('Điều kiện làm việc','Khu vực làm việc đủ điều kiện triển khai',40)
) as seed(group_name,content,sort_order)
where not exists (select 1 from public.worker_attendance_checklist_items);

comment on column public.worker_attendance_sessions.checklist_snapshot is
  'Bản sao bất biến của checklist tại thời điểm tạo phiên điểm danh.';
