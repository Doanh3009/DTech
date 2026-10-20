-- Development-only linked dataset for local/staging workflow testing.
-- Every business key is prefixed TEST- or uses the fixed 9xxxx UUID namespace.
-- Apply only to an isolated test database. Posted stock/audit history is retained.
begin;

insert into public.employees(id,employee_code,full_name,display_name,personal_phone,normalized_phone,company_email,department_id,position_id,employment_type_id,manager_employee_id,join_date,employment_status,profile_status,profile_completeness,note)
select '90000000-0000-4000-8000-000000000001','TEST-GS01','Nguyễn Minh Giám Sát','Minh','0909000001','84909000001','supervisor.test@chautuan.local',d.id,p.id,et.id,(select id from public.employees where lower(employee_code)='hr002' limit 1),current_date-700,'active','complete',100,'[TEST DATA] Giám sát công trường'
from public.departments d,public.positions p,public.employment_types et where d.code='construction' and p.code='site_supervisor' and et.code='supervisor'
on conflict(id) do update set full_name=excluded.full_name,note=excluded.note;
insert into public.employees(id,employee_code,full_name,display_name,personal_phone,normalized_phone,company_email,department_id,position_id,employment_type_id,join_date,employment_status,profile_status,profile_completeness,note)
select '90000000-0000-4000-8000-000000000002','TEST-NV01','Trần Thu Nhân Viên','Thu','0909000002','84909000002','employee.test@chautuan.local',d.id,p.id,et.id,current_date-400,'active','complete',100,'[TEST DATA] Nhân viên văn phòng'
from public.departments d,public.positions p,public.employment_types et where d.code='hr' and p.code='hr_specialist' and et.code='office_employee'
on conflict(id) do update set full_name=excluded.full_name,note=excluded.note;

insert into public.app_accounts(id,employee_id,display_name,primary_email,status,metadata,username) values
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Nguyễn Minh Giám Sát','supervisor.test@chautuan.local','active','{"testData":true}'::jsonb,'test.supervisor'),
('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','Trần Thu Nhân Viên','employee.test@chautuan.local','active','{"testData":true}'::jsonb,'test.employee')
on conflict(id) do update set display_name=excluded.display_name,metadata=excluded.metadata,username=excluded.username;
insert into public.account_roles(account_id,role_id) select '91000000-0000-4000-8000-000000000001',id from public.roles where code='supervisor' on conflict do nothing;
insert into public.account_roles(account_id,role_id) select '91000000-0000-4000-8000-000000000001',id from public.roles where code='employee' on conflict do nothing;
insert into public.account_roles(account_id,role_id) select '91000000-0000-4000-8000-000000000002',id from public.roles where code='employee' on conflict do nothing;

insert into public.employee_contracts(id,employee_id,contract_number,contract_type,start_date,end_date,status,note,created_by,signed_date,effective_date) values
('92000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','TEST-HD-GS01','Hợp đồng xác định thời hạn',current_date-700,current_date+30,'active','[TEST DATA] Sắp hết hạn','91000000-0000-4000-8000-000000000001',current_date-710,current_date-700),
('92000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','TEST-HD-NV01','Hợp đồng không xác định thời hạn',current_date-400,null,'active','[TEST DATA]','91000000-0000-4000-8000-000000000001',current_date-410,current_date-400)
on conflict(id) do update set end_date=excluded.end_date,note=excluded.note;
insert into public.project_assignments(id,project_id,worksite_id,employee_id,assignment_role,start_date,end_date,shift_code,shift_name,status,assigned_by)
values('93000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','supervisor_main',current_date-10,current_date+30,'DAY','Ca ngày','active','91000000-0000-4000-8000-000000000001')
on conflict(id) do update set status='active',end_date=excluded.end_date;

insert into public.project_assignments(id,project_id,worksite_id,employee_id,assignment_role,start_date,end_date,shift_code,shift_name,status,assigned_by)
select ('93010000-0000-4000-8000-'||lpad(row_number() over(order by employee_code)::text,12,'0'))::uuid,
  'b0000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001',employee.id,
  'worker',current_date-10,current_date+30,'DAY','Ca ngày','active','91000000-0000-4000-8000-000000000001'
