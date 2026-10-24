import {readFile,writeFile} from 'node:fs/promises';
const ref=(label,kind,required=true)=>({label,type:'ref',ref:kind,required});
const text=(label,required=true,max=240)=>({label,type:'text',required,max});
const date=(label,required=true)=>({label,type:'date',required});
const number=(label,min=0,max=1e15,extra={})=>({label,type:'number',min,max,default:0,...extra});
const time=label=>({label,type:'time',required:true});
const choice=(label,values)=>({label,type:'enum',values,required:true});
const project=()=>({...ref('Công trình','projects',false),requiresFeature:'projects'});
const def=(label,fields,mode='document',extra={})=>({label,feature:'people',mode,operationDomain:true,misaDomain:true,attendanceDomain:true,...(mode==='document'?{requiresApproval:true,calculable:true}:{}),...extra,fields});
const definitions={
 shifts:def('Ca làm việc',{starts_time:time('Giờ bắt đầu'),ends_time:time('Giờ kết thúc'),cross_midnight:choice('Qua ngày',{no:'Trong ngày',yes:'Qua ngày tiếp theo'}),break_minutes:number('Thời gian nghỉ · phút',0,1439,{integer:true}),day_rule:choice('Ngày công',{start_day:'Ngày bắt đầu ca',end_day:'Ngày kết thúc ca'}),overtime_multiplier:number('Hệ số làm thêm theo thỏa thuận',0,10,{default:1})},'master'),
 shift_assignments:def('Phân ca nhân viên',{staff_id:ref('Nhân viên','staff'),shift_id:ref('Ca làm việc','shifts'),project_id:project(),starts_on:date('Ngày bắt đầu ca'),document_date:date('Ngày phân ca'),work_date:{...date('Ngày công',false),computed:true},starts_at:{...text('Ca bắt đầu',false,50),computed:true},ends_at:{...text('Ca kết thúc',false,50),computed:true},regular_hours:{...number('Giờ làm theo ca',0,24),computed:true}}),
 leave_entitlements:def('Hạn mức nghỉ phép',{staff_id:ref('Nhân viên','staff'),starts_on:date('Hiệu lực từ'),ends_on:date('Hiệu lực đến'),allowed_hours:number('Giờ phép được cấp',0,10000),carry_hours:number('Giờ chuyển tiếp',0,10000)},'master'),
 leave_requests:def('Đơn nghỉ phép',{staff_id:ref('Nhân viên','staff'),leave_type:choice('Loại nghỉ',{paid:'Nghỉ hưởng lương',unpaid:'Nghỉ không hưởng lương'}),entitlement_id:ref('Hạn mức phép','leave_entitlements',false),document_date:date('Ngày đề nghị'),reason:text('Lý do nghỉ',true,1000),total_hours:{...number('Tổng giờ nghỉ',0,10000),computed:true}},'document',{lineKind:'leave_request_lines'}),
 leave_request_lines:def('Ngày nghỉ phép',{request_id:ref('Đơn nghỉ','leave_requests'),work_date:date('Ngày nghỉ'),hours:number('Giờ nghỉ',0.0001,24)},'master',{parentKind:'leave_requests',parentField:'request_id'}),
 overtime_requests:def('Đề nghị làm thêm',{assignment_id:ref('Phân ca','shift_assignments'),staff_id:ref('Nhân viên','staff'),project_id:project(),work_date:date('Ngày công'),hours:number('Giờ làm thêm đề nghị',0.0001,24),document_date:date('Ngày đề nghị'),reason:text('Lý do làm thêm',true,1000)}),
 attendance_confirmations:def('Xác nhận giờ công theo ca',{assignment_id:ref('Phân ca','shift_assignments'),staff_id:ref('Nhân viên','staff'),project_id:project(),check_in_time:time('Giờ vào ca'),check_out_time:time('Giờ ra ca'),checkout_day_offset:choice('Ngày ra ca',{'0':'Cùng ngày bắt đầu','1':'Ngày tiếp theo'}),document_date:date('Ngày xác nhận'),evidence:text('Nhật ký / nguồn xác nhận',true,1000),worked_hours:{...number('Giờ công thường',0,24),computed:true},overtime_hours:{...number('Giờ làm thêm',0,24),computed:true},timecard_id:{...ref('Phiếu công phát sinh','timecards',false),computed:true}}),
 attendance_locks:def('Khóa kỳ chấm công',{starts_on:date('Từ ngày'),ends_on:date('Đến ngày'),department:text('Phòng ban',false,100),project_id:project(),document_date:date('Ngày khóa'),reason:text('Lý do khóa',true,1000)})
};
const entities=JSON.parse(await readFile('src/config/businessEntities.json','utf8'));for(const[k,d]of Object.entries(definitions))entities[k]=d;
entities.timecards.fields.confirmation_id={...ref('Nguồn xác nhận ca','attendance_confirmations',false),computed:true};
await writeFile('src/config/businessEntities.json',JSON.stringify(entities,null,2)+'\n');
const lit=v=>`'${String(v).replaceAll("'","''")}'`,table=k=>k==='partners'?'business_tenant_partners':`business_${k}`;
const sql=['-- Configured shifts, leave, overtime and approved attendance; no statutory rates are embedded.'];
for(const[k,d]of Object.entries(definitions)){
 const fields=Object.entries(d.fields).map(([key,f])=>`${key} ${f.type==='ref'?'uuid':f.type==='date'?'date':f.type==='time'?'time without time zone':f.type==='number'?(f.integer?'integer':'numeric(24,4)'):'text'}${f.required||f.default!==undefined?' not null':''}${f.default!==undefined?` default ${lit(f.default)}`:''}${f.type==='number'?` check(${key} between ${f.min??0} and ${f.max??1e15})`:''}${f.type==='enum'?` check(${key} in (${Object.keys(f.values).map(lit).join(',')}))`:''}${f.type==='text'?` check(char_length(${key})<=${f.max??240}${f.required?` and char_length(btrim(${key}))>0`:''})`:''}`);
 sql.push(`insert into public.business_entity_definitions values(${lit(k)},${lit(JSON.stringify(d))}::jsonb);
create table public.${table(k)}(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.business_tenants(id),code text not null check(char_length(code) between 1 and 50),name text not null check(char_length(name) between 2 and 180),notes text not null default '' check(char_length(notes)<=2000),status text not null default ${lit(d.mode==='master'?'active':'draft')} check(status in (${(d.mode==='master'?['active','inactive']:['draft','posted','cancelled']).map(lit).join(',')})),row_version integer not null default 1,created_by uuid not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),reviewed_by uuid,calculation_snapshot jsonb,posted_journal_id uuid,reversed_journal_id uuid,unique(tenant_id,id),foreign key(tenant_id,created_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,reviewed_by) references public.business_accounts(tenant_id,id),foreign key(tenant_id,posted_journal_id) references public.business_journal_entries(tenant_id,id),foreign key(tenant_id,reversed_journal_id) references public.business_journal_entries(tenant_id,id),${fields.join(',')});
create unique index ${table(k)}_code_idx on public.${table(k)}(tenant_id,lower(code));create index ${table(k)}_tenant_date_idx on public.${table(k)}(tenant_id,updated_at desc,id);alter table public.${table(k)} enable row level security;revoke all on public.${table(k)} from public,anon,authenticated,service_role;`);
}
for(const[k,d]of Object.entries(definitions))for(const[key,f]of Object.entries(d.fields))if(f.type==='ref')sql.push(`alter table public.${table(k)} add foreign key(tenant_id,${key}) references public.${table(f.ref)}(tenant_id,id);`);
sql.push(`alter table public.business_timecards add column confirmation_id uuid,add foreign key(tenant_id,confirmation_id) references public.business_attendance_confirmations(tenant_id,id);
create unique index business_confirmation_assignment on public.business_attendance_confirmations(tenant_id,assignment_id) where status<>'cancelled';
create unique index business_confirmed_timecard on public.business_timecards(tenant_id,confirmation_id) where confirmation_id is not null;
create unique index business_leave_request_day on public.business_leave_request_lines(tenant_id,request_id,work_date);
create index business_shift_staff_date on public.business_shift_assignments(tenant_id,staff_id,work_date,status);
create index business_leave_lines_date on public.business_leave_request_lines(tenant_id,work_date);
update public.business_entity_definitions set definition=${lit(JSON.stringify(entities.timecards))}::jsonb where kind='timecards';`);
await writeFile('supabase/migrations/202610240029_business_attendance_entities.sql',sql.join('\n\n')+'\n');
console.log(JSON.stringify({attendance:Object.keys(definitions).length,totalEntities:Object.keys(entities).length}));
