import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
export async function populateBusinessAttendance(connection,{capture}={}){
 const db={connectionParameters:connection.connectionParameters,async query(sql,values){const result=await connection.query(sql,values);if(/^(select public\.business_(save_record|record_action|access_update)|insert into public\.business_sessions|update public\.business_sessions)/.test(sql))capture?.query(sql,values);return result;}};
 if(db.connectionParameters.host!=='127.0.0.1')throw Error('Attendance population requires the temporary local database');
 const entities=JSON.parse(await readFile('src/config/businessEntities.json','utf8')),companies=JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8'));
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 for(const company of companies){
  const t=(await db.query('select * from public.business_tenants where slug=$1 and is_demo',[company.slug])).rows[0];if(!t)continue;
  const actors=(await db.query('select id,role,credential_version from public.business_accounts where tenant_id=$1',[t.id])).rows,owner=actors.find(a=>a.role==='owner'),reviewer=actors.find(a=>a.role==='editor'),hash=randomBytes(32).toString('hex'),reviewHash=randomBytes(32).toString('hex');
  await db.query('begin');try{
   for(const[token,a]of[[hash,owner],[reviewHash,reviewer]])await db.query('insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values($1,$2,$3,$4,now()+interval \'1 hour\')',[token,t.id,a.id,a.credential_version]);
   let seq=0;
   async function rec(kind,name,values){const id=randomUUID(),data={code:`NS-2610-${String(++seq).padStart(4,'0')}`,name,notes:''};for(const[k,f]of Object.entries(entities[kind].fields))if(!f.computed)data[k]=values[k]??f.default??null;try{await db.query('select public.business_save_record($1,$2,$3,$4,0,$5,$6,$7)',[hash,company.slug,kind,id,data,randomUUID(),digest(data)]);}catch(e){e.message=`${company.slug} / ${kind} / save: ${e.message}`;throw e;}return id;}
   async function act(kind,id,action){const version=(await db.query(`select row_version from public.business_${kind} where tenant_id=$1 and id=$2`,[t.id,id])).rows[0].row_version;try{await db.query('select public.business_record_action($1,$2,$3,$4,$5,$6,$7,$8,$9)',[action==='approve'?reviewHash:hash,company.slug,kind,id,version,action,'Xác nhận hồ sơ công đã đối chiếu',randomUUID(),digest({id,version,action})]);}catch(e){e.message=`${company.slug} / ${kind} / ${action}: ${e.message}`;throw e;}}
   async function post(kind,id){await act(kind,id,'calculate');await act(kind,id,'approve');await act(kind,id,'post');return id;}
   const person=(await db.query('select * from public.business_staff where tenant_id=$1 order by code desc limit 1',[t.id])).rows[0],project=(await db.query('select id from public.business_projects where tenant_id=$1 order by code limit 1',[t.id])).rows[0]?.id??null;
   const day=await rec('shifts','Ca ngày 08:00–17:00',{starts_time:'08:00',ends_time:'17:00',cross_midnight:'no',break_minutes:60,day_rule:'start_day',overtime_multiplier:1.5});
   const night=await rec('shifts','Ca đêm 20:00–05:00',{starts_time:'20:00',ends_time:'05:00',cross_midnight:'yes',break_minutes:60,day_rule:'start_day',overtime_multiplier:1.5});
   await post('shift_assignments',await rec('shift_assignments',`Phân ca ngày 17/10 · ${person.name}`,{staff_id:person.id,shift_id:day,project_id:project,starts_on:'2026-10-17',document_date:'2026-10-16'}));
   const entitlement=await rec('leave_entitlements',`Hạn mức phép theo thỏa thuận · ${person.name}`,{staff_id:person.id,starts_on:'2026-10-01',ends_on:'2026-12-31',allowed_hours:80,carry_hours:0});
   const leave=await rec('leave_requests',`Nghỉ việc gia đình ngày 17/10 · ${person.name}`,{staff_id:person.id,leave_type:'paid',entitlement_id:entitlement,document_date:'2026-10-16',reason:'Giải quyết công việc gia đình theo lịch đã thống nhất'});
   await rec('leave_request_lines',`Nghỉ ca ngày 17/10 · ${person.name}`,{request_id:leave,work_date:'2026-10-17',hours:8});await post('leave_requests',leave);
   const assignment=await post('shift_assignments',await rec('shift_assignments',`Phân ca đêm 18/10 · ${person.name}`,{staff_id:person.id,shift_id:night,project_id:project,starts_on:'2026-10-18',document_date:'2026-10-18'}));
   await post('overtime_requests',await rec('overtime_requests',`Làm thêm hoàn tất bàn giao ca · ${person.name}`,{assignment_id:assignment,staff_id:person.id,project_id:project,work_date:'2026-10-18',hours:2,document_date:'2026-10-18',reason:'Hoàn tất công việc và đối chiếu bàn giao trước ca tiếp theo'}));
   const confirmation=await post('attendance_confirmations',await rec('attendance_confirmations',`Xác nhận ca đêm 18–19/10 · ${person.name}`,{assignment_id:assignment,staff_id:person.id,project_id:project,check_in_time:'20:00',check_out_time:'07:00',checkout_day_offset:'1',document_date:'2026-10-19',evidence:'Nhật ký vào ra và biên bản bàn giao được trưởng ca xác nhận'}));
   await post('attendance_locks',await rec('attendance_locks','Khóa công đã đối chiếu ngày 17–18/10',{starts_on:'2026-10-17',ends_on:'2026-10-18',department:person.department,project_id:project,document_date:'2026-10-20',reason:'Chốt công, nghỉ phép và tăng ca trước khi lập bảng lương'}));
   const card=(await db.query('select t.work_date::text work_date,t.worked_hours,t.overtime_hours from public.business_attendance_confirmations c join public.business_timecards t on t.tenant_id=c.tenant_id and t.id=c.timecard_id where c.tenant_id=$1 and c.id=$2',[t.id,confirmation])).rows[0];
   await db.query('update public.business_sessions set revoked_at=now() where token_hash=any($1::text[])',[[hash,reviewHash]]);await db.query('commit');console.log(JSON.stringify({attendanceExperience:company.industry,staff:person.name,nightCard:card,paidLeaveHours:8,attendanceLocked:true}));
  }catch(e){await db.query('rollback');throw e;}
 }
}
