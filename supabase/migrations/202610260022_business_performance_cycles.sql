insert into public.business_entity_definitions(kind,definition) values
('performance_cycles','{"label":"Chu kỳ đánh giá","feature":"people","mode":"master","misaDomain":false,"requiresApproval":false,"fields":{"starts_on":{"label":"Bắt đầu kỳ","type":"date","required":true},"ends_on":{"label":"Kết thúc kỳ","type":"date","required":true},"review_due_on":{"label":"Hạn đánh giá","type":"date","required":true},"cycle_state":{"label":"Trạng thái chu kỳ","type":"enum","required":true,"values":{"planned":"Dự kiến","open":"Đang thực hiện","closed":"Đã chốt"}}}}'::jsonb),
('performance_goals','{"label":"Mục tiêu/KPI","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"cycle_id":{"label":"Chu kỳ","type":"ref","ref":"performance_cycles","required":true},"staff_id":{"label":"Người phụ trách","type":"ref","ref":"staff","required":true},"parent_goal_id":{"label":"Mục tiêu cha","type":"ref","ref":"performance_goals"},"metric_name":{"label":"Chỉ tiêu","type":"text","required":true,"max":180},"unit":{"label":"Đơn vị đo","type":"text","required":true,"max":40},"target_value":{"label":"Mục tiêu","type":"number","required":true,"min":0.0001},"weight_pct":{"label":"Trọng số (%)","type":"number","required":true,"min":0.01,"max":100},"direction":{"label":"Hướng đánh giá","type":"enum","required":true,"values":{"higher_better":"Càng cao càng tốt","lower_better":"Càng thấp càng tốt"}},"document_date":{"label":"Ngày giao mục tiêu","type":"date","required":true}}}'::jsonb),
('performance_goal_checkins','{"label":"Cập nhật KPI","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"goal_id":{"label":"Mục tiêu","type":"ref","ref":"performance_goals","required":true},"checked_on":{"label":"Ngày cập nhật","type":"date","required":true},"actual_value":{"label":"Giá trị thực tế","type":"number","required":true,"min":0},"source_kind":{"label":"Nguồn số liệu","type":"enum","required":true,"values":{"manual":"Nhập thủ công","project":"Công trình","work_order":"Lệnh sản xuất","attendance":"Chấm công"}},"source_ref":{"label":"Mã nguồn","type":"text","max":100},"comment":{"label":"Ghi chú","type":"text","max":1000},"document_date":{"label":"Ngày chứng từ","type":"date","required":true}}}'::jsonb),
('performance_goal_changes','{"label":"Điều chỉnh mục tiêu","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"goal_id":{"label":"Mục tiêu","type":"ref","ref":"performance_goals","required":true},"new_target":{"label":"Mục tiêu mới","type":"number","required":true,"min":0.0001},"effective_on":{"label":"Ngày hiệu lực","type":"date","required":true},"change_reason":{"label":"Lý do thay đổi","type":"text","required":true,"max":500},"document_date":{"label":"Ngày chứng từ","type":"date","required":true}}}'::jsonb),
('performance_reviews','{"label":"Đánh giá cuối kỳ","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"cycle_id":{"label":"Chu kỳ","type":"ref","ref":"performance_cycles","required":true},"staff_id":{"label":"Nhân viên","type":"ref","ref":"staff","required":true},"manager_staff_id":{"label":"Quản lý đánh giá","type":"ref","ref":"staff","required":true},"self_score":{"label":"Tự đánh giá","type":"number","required":true,"min":0,"max":100},"manager_score":{"label":"Điểm quản lý","type":"number","required":true,"min":0,"max":100},"calibration_adjustment":{"label":"Điều chỉnh hiệu chuẩn","type":"number","min":-20,"max":20,"default":0},"manager_comment":{"label":"Nhận xét quản lý","type":"text","max":2000,"readRoles":["owner","editor"]},"document_date":{"label":"Ngày đánh giá","type":"date","required":true}}}'::jsonb),
('performance_review_acknowledgements','{"label":"Xác nhận đánh giá","feature":"people","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"review_id":{"label":"Kết quả đánh giá","type":"ref","ref":"performance_reviews","required":true},"acknowledged_on":{"label":"Ngày xác nhận","type":"date","required":true},"comment":{"label":"Ý kiến nhân viên","type":"text","max":1200},"document_date":{"label":"Ngày chứng từ","type":"date","required":true}}}'::jsonb);