from public.employees employee
where lower(employee.employee_code) in ('cn018','cn019','cn020')
  and not exists (select 1 from public.project_assignments assignment
    where assignment.project_id='b0000000-0000-4000-8000-000000000001'
      and assignment.worksite_id='b1000000-0000-4000-8000-000000000001'
      and assignment.employee_id=employee.id and assignment.assignment_role='worker'
      and assignment.status='active' and assignment.start_date<=current_date
      and (assignment.end_date is null or assignment.end_date>=current_date))
on conflict(id) do nothing;

insert into public.attendance_events(id,client_event_id,employee_id,account_id,event_type,attendance_date,effective_at,captured_at_client,location_id,latitude,longitude,accuracy_meters,distance_meters,geofence_status,attendance_status,photo_status,sync_status,captured_offline,device_metadata)
select v.id::uuid,v.client_id::uuid,'90000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002',v.event_type::public.attendance_event_type,current_date,(current_date+v.event_time::time)::timestamptz,(current_date+v.event_time::time)::timestamptz,l.id,l.latitude,l.longitude,12,8,'valid','recorded','uploaded','synced',false,'{"testData":true,"device":"seed"}'::jsonb
from(values('94000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','check_in','07:56'),('94000000-0000-4000-8000-000000000002','94100000-0000-4000-8000-000000000002','check_out','17:08'))v(id,client_id,event_type,event_time)
cross join lateral(select * from public.attendance_locations where active order by created_at limit 1)l
on conflict(id) do update set effective_at=excluded.effective_at,attendance_date=excluded.attendance_date;

-- Personal mobile calendar: recent working days for both demo accounts.
insert into public.attendance_events(id,client_event_id,employee_id,account_id,event_type,attendance_date,effective_at,captured_at_client,location_id,latitude,longitude,accuracy_meters,distance_meters,geofence_status,attendance_status,photo_status,sync_status,captured_offline,device_metadata)
select
  ('94200000-0000-4000-8000-' || left(md5(person.employee_id || ':' || (current_date-day_offset)::text || ':' || event_number::text), 12))::uuid,
  ('94300000-0000-4000-8000-' || left(md5(person.employee_id || ':' || (current_date-day_offset)::text || ':' || event_number::text), 12))::uuid,
  person.employee_id::uuid,person.account_id::uuid,
  case when event_number=0 then 'check_in' else 'check_out' end::public.attendance_event_type,
  current_date-day_offset,
  ((current_date-day_offset)::timestamp + case when event_number=0 then time '07:54' else time '17:06' end) at time zone 'Asia/Ho_Chi_Minh',
  ((current_date-day_offset)::timestamp + case when event_number=0 then time '07:54' else time '17:06' end) at time zone 'Asia/Ho_Chi_Minh',
  location.id,location.latitude,location.longitude,12,8,'valid','recorded','not_required','synced',false,'{"testData":true,"device":"seed-calendar"}'::jsonb
from (values (1,'90000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'),(2,'90000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002')) person(number,employee_id,account_id)
cross join generate_series(1,24) as offsets(day_offset)
cross join generate_series(0,1) as events(event_number)
cross join lateral (select * from public.attendance_locations where active order by created_at limit 1) location
where extract(isodow from current_date-day_offset)<=5 and not (day_offset=3 and event_number=1)
on conflict(id) do nothing;

insert into public.worker_attendance_sessions(id,client_session_id,project_id,project_name_snapshot,worksite_id,worksite_name_snapshot,attendance_date,shift_code,shift_name_snapshot,supervisor_employee_id,supervisor_name_snapshot,captured_at_client,geofence_status,work_note,status,sync_status,photo_status,created_by,submitted_at)
values('95000000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Bảo trì hệ thống ray Cảng ABC','b1000000-0000-4000-8000-000000000001','Khu QC03',current_date,'DAY','Ca ngày','90000000-0000-4000-8000-000000000001','Nguyễn Minh Giám Sát',now(),'valid','[TEST DATA] Kiểm tra an toàn đầu ca','submitted','synced','uploaded','91000000-0000-4000-8000-000000000001',now())
on conflict(id) do update set attendance_date=excluded.attendance_date,status=excluded.status;
insert into public.worker_attendance_entries(id,session_id,worker_id,employee_code_snapshot,worker_name_snapshot,assignment_role_snapshot,status,day_exception)
select('95200000-0000-4000-8000-'||lpad(row_number()over(order by employee_code)::text,12,'0'))::uuid,'95000000-0000-4000-8000-000000000001',id,employee_code,full_name,'worker','present','none'
from public.employees where lower(employee_code)in('cn018','cn019','cn020') on conflict(session_id,worker_id)do update set status=excluded.status;

