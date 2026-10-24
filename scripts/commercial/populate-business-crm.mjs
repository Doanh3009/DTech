import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
export async function populateBusinessCrm(connection,{capture}={}){
 if(connection.connectionParameters.host!=='127.0.0.1')throw Error('CRM population requires the temporary local database');
 const db={async query(sql,params){const r=await connection.query(sql,params);if(/^(select public\.business_(save_record|record_action|access_update|member_command)|insert into public\.business_sessions|update public\.business_sessions)/.test(sql))capture?.query(sql,params);return r;}};
 const entities=JSON.parse(await readFile('src/config/businessEntities.json','utf8')),companies=JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8'));
 const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 for(const[index,company]of companies.entries()){
  const tenant=(await db.query('select id from public.business_tenants where slug=$1 and is_demo',[company.slug])).rows[0];if(!tenant)continue;
  const actors=(await db.query('select id,role,credential_version from public.business_accounts where tenant_id=$1',[tenant.id])).rows;
  const owner=actors.find(a=>a.role==='owner'),reviewer=actors.find(a=>a.role==='editor');const hash=randomBytes(32).toString('hex'),reviewHash=randomBytes(32).toString('hex');
  await db.query('begin');
  try{
   for(const[token,a]of[[hash,owner],[reviewHash,reviewer]])await db.query('insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values($1,$2,$3,$4,now()+interval \'1 hour\')',[token,tenant.id,a.id,a.credential_version]);
   const access=(await db.query('select public.business_access_snapshot($1,$2) data',[hash,company.slug])).rows[0].data.accounts.find(a=>a.id===reviewer.id);
   const kinds=Object.entries(entities).filter(([,d])=>d.crmDomain&&(!d.requiresFeatures||d.requiresFeatures.every(f=>company.features?.includes(f)??true)));
   const existing=new Map(access.grants.map(g=>[g.kind,g]));for(const[k]of kinds)existing.set(k,{kind:k,actions:['read','report','approve'],scope:'tenant',project_ids:[],department:''});
   await db.query('select public.business_access_update($1,$2,$3,$4,true,$5,$6,$7,null,$8)',[hash,company.slug,reviewer.id,access.rowVersion,JSON.stringify([...existing.values()]),randomUUID(),digest([...existing.values()]),'Phân công duyệt báo giá, hợp đồng và chăm sóc khách hàng']);
   let seq=0;
   async function rec(kind,name,values){const id=randomUUID(),data={code:`KD-2610-${String(++seq).padStart(4,'0')}`,name,notes:''};for(const[k,f]of Object.entries(entities[kind].fields))if(!f.computed)data[k]=values[k]??f.default??null;try{await db.query('select public.business_save_record($1,$2,$3,$4,0,$5,$6,$7)',[hash,company.slug,kind,id,data,randomUUID(),digest(data)]);}catch(e){e.message=`${company.slug} / ${kind} / save: ${e.message}`;throw e;}return id;}
   async function act(kind,id,action){const version=(await db.query(`select row_version from public.business_${kind} where tenant_id=$1 and id=$2`,[tenant.id,id])).rows[0].row_version;try{await db.query('select public.business_record_action($1,$2,$3,$4,$5,$6,$7,$8,$9)',[action==='approve'?reviewHash:hash,company.slug,kind,id,version,action,'Xác nhận thông tin và chứng từ kinh doanh',randomUUID(),digest({id,version,action})]);}catch(e){e.message=`${company.slug} / ${kind} / ${action}: ${e.message}`;throw e;}}
   async function post(kind,id){await act(kind,id,'calculate');await act(kind,id,'approve');await act(kind,id,'post');return id;}
   const people=(await db.query('select id,name from public.business_staff where tenant_id=$1 and status=\'active\' order by code limit 2',[tenant.id])).rows;
   const customers=(await db.query('select id,name from public.business_tenant_partners where tenant_id=$1 and partner_type in (\'customer\',\'both\') and status=\'active\' order by code limit 2',[tenant.id])).rows;
   const item=(await db.query('select id,name,standard_cost from public.business_items where tenant_id=$1 and status=\'active\' order by code desc limit 1',[tenant.id])).rows[0];
   const campaign=await rec('campaigns','Kết nối khách hàng quý IV',{channel:'Hội nghị khách hàng & giới thiệu đối tác',starts_on:'2026-10-01',ends_on:'2026-12-31',budget:15000000,actual_spend:4500000+index*250000});
   const lead=await rec('leads',customers[0].name,{campaign_id:campaign,source:'Trao đổi trực tiếp tại hội nghị khách hàng',contact_name:['Nguyễn Bảo Ngọc','Trần Minh Đức','Lê Ngọc Mai','Phạm Đức Anh','Võ Lan Phương','Đặng Thanh Sơn'][index],phone:`09876${String(index).padStart(5,'0')}`,email:null,marketing_consent:'yes',owner_staff_id:people[0].id,next_contact_on:'2026-10-25'});
   await post('lead_events',await rec('lead_events','Xác nhận nhu cầu và kế hoạch đặt hàng',{lead_id:lead,next_stage:'qualified',document_date:'2026-10-20',evidence:'Khách hàng xác nhận loại hàng, ngân sách và tiến độ giao dự kiến'}));
   const conversion=await post('lead_conversions',await rec('lead_conversions','Bàn giao nhu cầu sang cơ hội kinh doanh',{lead_id:lead,existing_partner_id:customers[0].id,owner_staff_id:people[0].id,expected_amount:100*Number(item.standard_cost)*1.4,probability:70,expected_close_on:'2026-10-30',document_date:'2026-10-20'}));
   const opportunity=(await db.query('select opportunity_id from public.business_lead_conversions where tenant_id=$1 and id=$2',[tenant.id,conversion])).rows[0].opportunity_id;
   capture?.reference(opportunity,`(select opportunity_id from public.business_lead_conversions where tenant_id='${tenant.id}'::uuid and id='${conversion}'::uuid)`);
   const price=Math.max(1000,Math.round(Number(item.standard_cost)*1.4));
   const quote=await rec('customer_quotes','Báo giá cung ứng theo kế hoạch tháng 11',{opportunity_id:opportunity,partner_id:customers[0].id,revision:1,previous_id:null,document_date:'2026-10-20',valid_until:'2026-11-15',payment_terms:'Thanh toán trong 30 ngày từ ngày nhận đủ hàng'});
   await rec('customer_quote_lines',item.name,{quote_id:quote,item_id:item.id,quantity:100,unit_price:price,discount_percent:2});await post('customer_quotes',quote);
   await post('quote_decisions',await rec('quote_decisions','Khách hàng xác nhận phương án cung ứng',{quote_id:quote,decision:'accepted',document_date:'2026-10-21',evidence:'Thư xác nhận chấp nhận báo giá và lịch giao từng đợt'}));
   const contract=await post('sales_contracts',await rec('sales_contracts','Hợp đồng cung ứng và dịch vụ quý IV',{quote_id:quote,document_date:'2026-10-22',signed_on:'2026-10-22',starts_on:'2026-10-22',ends_on:'2026-12-31',evidence:'Hợp đồng hai bên xác nhận ngày 22/10, giá chưa bao gồm thuế GTGT'}));
   const line=(await db.query('select id from public.business_sales_contract_lines where tenant_id=$1 and contract_id=$2',[tenant.id,contract])).rows[0].id;
   capture?.reference(line,`(select id from public.business_sales_contract_lines where tenant_id='${tenant.id}'::uuid and contract_id='${contract}'::uuid limit 1)`);
   await post('contract_amendments',await rec('contract_amendments','Phụ lục bổ sung khối lượng cung ứng',{contract_line_id:line,new_quantity:120,new_unit_price:Math.round(price*0.98*10000)/10000,document_date:'2026-10-23',evidence:'Phụ lục bổ sung 20 đơn vị, giữ nguyên đơn giá đã thống nhất'}));
   for(const[n,quantity]of[30,20].entries()){
    const release=await rec('contract_order_releases',`Đặt hàng theo hợp đồng đợt ${n+1}`,{contract_id:contract,document_date:'2026-10-24',due_date:'2026-11-23'});
    await rec('contract_order_lines',`Cung ứng ${item.name} đợt ${n+1}`,{release_id:release,contract_line_id:line,quantity});await post('contract_order_releases',release);
   }
   await post('opportunity_events',await rec('opportunity_events','Chốt hợp đồng cung ứng quý IV',{opportunity_id:opportunity,next_stage:'won',document_date:'2026-10-24',reason:'Hợp đồng đã ký, khách hàng đã phát hành hai đợt đặt hàng'}));
   await rec('opportunities','Nhu cầu bổ sung cho kế hoạch cuối năm',{partner_id:customers[1]?.id??customers[0].id,owner_staff_id:people[1].id,expected_amount:price*80,probability:40,expected_close_on:'2026-11-10',next_contact_on:'2026-10-23'});
   await rec('leads','Nhu cầu từ đối tác giới thiệu',{campaign_id:campaign,source:'Giới thiệu từ khách hàng hiện hữu',contact_name:'Nguyễn Thảo Vy',phone:`09765${String(index).padStart(5,'0')}`,email:null,marketing_consent:'no',owner_staff_id:people[1].id,next_contact_on:'2026-10-27'});
   const ticket=await rec('support_tickets','Đối chiếu tài liệu và hướng dẫn sử dụng',{partner_id:customers[0].id,owner_staff_id:people[0].id,opened_on:'2026-10-20',response_due_on:'2026-10-21',resolve_due_on:'2026-10-23',priority:'normal',subject:'Khách hàng cần bổ sung tài liệu đi kèm và xác nhận quy cách đã giao'});
   for(const[event,date,evidence]of[['respond','2026-10-21','Đã phản hồi khách hàng và xác nhận bộ tài liệu cần bổ sung'],['resolve','2026-10-22','Đã bàn giao đầy đủ tài liệu, khách xác nhận nội dung chính xác'],['close','2026-10-23','Khách hàng đồng ý đóng yêu cầu sau đối chiếu']])await post('ticket_events',await rec('ticket_events',evidence,{ticket_id:ticket,event_type:event,responder_id:people[0].id,document_date:date,evidence}));
   const overdue=await rec('support_tickets','Xác minh yêu cầu điều chỉnh lịch cung ứng',{partner_id:customers[1]?.id??customers[0].id,owner_staff_id:people[1].id,opened_on:'2026-10-20',response_due_on:'2026-10-21',resolve_due_on:'2026-10-23',priority:'high',subject:'Đối chiếu phương án thay đổi lịch giao và nguồn hàng thay thế'});
   await post('ticket_events',await rec('ticket_events','Chuyển quản lý xử lý yêu cầu quá hạn',{ticket_id:overdue,event_type:'escalate',responder_id:people[0].id,document_date:'2026-10-24',evidence:'Quá hạn xác minh nguồn cung, chuyển quản lý kinh doanh phối hợp vận hành'}));
   await db.query('update public.business_sessions set revoked_at=now() where token_hash=any($1::text[])',[[hash,reviewHash]]);
   await db.query('commit');
   console.log(JSON.stringify({crmPopulation:company.industry,contracts:1,partialOrders:2,tickets:2}));
  }catch(e){await db.query('rollback');throw e;}
 }
}