create table public.business_performance_cycles(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'active' check(status in ('active','inactive')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 starts_on date not null,ends_on date not null,review_due_on date not null,cycle_state text not null default 'planned' check(cycle_state in ('planned','open','closed')),
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),check(ends_on>=starts_on),check(review_due_on>=ends_on)
);
create index business_performance_cycles_state_idx on public.business_performance_cycles(tenant_id,cycle_state,starts_on desc);
alter table public.business_performance_cycles enable row level security;
revoke all on public.business_performance_cycles from public,anon,authenticated,service_role;

create table public.business_performance_goals(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 cycle_id uuid not null,staff_id uuid not null,parent_goal_id uuid,metric_name text not null,unit text not null,target_value numeric(24,6) not null check(target_value>0),weight_pct numeric(7,4) not null check(weight_pct>0 and weight_pct<=100),direction text not null check(direction in ('higher_better','lower_better')),document_date date not null,
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,cycle_id) references public.business_performance_cycles(tenant_id,id),foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id),foreign key(tenant_id,parent_goal_id) references public.business_performance_goals(tenant_id,id),check(parent_goal_id is null or parent_goal_id<>id)
);
create unique index business_performance_goal_metric_idx on public.business_performance_goals(tenant_id,cycle_id,staff_id,lower(metric_name));
create index business_performance_goals_staff_idx on public.business_performance_goals(tenant_id,cycle_id,staff_id) where status='posted';
alter table public.business_performance_goals enable row level security;
revoke all on public.business_performance_goals from public,anon,authenticated,service_role;

create table public.business_performance_goal_checkins(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 goal_id uuid not null,checked_on date not null,actual_value numeric(24,6) not null check(actual_value>=0),source_kind text not null check(source_kind in ('manual','project','work_order','attendance')),source_ref text,comment text not null default '',document_date date not null,
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,goal_id) references public.business_performance_goals(tenant_id,id)
);
create index business_performance_goal_checkins_latest_idx on public.business_performance_goal_checkins(tenant_id,goal_id,checked_on desc) where status='posted';
alter table public.business_performance_goal_checkins enable row level security;
revoke all on public.business_performance_goal_checkins from public,anon,authenticated,service_role;

create table public.business_performance_goal_changes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 goal_id uuid not null,new_target numeric(24,6) not null check(new_target>0),effective_on date not null,change_reason text not null check(char_length(btrim(change_reason)) between 3 and 500),document_date date not null,
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,goal_id) references public.business_performance_goals(tenant_id,id)
);
create index business_performance_goal_changes_goal_idx on public.business_performance_goal_changes(tenant_id,goal_id,created_at desc);
alter table public.business_performance_goal_changes enable row level security;
revoke all on public.business_performance_goal_changes from public,anon,authenticated,service_role;

create table public.business_performance_reviews(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 cycle_id uuid not null,staff_id uuid not null,manager_staff_id uuid not null,self_score numeric(6,2) not null check(self_score between 0 and 100),manager_score numeric(6,2) not null check(manager_score between 0 and 100),calibration_adjustment numeric(6,2) not null default 0 check(calibration_adjustment between -20 and 20),manager_comment text not null default '',calculated_goal_score numeric(6,2),final_score numeric(6,2),document_date date not null,
 unique(tenant_id,id),unique(tenant_id,code),unique(tenant_id,cycle_id,staff_id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,cycle_id) references public.business_performance_cycles(tenant_id,id),foreign key(tenant_id,staff_id) references public.business_staff(tenant_id,id),foreign key(tenant_id,manager_staff_id) references public.business_staff(tenant_id,id),check(staff_id<>manager_staff_id)
);
alter table public.business_performance_reviews enable row level security;
revoke all on public.business_performance_reviews from public,anon,authenticated,service_role;

create table public.business_performance_review_acknowledgements(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 review_id uuid not null,acknowledged_on date not null,comment text not null default '',document_date date not null,
 unique(tenant_id,id),unique(tenant_id,code),unique(tenant_id,review_id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,review_id) references public.business_performance_reviews(tenant_id,id)
);
alter table public.business_performance_review_acknowledgements enable row level security;
revoke all on public.business_performance_review_acknowledgements from public,anon,authenticated,service_role;

create table public.business_performance_goal_target_history(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),goal_id uuid not null,change_id uuid not null,changed_by uuid not null,changed_at timestamptz not null default now(),old_target numeric(24,6) not null,new_target numeric(24,6) not null,reason text not null,
 foreign key(tenant_id,goal_id) references public.business_performance_goals(tenant_id,id),foreign key(tenant_id,change_id) references public.business_performance_goal_changes(tenant_id,id),foreign key(tenant_id,changed_by) references public.business_accounts(tenant_id,id)
);
create index business_performance_goal_history_idx on public.business_performance_goal_target_history(tenant_id,goal_id,changed_at);
alter table public.business_performance_goal_target_history enable row level security;
revoke all on public.business_performance_goal_target_history from public,anon,authenticated,service_role;