insert into public.leave_requests(id,request_number,employee_id,leave_type_id,start_date,end_date,calculated_days,reason,status,submitted_at,workflow_snapshot,employee_snapshot,created_by)
select'96000000-0000-4000-8000-000000000001','TEST-LV-0001','90000000-0000-4000-8000-000000000002',lt.id,current_date+3,current_date+3,1,'[TEST DATA] Nghỉ phép cá nhân','pending_approval',now(),'{}'::jsonb,jsonb_build_object('code','TEST-NV01','name','Trần Thu Nhân Viên'),'91000000-0000-4000-8000-000000000002'
from public.leave_types lt where lt.active order by lt.deducts_balance desc limit 1 on conflict(id)do update set start_date=excluded.start_date,end_date=excluded.end_date,status=excluded.status;

-- Opening inventory must have matching immutable ledger entries.
insert into public.inventory_documents(id,client_request_id,document_number,type,status,document_date,target_warehouse_id,transaction_type_code,note,created_by)
values('97a00000-0000-4000-8000-000000000001','97a10000-0000-4000-8000-000000000001','TEST-PNK-OPENING','receipt','submitted',current_date-30,'e3000000-0000-4000-8000-000000000001','PURCHASE','[TEST DATA] Tồn kho đầu kỳ','91000000-0000-4000-8000-000000000001')
on conflict(id) do nothing;
insert into public.inventory_document_lines(id,document_id,line_number,item_id,quantity,uom_id,reference)
select ('97a20000-0000-4000-8000-'||lpad(opening.line_number::text,12,'0'))::uuid,'97a00000-0000-4000-8000-000000000001',opening.line_number,item.id,opening.quantity,item.base_uom_id,'[TEST DATA] Opening inventory'
from(values(1,'e2000000-0000-4000-8000-000000000001'::uuid,8),(2,'e2000000-0000-4000-8000-000000000002'::uuid,42),(3,'e2000000-0000-4000-8000-000000000003'::uuid,16))opening(line_number,item_id,quantity)
join public.inventory_items item on item.id=opening.item_id
on conflict(id) do nothing;
select public.post_inventory_document('97a00000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',current_date-30,'97a30000-0000-4000-8000-000000000001');
insert into public.inventory_documents(id,client_request_id,document_number,type,status,document_date,target_warehouse_id,transaction_type_code,supplier_reference,note,created_by,submitted_by,submitted_at)
values('97000000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','TEST-PNK-0001','receipt','submitted',current_date,'e3000000-0000-4000-8000-000000000001','PURCHASE','TEST-PO-001','[TEST DATA] Phiếu chờ ghi sổ','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001',now())on conflict(id)do nothing;
insert into public.inventory_document_lines(id,document_id,line_number,item_id,quantity,uom_id,unit_price,reference)
values('97200000-0000-4000-8000-000000000001','97000000-0000-4000-8000-000000000001',1,'e2000000-0000-4000-8000-000000000001',12,'e0000000-0000-4000-8000-000000000004',850000,'[TEST DATA]')on conflict(id)do nothing;

