import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
export async function populateBusinessOperations(connection,{capture}={}){
 const db={connectionParameters:connection.connectionParameters,async query(sql,values){const result=await connection.query(sql,values);if(/^(select public\.business_(save_record|record_action|access_update)|insert into public\.business_sessions|update public\.business_sessions)/.test(sql))capture?.query(sql,values);return result;}};
 if(db.connectionParameters.host!=='127.0.0.1')throw Error('Operations population requires the temporary local database');
 const entities=JSON.parse(await readFile('src/config/businessEntities.json','utf8')),companies=JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8'));
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 for(const company of companies){
  const t=(await db.query('select * from public.business_tenants where slug=$1 and is_demo',[company.slug])).rows[0];if(!t)continue;
  const actors=(await db.query('select id,role,credential_version from public.business_accounts where tenant_id=$1',[t.id])).rows;
  const owner=actors.find(a=>a.role==='owner'),reviewer=actors.find(a=>a.role==='editor'),hash=randomBytes(32).toString('hex'),reviewHash=randomBytes(32).toString('hex');
  await db.query('begin');
  try{
   for(const[token,a]of[[hash,owner],[reviewHash,reviewer]])await db.query('insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values($1,$2,$3,$4,now()+interval \'1 hour\')',[token,t.id,a.id,a.credential_version]);
   let sequence=0;
   async function rec(kind,name,values){const id=randomUUID(),data={code:`VH-2610-${String(++sequence).padStart(4,'0')}`,name,notes:''};for(const[k,f]of Object.entries(entities[kind].fields))if(!f.computed)data[k]=values[k]??f.default??null;try{await db.query('select public.business_save_record($1,$2,$3,$4,0,$5,$6,$7)',[hash,company.slug,kind,id,data,randomUUID(),digest(data)]);}catch(e){e.message=`${company.slug} / ${kind} / save: ${e.message}`;throw e;}return id;}
   async function act(kind,id,action){const version=(await db.query(`select row_version from public.business_${kind} where tenant_id=$1 and id=$2`,[t.id,id])).rows[0].row_version;try{await db.query('select public.business_record_action($1,$2,$3,$4,$5,$6,$7,$8,$9)',[action==='approve'?reviewHash:hash,company.slug,kind,id,version,action,'Xác nhận hồ sơ vận hành',randomUUID(),digest({id,version,action})]);}catch(e){e.message=`${company.slug} / ${kind} / ${action}: ${e.message}`;throw e;}}
   async function post(kind,id){if(entities[kind].calculable)await act(kind,id,'calculate');if(entities[kind].requiresApproval)await act(kind,id,'approve');await act(kind,id,'post');return id;}
   const project=(await db.query('select * from public.business_projects where tenant_id=$1 order by code limit 1',[t.id])).rows[0];let wbs=null;
   if(project){
    wbs=await rec('project_wbs','Hạng mục kết cấu & hoàn thiện',{project_id:project.id,parent_id:null,unit:'m²',contract_quantity:100,contract_unit_price:1000000,starts_on:project.starts_on.toISOString?.().slice(0,10)??project.starts_on,ends_on:project.ends_on.toISOString?.().slice(0,10)??project.ends_on,cost_code:'KET-CAU'});
    const baseline=await rec('budget_versions','Ngân sách triển khai lần đầu',{project_id:project.id,revision:1,previous_id:null,change_reason:'Chốt dự toán theo phạm vi thi công ban đầu',document_date:'2026-10-20'});
    await rec('budget_lines','Dự toán hạng mục kết cấu',{budget_id:baseline,wbs_id:wbs,category:'material',amount:Number(project.budget)});await post('budget_versions',baseline);
    const revised=await rec('budget_versions','Bổ sung dự toán hạng mục kết cấu',{project_id:project.id,revision:2,previous_id:baseline,change_reason:'Bổ sung phạm vi thi công đã được thống nhất',document_date:'2026-10-21'});
    await rec('budget_lines','Dự toán kết cấu sau bổ sung',{budget_id:revised,wbs_id:wbs,category:'material',amount:Number(project.budget)+5000000});await post('budget_versions',revised);
    await post('budget_exceptions',await rec('budget_exceptions','Hạn mức dự phòng điều kiện hiện trường',{project_id:project.id,budget_id:revised,amount:1000000,document_date:'2026-10-21',reason:'Dự phòng phát sinh vận chuyển trong điều kiện mặt bằng hạn chế'}));
    await post('project_variations',await rec('project_variations','Phụ lục bổ sung khối lượng kết cấu',{project_id:project.id,wbs_id:wbs,new_quantity:120,new_unit_price:1000000,document_date:'2026-10-21',evidence:'Phụ lục khối lượng được chủ đầu tư xác nhận'}));
    const acceptance=await post('project_acceptances',await rec('project_acceptances','Nghiệm thu khối lượng hoàn thành đợt một',{project_id:project.id,wbs_id:wbs,quantity:25,unit_price:1000000,document_date:'2026-10-22',customer_approved_on:'2026-10-22',evidence:'Biên bản khối lượng đợt một có xác nhận hai bên'}));
    const invoice=(await db.query('select * from public.business_sales_invoices where tenant_id=$1 and status=\'posted\' order by code limit 1',[t.id])).rows[0];if(invoice)await post('acceptance_billings',await rec('acceptance_billings','Đối chiếu hóa đơn với nghiệm thu đợt một',{project_id:project.id,acceptance_id:acceptance,sales_invoice_id:invoice.id,amount:Math.min(Number(invoice.base_amount)/2,25000000),document_date:'2026-10-23'}));
    await post('project_lifecycle_events',await rec('project_lifecycle_events','Tạm dừng theo lịch bàn giao mặt bằng',{project_id:project.id,next_state:'paused',document_date:'2026-10-23',reason:'Chờ chủ đầu tư bàn giao khu vực thi công tiếp theo'}));
    await post('project_lifecycle_events',await rec('project_lifecycle_events','Tiếp tục thi công sau bàn giao mặt bằng',{project_id:project.id,next_state:'active',document_date:'2026-10-24',reason:'Đã nhận bàn giao mặt bằng và xác nhận đủ điều kiện thi công'}));
    const issue=(await db.query('select * from public.business_project_materials where tenant_id=$1 and status=\'posted\' order by code limit 1',[t.id])).rows[0];if(issue)await post('project_material_returns',await rec('project_material_returns','Hoàn trả vật tư chưa sử dụng về kho',{project_id:issue.project_id,material_issue_id:issue.id,quantity:Math.max(0.0001,Math.floor(Number(issue.quantity)*0.2*10000)/10000),document_date:'2026-10-24',evidence:'Biên bản đối chiếu vật tư còn nguyên chưa đưa vào sử dụng'}));
   }
   const raw=(await db.query(`select i.*,m.warehouse_id,m.lot_id,sum(case m.direction when 'in' then m.quantity else -m.quantity end) balance from public.business_items i join public.business_stock_moves m on m.tenant_id=i.tenant_id and m.item_id=i.id and m.status='posted' left join public.business_lots l on l.tenant_id=m.tenant_id and l.id=m.lot_id where i.tenant_id=$1 and not exists(select 1 from public.business_work_orders where tenant_id=i.tenant_id and item_id=i.id) and (l.id is null or l.quality_state='released') group by i.id,m.warehouse_id,m.lot_id having sum(case m.direction when 'in' then m.quantity else -m.quantity end)>20 order by i.code limit 1`,[t.id])).rows[0];
   if(!raw)throw Error(`No stocked material for ${company.slug}`);
   const to=(await db.query('select id from public.business_warehouses where tenant_id=$1 and id<>$2 order by code limit 1',[t.id,raw.warehouse_id])).rows[0].id;
   await post('stock_transfers',await rec('stock_transfers',`Điều chuyển ${raw.name} sang kho phụ`,{item_id:raw.id,lot_id:raw.lot_id,from_warehouse_id:raw.warehouse_id,to_warehouse_id:to,quantity:5,document_date:'2026-10-21'}));
   const inventory=(await db.query('select id from public.business_gl_accounts where tenant_id=$1 and code=$2',[t.id,company.industry==='trading'?'156':'152'])).rows[0].id,expense=(await db.query('select id from public.business_gl_accounts where tenant_id=$1 and code=\'642\'',[t.id])).rows[0].id;
   const count=await rec('stock_counts','Kiểm kê vật tư tại kho phụ',{warehouse_id:to,document_date:'2026-10-22',inventory_account_id:inventory,difference_account_id:expense});
   await rec('stock_count_lines',`Đối chiếu thực đếm ${raw.name}`,{count_id:count,item_id:raw.id,lot_id:raw.lot_id,counted_quantity:4,gain_unit_cost:Number(raw.standard_cost)});await post('stock_counts',count);
   const request=await rec('procurement_requests','Đề nghị bổ sung vật tư phục vụ vận hành',{project_id:project?.id??null,needed_on:'2026-10-30',document_date:'2026-10-21',requester_id:null});
   const requested=await rec('procurement_request_lines',`Bổ sung ${raw.name}`,{request_id:request,item_id:raw.id,wbs_id:wbs,quantity:100,estimated_price:Number(raw.standard_cost)});
   const removed=await rec('procurement_request_lines','Vật tư bổ sung được loại khỏi đề nghị sau đối chiếu tồn',{request_id:request,item_id:raw.id,wbs_id:wbs,quantity:10,estimated_price:Number(raw.standard_cost)});await act('procurement_request_lines',removed,'deactivate');await post('procurement_requests',request);
   const suppliers=(await db.query('select id,name from public.business_tenant_partners where tenant_id=$1 and partner_type in (\'supplier\',\'both\') order by code limit 2',[t.id])).rows;let selectedQuote,selectedLine;
   for(const[index,supplier]of suppliers.entries()){
    const quote=await rec('supplier_quotes',`Báo giá vật tư · ${supplier.name}`,{request_id:request,partner_id:supplier.id,quote_number:`BG-THANG10-${index+1}`,document_date:'2026-10-21',valid_until:'2026-10-31',delivery_on:'2026-10-28',payment_terms:'Thanh toán sau giao hàng 30 ngày'});
    const line=await rec('supplier_quote_lines',`Giá chào ${raw.name}`,{quote_id:quote,request_line_id:requested,quantity:100,unit_price:Math.round(Number(raw.standard_cost)*(index===0?0.98:0.96)*10000)/10000});await post('supplier_quotes',quote);if(index===1){selectedQuote=quote;selectedLine=line;}
   }
   const awards=[];for(const[index,quantity]of[60,40].entries()){
    const award=await rec('procurement_awards',`Đặt mua vật tư đợt ${index+1}`,{quote_id:selectedQuote,document_date:`2026-10-${23+index}`,selection_reason:'Đáp ứng thời hạn giao hàng, điều kiện thanh toán và đơn giá phù hợp'});
    await rec('procurement_award_lines',`Đặt ${quantity} ${raw.unit} ${raw.name}`,{award_id:award,quote_line_id:selectedLine,quantity});await post('procurement_awards',award);awards.push(award);
   }
   const po=(await db.query('select purchase_order_id from public.business_procurement_awards where tenant_id=$1 and id=$2',[t.id,awards[0]])).rows[0].purchase_order_id;
   capture?.reference(po,`(select purchase_order_id from public.business_procurement_awards where tenant_id='${t.id}'::uuid and id='${awards[0]}'::uuid)`);
   const line=(await db.query('select unit_price from public.business_purchase_lines where tenant_id=$1 and purchase_order_id=$2',[t.id,po])).rows[0];
   await post('purchase_receipts',await rec('purchase_receipts',`Nhận một phần ${raw.name} đợt một`,{purchase_order_id:po,item_id:raw.id,warehouse_id:raw.warehouse_id,lot_id:raw.lot_id,quantity:30,unit_cost:Number(line.unit_price),document_date:'2026-10-24'}));
   await db.query('update public.business_sessions set revoked_at=now() where token_hash=any($1::text[])',[[hash,reviewHash]]);await db.query('commit');
   console.log(JSON.stringify({operationsExperience:company.industry,transfer:true,count:true,request:true,quotes:suppliers.length,orders:awards.length,partialReceipt:true,project:!!project}));
  }catch(e){await db.query('rollback');throw e;}
 }
}
