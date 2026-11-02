insert into public.business_entity_definitions(kind,definition) values
('safety_incidents','{"label":"Sự cố an toàn lao động","feature":"quality","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"reported_by":{"label":"Người báo cáo","type":"ref","ref":"staff","requiresFeature":"people"},"incident_date":{"label":"Ngày xảy ra","type":"date","required":true},"severity":{"label":"Mức độ","type":"enum","values":{"near_miss":"Suýt xảy ra","minor":"Nhẹ","serious":"Nghiêm trọng","critical":"Đặc biệt nghiêm trọng"},"required":true},"location":{"label":"Vị trí","type":"text","max":180},"description":{"label":"Diễn biến","type":"text","required":true,"max":2000},"immediate_action":{"label":"Xử lý ban đầu","type":"text","max":1500},"injury_count":{"label":"Số người bị thương","type":"number","min":0,"default":0},"work_stopped":{"label":"Dừng công việc","type":"boolean"},"reported_on":{"label":"Ngày ghi nhận","type":"date","required":true}}}'::jsonb),
('quality_nonconformances','{"label":"Điểm không phù hợp chất lượng","feature":"quality","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"project_id":{"label":"Công trình","type":"ref","ref":"projects","requiresFeature":"projects"},"lot_id":{"label":"Lô hàng","type":"ref","ref":"lots"},"detected_on":{"label":"Ngày phát hiện","type":"date","required":true},"source_kind":{"label":"Công đoạn phát hiện","type":"enum","values":{"incoming":"Đầu vào","production":"Sản xuất","delivery":"Giao hàng","site":"Công trường","other":"Khác"},"required":true},"severity":{"label":"Mức độ","type":"enum","values":{"minor":"Nhẹ","major":"Lớn","critical":"Nghiêm trọng"},"required":true},"affected_quantity":{"label":"Số lượng ảnh hưởng","type":"number","min":0,"default":0},"description":{"label":"Mô tả điểm không phù hợp","type":"text","required":true,"max":2000},"containment_action":{"label":"Xử lý cách ly","type":"text","max":1500},"detected_by":{"label":"Người phát hiện","type":"ref","ref":"staff","requiresFeature":"people"}}}'::jsonb),
('corrective_actions','{"label":"Hành động khắc phục","feature":"quality","mode":"document","misaDomain":false,"requiresApproval":true,"fields":{"source_kind":{"label":"Loại nguồn","type":"enum","values":{"safety_incidents":"Sự cố an toàn","quality_nonconformances":"Điểm không phù hợp"},"required":true},"source_id":{"label":"Nguồn phát sinh","type":"text","required":true,"max":36},"action_type":{"label":"Loại hành động","type":"enum","values":{"corrective":"Khắc phục","preventive":"Phòng ngừa","containment":"Ngăn chặn"},"required":true},"owner_staff_id":{"label":"Người phụ trách","type":"ref","ref":"staff","requiresFeature":"people","required":true},"due_on":{"label":"Hạn hoàn thành","type":"date","required":true},"action_plan":{"label":"Kế hoạch hành động","type":"text","required":true,"max":2000},"completed_on":{"label":"Ngày hoàn thành","type":"date"},"effectiveness_result":{"label":"Kết quả xác nhận","type":"text","max":1500},"verified_by":{"label":"Người xác nhận","type":"ref","ref":"staff","requiresFeature":"people"}}}'::jsonb);

create table public.business_safety_incidents(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 project_id uuid,reported_by uuid,incident_date date not null,severity text not null check(severity in ('near_miss','minor','serious','critical')),
 location text,description text not null check(char_length(btrim(description)) between 3 and 2000),immediate_action text not null default '',injury_count integer not null default 0 check(injury_count>=0),work_stopped boolean not null default false,reported_on date not null,
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id),foreign key(tenant_id,reported_by) references public.business_staff(tenant_id,id)
);
create index business_safety_incidents_date_idx on public.business_safety_incidents(tenant_id,incident_date desc,status);
alter table public.business_safety_incidents enable row level security;
revoke all on public.business_safety_incidents from public,anon,authenticated,service_role;