insert into public.business_partners(id,partner_code,name,partner_types,country,status,note,created_by)values
('98000000-0000-4000-8000-000000000001','TEST-SUPPLIER','Test Rail Supplier',array['supplier'],'CN','active','[TEST DATA]','91000000-0000-4000-8000-000000000001'),('98000000-0000-4000-8000-000000000002','TEST-CARRIER','Test Ocean Carrier',array['carrier'],'SG','active','[TEST DATA]','91000000-0000-4000-8000-000000000001')on conflict(id)do update set note='[TEST DATA]';
insert into public.import_contracts(id,client_request_id,contract_number,supplier_id,order_date,currency,incoterm,expected_delivery_date,status,note,created_by)
values('98100000-0000-4000-8000-000000000001','98110000-0000-4000-8000-000000000001','TEST-PO-2026-001','98000000-0000-4000-8000-000000000001',current_date-30,'USD','CIF',current_date+7,'partially_shipped','[TEST DATA]','91000000-0000-4000-8000-000000000001')on conflict(id)do update set expected_delivery_date=excluded.expected_delivery_date,status=excluded.status;
insert into public.import_contract_lines(id,contract_id,line_number,item_id,description_snapshot,ordered_quantity,uom_id,unit_price,currency,expected_delivery_date)
values('98120000-0000-4000-8000-000000000001','98100000-0000-4000-8000-000000000001',1,'e2000000-0000-4000-8000-000000000001','Ray P24',100,'e0000000-0000-4000-8000-000000000004',1200,'USD',current_date+7)on conflict(id)do update set ordered_quantity=excluded.ordered_quantity;
insert into public.shipments(id,client_request_id,shipment_number,contract_id,supplier_id,carrier_id,assigned_account_id,transport_mode,origin,destination,port_of_loading,port_of_discharge,booking_number,bill_of_lading_number,current_etd,current_eta,status,note,created_by)
values('98200000-0000-4000-8000-000000000001','98210000-0000-4000-8000-000000000001','TEST-SHP-2026-001','98100000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000001','98000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','sea','Shanghai','Hồ Chí Minh','CNSHA','VNSGN','TEST-BK-001','TEST-BL-001',current_date-8,current_date+2,'customs_processing','[TEST DATA]','91000000-0000-4000-8000-000000000001')on conflict(id)do update set current_eta=excluded.current_eta,status=excluded.status;
insert into public.shipment_lines(id,shipment_id,contract_line_id,line_number,item_id,item_code_snapshot,item_name_snapshot,specification_snapshot,expected_quantity,uom_id,package_count,gross_weight)
values('98220000-0000-4000-8000-000000000001','98200000-0000-4000-8000-000000000001','98120000-0000-4000-8000-000000000001',1,'e2000000-0000-4000-8000-000000000001','RAY-P24','Ray P24','12 m/thanh',60,'e0000000-0000-4000-8000-000000000004',6,14500)on conflict(id)do update set expected_quantity=excluded.expected_quantity;
insert into public.shipment_customs(shipment_id,status,declaration_number,declaration_date,channel,issue_note,severity,updated_by)
values('98200000-0000-4000-8000-000000000001','issue','TEST-HQ-001',current_date-1,'red','Thiếu chứng nhận xuất xứ để kiểm tra workflow','high','91000000-0000-4000-8000-000000000001')on conflict(shipment_id)do update set status=excluded.status,issue_note=excluded.issue_note,severity=excluded.severity;