create function public.business_performance_cycle_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare v record;
begin
 if tg_op='UPDATE' and old.cycle_state='closed' and (new.starts_on,new.ends_on,new.review_due_on,new.cycle_state,new.name,new.notes) is distinct from (old.starts_on,old.ends_on,old.review_due_on,old.cycle_state,old.name,old.notes) then raise exception 'BUSINESS_CYCLE_LOCKED';end if;
 if tg_op='UPDATE' and old.cycle_state='planned' and new.cycle_state='closed' then raise exception 'BUSINESS_CYCLE_NOT_OPEN';end if;
 if new.cycle_state='closed' then
  if exists(select 1 from public.business_performance_goals where tenant_id=new.tenant_id and cycle_id=new.id and status<>'posted') then raise exception 'BUSINESS_GOALS_NOT_FINAL';end if;
  for v in select distinct staff_id from public.business_performance_goals where tenant_id=new.tenant_id and cycle_id=new.id and status='posted' loop
   if not exists(select 1 from public.business_performance_reviews r join public.business_performance_review_acknowledgements a on a.tenant_id=r.tenant_id and a.review_id=r.id and a.status='posted' where r.tenant_id=new.tenant_id and r.cycle_id=new.id and r.staff_id=v.staff_id and r.status='posted') then raise exception 'BUSINESS_REVIEW_ACK_REQUIRED';end if;
  end loop;
  if not exists(select 1 from public.business_performance_goals where tenant_id=new.tenant_id and cycle_id=new.id and status='posted') then raise exception 'BUSINESS_GOALS_REQUIRED';end if;
 end if;return new;
end $$;
revoke all on function public.business_performance_cycle_guard() from public,anon,authenticated,service_role;
create trigger business_performance_cycle_guard before insert or update on public.business_performance_cycles for each row execute function public.business_performance_cycle_guard();