create table public.business_quality_nonconformances(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 project_id uuid,lot_id uuid,detected_on date not null,source_kind text not null check(source_kind in ('incoming','production','delivery','site','other')),
 severity text not null check(severity in ('minor','major','critical')),affected_quantity numeric(20,4) not null default 0 check(affected_quantity>=0),description text not null check(char_length(btrim(description)) between 3 and 2000),containment_action text not null default '',detected_by uuid,
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,project_id) references public.business_projects(tenant_id,id),foreign key(tenant_id,lot_id) references public.business_lots(tenant_id,id),foreign key(tenant_id,detected_by) references public.business_staff(tenant_id,id)
);
create index business_quality_nonconformances_date_idx on public.business_quality_nonconformances(tenant_id,detected_on desc,status);
alter table public.business_quality_nonconformances enable row level security;
revoke all on public.business_quality_nonconformances from public,anon,authenticated,service_role;

create table public.business_corrective_actions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),
 code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),
 status text not null default 'draft' check(status in ('draft','posted','cancelled')),row_version integer not null default 1 check(row_version>0),
 created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,
 source_kind text not null check(source_kind in ('safety_incidents','quality_nonconformances')),source_id uuid not null,action_type text not null check(action_type in ('corrective','preventive','containment')),
 owner_staff_id uuid not null,due_on date not null,action_plan text not null check(char_length(btrim(action_plan)) between 3 and 2000),completed_on date,effectiveness_result text,verified_by uuid,
 unique(tenant_id,id),unique(tenant_id,code),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,owner_staff_id) references public.business_staff(tenant_id,id),foreign key(tenant_id,verified_by) references public.business_staff(tenant_id,id),check((completed_on is null and verified_by is null) or (completed_on is not null and verified_by is not null))
);
create index business_corrective_actions_due_idx on public.business_corrective_actions(tenant_id,due_on,status);
alter table public.business_corrective_actions enable row level security;
revoke all on public.business_corrective_actions from public,anon,authenticated,service_role;

create function public.business_corrective_action_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare source_table text;source_exists boolean;
begin
 if tg_op='UPDATE' and old.status='posted' and (new.source_kind,new.source_id,new.action_type,new.owner_staff_id,new.due_on,new.action_plan,new.completed_on,new.effectiveness_result,new.verified_by,new.name,new.notes) is distinct from (old.source_kind,old.source_id,old.action_type,old.owner_staff_id,old.due_on,old.action_plan,old.completed_on,old.effectiveness_result,old.verified_by,old.name,old.notes) then raise exception 'BUSINESS_RECORD_LOCKED';end if;
 if new.completed_on is not null and (new.verified_by is null or nullif(btrim(new.effectiveness_result),'') is null or new.verified_by=new.owner_staff_id) then raise exception 'BUSINESS_ACTION_VERIFICATION_REQUIRED';end if;
 source_table:=case new.source_kind when 'safety_incidents' then 'business_safety_incidents' when 'quality_nonconformances' then 'business_quality_nonconformances' else null end;
 execute format('select exists(select 1 from public.%I where tenant_id=$1 and id=$2 and status=''posted'')',source_table) into source_exists using new.tenant_id,new.source_id;
 if not source_exists then raise exception 'BUSINESS_INVALID_REFERENCE';end if;
 return new;
end $$;
revoke all on function public.business_corrective_action_guard() from public,anon,authenticated,service_role;
create trigger business_corrective_action_guard before insert or update on public.business_corrective_actions for each row execute function public.business_corrective_action_guard();

do $$
declare body text;anchor text;replacement text;
begin
 select pg_get_functiondef('public.business_misa_effect(uuid,uuid,text,jsonb,text,text)'::regprocedure) into body;
 anchor:='elsif p_kind=''employee_documents'' then return jsonb_build_object(''lines'',''[]''::jsonb);';
 replacement:=anchor||E'\n'||' elsif p_kind in (''safety_incidents'',''quality_nonconformances'',''corrective_actions'') then return jsonb_build_object(''lines'',''[]''::jsonb);';
 if strpos(body,anchor)=0 then raise exception 'Review MISA dispatch before adding safety and quality actions';end if;
 execute replace(body,anchor,replacement);
end $$;