insert into public.timesheet_periods(id,code,name,start_date,end_date,status,version,row_version,locked_at,locked_by,created_by)
values('98300000-0000-4000-8000-000000000001','TEST-TS-PREV','[TEST DATA] Kỳ công tháng trước',(date_trunc('month',current_date)-interval'1 month')::date,(date_trunc('month',current_date)-interval'1 day')::date,'locked',1,1,now(),'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001')on conflict(id)do update set status='locked',locked_at=now();
insert into public.daily_timesheets(id,period_id,employee_id,work_date,employee_snapshot,source_codes,raw_source_snapshot,work_minutes,work_fraction,status)
values('98310000-0000-4000-8000-000000000001','98300000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002',(date_trunc('month',current_date)-interval'1 month')::date,'{"code":"TEST-NV01","name":"Trần Thu Nhân Viên"}'::jsonb,array['attendance'],'{}'::jsonb,480,1,'full_work')on conflict(id)do update set work_minutes=excluded.work_minutes;
insert into public.timesheet_period_summaries(id,period_id,employee_id,employee_snapshot,scheduled_workdays,actual_workdays,worked_minutes)
values('98320000-0000-4000-8000-000000000001','98300000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','{"code":"TEST-NV01","name":"Trần Thu Nhân Viên"}'::jsonb,22,21,10080)on conflict(id)do update set actual_workdays=excluded.actual_workdays;
insert into public.payroll_periods(id,period_month,timesheet_period_id,status,calculated_at,calculated_by,created_by,note)
values('98400000-0000-4000-8000-000000000001',(date_trunc('month',current_date)-interval'1 month')::date,'98300000-0000-4000-8000-000000000001','published',now(),'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','[TEST DATA] Phiếu lương cá nhân')on conflict(id)do update set status='published',calculated_at=now();
insert into public.payroll_lines(id,payroll_period_id,employee_id,work_days,base_salary,allowance,bonus,deduction,calculation_snapshot)
values('98410000-0000-4000-8000-000000000001','98400000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002',21,18000000,1200000,500000,300000,'{"testData":true}'::jsonb)on conflict(id)do update set work_days=excluded.work_days,base_salary=excluded.base_salary;
insert into public.payslips(id,payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
select '98420000-0000-4000-8000-000000000001',line.id,line.employee_id,1,'published',jsonb_build_object('periodMonth',period.period_month)||to_jsonb(line),now()-interval '5 days','91000000-0000-4000-8000-000000000001'
from public.payroll_lines line join public.payroll_periods period on period.id=line.payroll_period_id
where line.id='98410000-0000-4000-8000-000000000001'
on conflict(payroll_line_id,version) do update set snapshot=excluded.snapshot,status='published',published_at=excluded.published_at;

-- More real month-to-month variation for the employee's private payslip list.
insert into public.timesheet_periods(id,code,name,start_date,end_date,status,version,row_version,locked_at,locked_by,created_by)
select ('98300000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  'TEST-TS-HISTORY-'||month_offset,
  '[TEST DATA] Kỳ công '||to_char((date_trunc('month',current_date)-make_interval(months=>month_offset))::date,'MM/YYYY'),
  (date_trunc('month',current_date)-make_interval(months=>month_offset))::date,
  (date_trunc('month',current_date)-make_interval(months=>month_offset-1)-interval '1 day')::date,
  'locked',1,1,now(),'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001'
from generate_series(2,4) as months(month_offset)
on conflict(id) do update set start_date=excluded.start_date,end_date=excluded.end_date,status='locked';
insert into public.timesheet_period_summaries(id,period_id,employee_id,employee_snapshot,scheduled_workdays,actual_workdays,worked_minutes)
select ('98320000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  ('98300000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  '90000000-0000-4000-8000-000000000002','{"code":"TEST-NV01","name":"Trần Thu Nhân Viên"}'::jsonb,
  22,22-(month_offset%3),(22-(month_offset%3))*480
from generate_series(2,4) as months(month_offset)
on conflict(id) do update set actual_workdays=excluded.actual_workdays,worked_minutes=excluded.worked_minutes;
insert into public.payroll_periods(id,period_month,timesheet_period_id,status,calculated_at,calculated_by,created_by,note)
select ('98400000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  (date_trunc('month',current_date)-make_interval(months=>month_offset))::date,
  ('98300000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  'published',now(),'91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','[TEST DATA] Phiếu lương cá nhân'
from generate_series(2,4) as months(month_offset)
on conflict(id) do update set status='published',period_month=excluded.period_month;
insert into public.payroll_lines(id,payroll_period_id,employee_id,work_days,base_salary,allowance,bonus,deduction,calculation_snapshot)
select ('98410000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  ('98400000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  '90000000-0000-4000-8000-000000000002',22-(month_offset%3),18000000-month_offset*150000,1200000,month_offset*100000,300000,'{"testData":true}'::jsonb
from generate_series(2,4) as months(month_offset)
on conflict(id) do update set work_days=excluded.work_days,base_salary=excluded.base_salary,bonus=excluded.bonus;
insert into public.payslips(id,payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
select ('98420000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  line.id,line.employee_id,1,'published',jsonb_build_object('periodMonth',period.period_month)||to_jsonb(line),
  period.period_month+interval '1 month 5 days','91000000-0000-4000-8000-000000000001'
from generate_series(2,4) as months(month_offset)
join public.payroll_lines line on line.id=('98410000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid
join public.payroll_periods period on period.id=line.payroll_period_id
on conflict(payroll_line_id,version) do update set snapshot=excluded.snapshot,status='published',published_at=excluded.published_at;

-- The supervisor also has an employee self-service payslip, separate from worker roster attendance.
insert into public.timesheet_period_summaries(id,period_id,employee_id,employee_snapshot,scheduled_workdays,actual_workdays,worked_minutes)
select ('98330000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  ('98300000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  '90000000-0000-4000-8000-000000000001','{"code":"TEST-GS01","name":"Nguyễn Minh Giám Sát"}'::jsonb,22,22,10560
from generate_series(1,4) as months(month_offset)
on conflict(id) do nothing;
insert into public.payroll_lines(id,payroll_period_id,employee_id,work_days,base_salary,allowance,bonus,deduction,calculation_snapshot)
select ('98430000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  ('98400000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  '90000000-0000-4000-8000-000000000001',22,22000000-(month_offset-1)*200000,2000000,750000,400000,'{"testData":true}'::jsonb
from generate_series(1,4) as months(month_offset)
on conflict(id) do nothing;
insert into public.payslips(id,payroll_line_id,employee_id,version,status,snapshot,published_at,published_by)
select ('98440000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid,
  line.id,line.employee_id,1,'published',jsonb_build_object('periodMonth',period.period_month)||to_jsonb(line),
  period.period_month+interval '1 month 5 days','91000000-0000-4000-8000-000000000001'
from generate_series(1,4) as months(month_offset)
join public.payroll_lines line on line.id=('98430000-0000-4000-8000-'||lpad(month_offset::text,12,'0'))::uuid
join public.payroll_periods period on period.id=line.payroll_period_id
on conflict(payroll_line_id,version) do nothing;

insert into public.notifications(id,recipient_account_id,event_key,type,title,message,entity_type,entity_id,deep_link,priority,delivery_key)values
('98500000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','test.leave.pending','approval','Đơn nghỉ phép chờ duyệt','TEST-NV01 xin nghỉ một ngày.','leave_request','96000000-0000-4000-8000-000000000001','/leave/requests','important','test:leave:pending:1'),
('98500000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','test.customs.issue','warning','Lô hàng cần xử lý','TEST-SHP-2026-001 thiếu chứng từ.','shipment','98200000-0000-4000-8000-000000000001','/import-export/shipments/98200000-0000-4000-8000-000000000001','critical','test:customs:issue:1')on conflict(id)do update set read_at=null,message=excluded.message;
insert into public.conversations(id,type,title,direct_key,created_by)values
('98600000-0000-4000-8000-000000000001','group','[TEST] Điều phối QC03',null,'91000000-0000-4000-8000-000000000001'),
('98600000-0000-4000-8000-000000000002','direct',null,'91000000-0000-4000-8000-000000000001:91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002')
on conflict(id)do update set title=excluded.title,direct_key=excluded.direct_key;
insert into public.conversation_members(conversation_id,account_id,role)values
('98600000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','owner'),
('98600000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','member'),
('98600000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','owner'),
('98600000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','member')
on conflict do nothing;
insert into public.messages(id,conversation_id,sender_account_id,body,created_at,metadata)values
('98610000-0000-4000-8000-000000000001','98600000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','[TEST DATA] Đã cập nhật danh sách đầu ca.',now()-interval'10 minutes','{"deliveryState":"sent"}'::jsonb),
('98610000-0000-4000-8000-000000000002','98600000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','[TEST DATA] Đã nhận thông tin.',now()-interval'5 minutes','{"deliveryState":"sent"}'::jsonb),
('98610000-0000-4000-8000-000000000003','98600000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','[TEST DATA] Ca sáng đã xác nhận đủ người.',now()-interval'3 days','{"deliveryState":"sent"}'::jsonb),
('98610000-0000-4000-8000-000000000004','98600000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','[TEST DATA] Em sẽ theo dõi lịch công.',now()-interval'2 days','{"deliveryState":"sent"}'::jsonb),
('98610000-0000-4000-8000-000000000005','98600000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','[TEST DATA] Anh kiểm tra giúp em lượt chấm ra hôm trước nhé.',now()-interval'1 day','{"deliveryState":"sent"}'::jsonb),
('98610000-0000-4000-8000-000000000006','98600000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','[TEST DATA] Anh đã nhận, sẽ đối chiếu trong lịch công.',now()-interval'20 hours','{"deliveryState":"sent"}'::jsonb)
on conflict(id)do update set body=excluded.body;

insert into public.user_dashboard_notes(account_id,content)values('91000000-0000-4000-8000-000000000001','[TEST DATA] Kiểm tra chứng từ lô hàng và duyệt phép trước 15:00.')on conflict(account_id)do update set content=excluded.content;
insert into public.user_todos(id,user_id,title,due_date,priority,completed)values
('98700000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','Duyệt đơn nghỉ phép TEST-NV01',current_date,'high',false),
('98700000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','Kiểm tra hồ sơ TEST-SHP-2026-001',current_date+1,'medium',false)on conflict(id)do update set due_date=excluded.due_date,completed=false;

commit;