create function public.business_performance_goal_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare cycle public.business_performance_cycles%rowtype;parent public.business_performance_goals%rowtype;change_exists boolean;
begin
 select * into cycle from public.business_performance_cycles where tenant_id=new.tenant_id and id=new.cycle_id;
 if not found or cycle.cycle_state<>'open' then raise exception 'BUSINESS_CYCLE_NOT_OPEN';end if;
 if not exists(select 1 from public.business_staff where tenant_id=new.tenant_id and id=new.staff_id and status='active') then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 if new.parent_goal_id is not null then select * into parent from public.business_performance_goals where tenant_id=new.tenant_id and id=new.parent_goal_id;if not found or parent.cycle_id<>new.cycle_id or parent.staff_id<>new.staff_id or parent.status<>'posted' then raise exception 'BUSINESS_INVALID_PARENT_GOAL';end if;end if;
 if tg_op='UPDATE' and old.status='posted' then
  if exists(select 1 from public.business_performance_reviews where tenant_id=old.tenant_id and cycle_id=old.cycle_id and staff_id=old.staff_id and status='posted') then raise exception 'BUSINESS_REVIEW_LOCKED';end if;
  if (new.cycle_id,new.staff_id,new.parent_goal_id,new.metric_name,new.unit,new.weight_pct,new.direction,new.document_date,new.name,new.notes) is distinct from (old.cycle_id,old.staff_id,old.parent_goal_id,old.metric_name,old.unit,old.weight_pct,old.direction,old.document_date,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
  if new.target_value is distinct from old.target_value then select exists(select 1 from public.business_performance_goal_changes c where c.tenant_id=new.tenant_id and c.goal_id=new.id and c.new_target=new.target_value and c.status='posted') into change_exists;if not change_exists then raise exception 'BUSINESS_TARGET_CHANGE_APPROVAL_REQUIRED';end if;end if;
 end if;
 if new.status='posted' and tg_op='UPDATE' and old.status<>'posted' then if not exists(select 1 from public.business_performance_cycles c where c.tenant_id=new.tenant_id and c.id=new.cycle_id and c.cycle_state='open') then raise exception 'BUSINESS_CYCLE_NOT_OPEN';end if;end if;
 return new;
end $$;
revoke all on function public.business_performance_goal_guard() from public,anon,authenticated,service_role;
create trigger business_performance_goal_guard before insert or update on public.business_performance_goals for each row execute function public.business_performance_goal_guard();

create function public.business_performance_checkin_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.business_performance_goals%rowtype;c public.business_performance_cycles%rowtype;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.goal_id,new.checked_on,new.actual_value,new.source_kind,new.source_ref,new.comment,new.document_date,new.name,new.notes) is distinct from (old.goal_id,old.checked_on,old.actual_value,old.source_kind,old.source_ref,old.comment,old.document_date,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' then select * into g from public.business_performance_goals where tenant_id=new.tenant_id and id=new.goal_id and status='posted';select * into c from public.business_performance_cycles where tenant_id=new.tenant_id and id=g.cycle_id;if not found or c.cycle_state<>'open' or new.checked_on<c.starts_on or new.checked_on>c.ends_on then raise exception 'BUSINESS_CYCLE_NOT_OPEN';end if;if exists(select 1 from public.business_performance_reviews where tenant_id=new.tenant_id and cycle_id=g.cycle_id and staff_id=g.staff_id and status='posted') then raise exception 'BUSINESS_REVIEW_LOCKED';end if;end if;return new;
end $$;
revoke all on function public.business_performance_checkin_guard() from public,anon,authenticated,service_role;
create trigger business_performance_checkin_guard before insert or update on public.business_performance_goal_checkins for each row execute function public.business_performance_checkin_guard();

create function public.business_performance_goal_change_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.business_performance_goals%rowtype;c public.business_performance_cycles%rowtype;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.goal_id,new.new_target,new.effective_on,new.change_reason,new.document_date,new.name,new.notes) is distinct from (old.goal_id,old.new_target,old.effective_on,old.change_reason,old.document_date,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' then select * into g from public.business_performance_goals where tenant_id=new.tenant_id and id=new.goal_id and status='posted';select * into c from public.business_performance_cycles where tenant_id=new.tenant_id and id=g.cycle_id;if not found or c.cycle_state<>'open' or new.effective_on<c.starts_on or new.effective_on>c.ends_on then raise exception 'BUSINESS_CYCLE_NOT_OPEN';end if;if exists(select 1 from public.business_performance_reviews where tenant_id=new.tenant_id and cycle_id=g.cycle_id and staff_id=g.staff_id and status='posted') then raise exception 'BUSINESS_REVIEW_LOCKED';end if;end if;return new;
end $$;
revoke all on function public.business_performance_goal_change_guard() from public,anon,authenticated,service_role;
create trigger business_performance_goal_change_guard before insert or update on public.business_performance_goal_changes for each row execute function public.business_performance_goal_change_guard();
create function public.business_performance_goal_change_apply() returns trigger language plpgsql security definer set search_path='' as $$
declare old_target numeric(24,6);actor_id uuid;
begin
 if new.status='posted' and old.status<>'posted' then select target_value into old_target from public.business_performance_goals where tenant_id=new.tenant_id and id=new.goal_id for update;select d.actor_id into actor_id from public.business_approval_runs r join public.business_approval_decisions d on d.tenant_id=r.tenant_id and d.run_id=r.id where r.tenant_id=new.tenant_id and r.kind='performance_goal_changes' and r.record_id=new.id and d.decision='approve' order by d.created_at desc limit 1;if actor_id is null then raise exception 'BUSINESS_APPROVAL_REQUIRED';end if;update public.business_performance_goals set target_value=new.new_target,row_version=row_version+1,updated_at=now() where tenant_id=new.tenant_id and id=new.goal_id;insert into public.business_performance_goal_target_history(tenant_id,goal_id,change_id,changed_by,old_target,new_target,reason) values(new.tenant_id,new.goal_id,new.id,actor_id,old_target,new.new_target,new.change_reason);end if;return new;
end $$;
revoke all on function public.business_performance_goal_change_apply() from public,anon,authenticated,service_role;
create trigger business_performance_goal_change_apply after update on public.business_performance_goal_changes for each row execute function public.business_performance_goal_change_apply();

create function public.business_performance_review_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.business_performance_cycles%rowtype;weight_total numeric;goal_count integer;metric_snapshot jsonb;weighted numeric;manager_ok boolean;employee_account uuid;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.cycle_id,new.staff_id,new.manager_staff_id,new.self_score,new.manager_score,new.calibration_adjustment,new.manager_comment,new.document_date,new.name,new.notes) is distinct from (old.cycle_id,old.staff_id,old.manager_staff_id,old.self_score,old.manager_score,old.calibration_adjustment,old.manager_comment,old.document_date,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' and (tg_op='INSERT' or old.status<>'posted') then
  select * into c from public.business_performance_cycles where tenant_id=new.tenant_id and id=new.cycle_id and cycle_state='open';if not found then raise exception 'BUSINESS_CYCLE_NOT_OPEN';end if;
  select coalesce(sum(weight_pct),0),count(*) into weight_total,goal_count from public.business_performance_goals where tenant_id=new.tenant_id and cycle_id=new.cycle_id and staff_id=new.staff_id and status='posted';if goal_count=0 or abs(weight_total-100)>0.0001 then raise exception 'BUSINESS_GOAL_WEIGHTS_MUST_EQUAL_100';end if;
  select exists(select 1 from public.business_approval_runs r join public.business_approval_decisions d on d.tenant_id=r.tenant_id and d.run_id=r.id join public.business_accounts a on a.tenant_id=d.tenant_id and a.id=d.actor_id where r.tenant_id=new.tenant_id and r.kind='performance_reviews' and r.record_id=new.id and r.status='approved' and d.decision='approve' and a.staff_id=new.manager_staff_id and a.staff_id<>new.staff_id) into manager_ok;if not manager_ok then raise exception 'BUSINESS_MANAGER_APPROVAL_REQUIRED';end if;
  select coalesce(jsonb_agg(jsonb_build_object('goalId',g.id,'metric',g.metric_name,'target',g.target_value,'actual',x.actual_value,'weightPct',g.weight_pct,'score',x.score) order by g.code),'[]'::jsonb),coalesce(sum(g.weight_pct*x.score)/100,0) into metric_snapshot,weighted from public.business_performance_goals g join lateral (select ci.actual_value,case g.direction when 'higher_better' then least(ci.actual_value/g.target_value,1)*100 else least(g.target_value/greatest(ci.actual_value,0.000001),1)*100 end score from public.business_performance_goal_checkins ci where ci.tenant_id=g.tenant_id and ci.goal_id=g.id and ci.status='posted' order by ci.checked_on desc,ci.created_at desc limit 1) x on true where g.tenant_id=new.tenant_id and g.cycle_id=new.cycle_id and g.staff_id=new.staff_id and g.status='posted';
  if jsonb_array_length(metric_snapshot)<>goal_count then raise exception 'BUSINESS_GOAL_CHECKINS_REQUIRED';end if;
  new.calculated_goal_score:=round(weighted,2);new.final_score:=round(greatest(0,least(100,new.manager_score+new.calibration_adjustment)),2);new.calculation_snapshot:=coalesce(new.calculation_snapshot,'{}'::jsonb)||jsonb_build_object('cycleId',new.cycle_id,'staffId',new.staff_id,'goalWeightPct',weight_total,'weightedGoalScore',new.calculated_goal_score,'finalScore',new.final_score,'metrics',metric_snapshot,'snapshotAt',now());
 end if;return new;
end $$;
revoke all on function public.business_performance_review_guard() from public,anon,authenticated,service_role;
create trigger business_performance_review_guard before insert or update on public.business_performance_reviews for each row execute function public.business_performance_review_guard();

create function public.business_performance_ack_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.business_performance_reviews%rowtype;a public.business_accounts%rowtype;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.review_id,new.acknowledged_on,new.comment,new.document_date,new.name,new.notes) is distinct from (old.review_id,old.acknowledged_on,old.comment,old.document_date,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.status='posted' then select * into r from public.business_performance_reviews where tenant_id=new.tenant_id and id=new.review_id and status='posted';select * into a from public.business_accounts where tenant_id=new.tenant_id and id=new.created_by;if not found or r.id is null or a.staff_id is distinct from r.staff_id then raise exception 'BUSINESS_EMPLOYEE_ACK_REQUIRED';end if;if new.acknowledged_on<r.document_date then raise exception 'BUSINESS_INVALID_DATE';end if;end if;return new;
end $$;
revoke all on function public.business_performance_ack_guard() from public,anon,authenticated,service_role;
create trigger business_performance_ack_guard before insert or update on public.business_performance_review_acknowledgements for each row execute function public.business_performance_ack_guard();

do $$
declare body text;anchor text;replacement text;
begin select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;anchor:='elsif p_kind in (''recruitment_requisitions'',''recruitment_job_posts'',''recruitment_candidates'',''recruitment_interviews'',''recruitment_offers'',''recruitment_hires'') then return jsonb_build_object(''lines'',''[]''::jsonb);';replacement:=anchor||E'\n'||' elsif p_kind in (''performance_cycles'',''performance_goals'',''performance_goal_checkins'',''performance_goal_changes'',''performance_reviews'',''performance_review_acknowledgements'') then return jsonb_build_object(''lines'',''[]''::jsonb);';if strpos(body,anchor)=0 then raise exception 'Review MISA dispatch before adding performance workflows';end if;execute replace(body,anchor,replacement);end $$;
