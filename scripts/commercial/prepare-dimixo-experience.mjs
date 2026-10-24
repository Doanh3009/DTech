// Generates an additive development seed. Credentials stay in ignored .tmp files.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomBytes,scryptSync} from 'node:crypto';
const manifest=JSON.parse(await readFile('supabase/deployments/dtech-erp.json','utf8'));
if(manifest.projectRef!=='tcjjhxqtreemccdbvyza'||manifest.application.environment!=='development'||manifest.protectedExistingProjectRefs.includes(manifest.projectRef))throw Error('Development target mismatch');
const companies=JSON.parse(await readFile('src/config/businessDemoCompanies.json','utf8'));
const entities=JSON.parse(await readFile('src/config/businessEntities.json','utf8'));
const packs=JSON.parse(await readFile('src/config/businessIndustries.json','utf8'));
await mkdir('.tmp',{recursive:true});
let credentials;try{credentials=JSON.parse(await readFile('.tmp/dimixo-experience-credentials.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;credentials={};}
const literal=x=>x===null?'null':typeof x==='number'?String(x):typeof x==='boolean'?String(x):"'"+String(x).replaceAll("'","''")+"'";
const json=x=>literal(JSON.stringify(x))+'::jsonb';
const id=(slug,key)=>{const h=createHash('md5').update(`dimixo:experience:v1:${slug}:${key}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;};
const financeKinds=['journal_entries','cash_vouchers','vendor_invoices','sales_invoices','supplier_payments','salary_runs','payments'];
const text=[];const emit=s=>text.push(s);
emit(`begin;
set local statement_timeout='120s';
-- Fail before mutations if any existing record occupies a reserved experience address.
do $$ begin
 if current_database()<>'postgres' then raise exception 'Unexpected database';end if;
 if (select count(*) from public.business_entity_definitions)<>${Object.keys(entities).length} then raise exception 'Incomplete business schema';end if;
 if exists(select 1 from public.business_tenants where slug in (${companies.map(c=>literal(c.slug)).join(',')}) and not is_demo) then raise exception 'Reserved slug belongs to a real tenant';end if;
 if exists(select 1 from public.business_tenants where slug in (${companies.map(c=>literal(c.slug)).join(',')})) then raise exception 'Experience already exists; seed refuses to overwrite';end if;
end $$;
create function pg_temp.dimixo_put(h text,s text,k text,i uuid,d jsonb) returns void language plpgsql as $$ begin
 perform public.business_save_record(h,s,k,i,0,d,gen_random_uuid(),encode(sha256(convert_to(d::text,'UTF8')),'hex'));
exception when others then raise exception 'Creating % / %: %',k,d->>'name',sqlerrm;end $$;
create function pg_temp.dimixo_action(h text,s text,k text,i uuid,act text) returns void language plpgsql as $$ declare v integer;begin
 execute format('select row_version from public.%I where id=$1 and tenant_id=(select id from public.business_tenants where slug=$2)','business_'||k) into v using i,s;
 perform public.business_record_action(h,s,k,i,v,act,'Xác nhận chứng từ vận hành',gen_random_uuid(),encode(sha256(convert_to(i::text||act||v,'UTF8')),'hex'));
exception when others then raise exception 'Action % / % / %: %',k,i,act,sqlerrm;end $$;`);
const accountants=['Nguyễn Thị Lan','Lê Thảo Vy','Trần Ngọc Trâm','Nguyễn Bảo Châu','Phan Minh Thư','Trương Gia Hân'];
const people=['Đỗ Minh Đức','Nguyễn Thị Hồng','Phạm Quốc Bảo','Trần Thanh Tú','Lê Thu Trang','Hoàng Anh Dũng','Bùi Ngọc Mai','Vũ Tuấn Kiệt'];
const products=[
 [['Thép tấm SS400','kg',24000],['Thanh nhôm 6061','kg',78000],['Dung dịch tưới nguội','lít',42000],['Dao phay hợp kim D10','cái',320000],['Bu lông M12','cái',3500],['Tấm đế gá CNC','cái',185000],['Trục truyền động D25','cái',265000],['Bích nối thép DN50','cái',145000],['Gá kẹp chính xác','bộ',520000],['Bạc lót đồng','cái',85000]],
 [['Hạt nhựa PP nguyên sinh','kg',31000],['Hạt màu trắng','kg',58000],['Màng PE cuộn','kg',28000],['Mực in bao bì xanh','kg',165000],['Phụ gia chống tĩnh điện','kg',72000],['Hộp nhựa thực phẩm 750ml','cái',4200],['Nắp hộp PP 750ml','cái',1800],['Túi zipper 20 × 30','túi',2200],['Khay định hình 6 ngăn','cái',6500],['Màng bọc đóng gói','cuộn',58000]],
 [['Bo mạch PCB điều khiển','cái',85000],['Điện trở 10kΩ','cái',150],['Tụ điện 100µF','cái',1200],['Vi điều khiển STM32','cái',62000],['Đầu nối nguồn DC','cái',3500],['Bộ điều khiển đèn thông minh','bộ',285000],['Cảm biến nhiệt độ','bộ',145000],['Module truyền thông Wi-Fi','bộ',96000],['Bộ nguồn 12V 2A','bộ',88000],['Cáp kết nối tín hiệu','sợi',25000]],
 [['Yến mạch nguyên hạt','kg',42000],['Sữa tươi nguyên liệu','lít',22000],['Đường mía hữu cơ','kg',28000],['Hạt hạnh nhân','kg',180000],['Chai thủy tinh 250ml','chai',4500],['Sữa yến mạch 250ml','chai',18500],['Granola hạnh nhân 350g','hộp',68000],['Trà đào ít đường 330ml','chai',14000],['Nước ép cam 250ml','chai',22000],['Bánh ngũ cốc 200g','hộp',45000]],
 [['Nồi inox 3 đáy 24cm','cái',245000],['Bình giữ nhiệt 750ml','cái',135000],['Hộp thủy tinh 1 lít','bộ',85000],['Chảo chống dính 28cm','cái',175000],['Ấm siêu tốc 1.8 lít','cái',195000],['Bộ dao nhà bếp 5 món','bộ',225000],['Máy xay sinh tố 1.5 lít','cái',420000],['Kệ bếp hai tầng','cái',185000],['Cân điện tử nhà bếp','cái',95000],['Thùng rác inox 12 lít','cái',265000]],
 [['Xi măng PCB40','bao',82000],['Thép D16 CB400','kg',15800],['Gạch xây 8 × 8 × 18','viên',1250],['Cát vàng xây dựng','m³',320000],['Đá 1 × 2','m³',390000],['Ống nước PVC D90','mét',65000],['Dây điện CV 2.5','mét',13500],['Sơn nội thất trắng','thùng',1250000],['Ván phủ phim 18mm','tấm',465000],['Giàn giáo khung','bộ',720000]]
];
for(const [index,c] of companies.entries()){
 const uid=key=>id(c.slug,key);const qid=key=>literal(uid(key));
 if(!credentials[c.slug]){const password=`Dx!${randomBytes(12).toString('base64url')}8a`;const salt=randomBytes(16).toString('hex');credentials[c.slug]={password,passwordHash:`scrypt$65536$8$2$${salt}$${scryptSync(password,Buffer.from(salt,'hex'),64,{N:65536,r:8,p:2,maxmem:128*1024*1024}).toString('hex')}`,ownerHash:randomBytes(32).toString('hex'),reviewerHash:randomBytes(32).toString('hex')};}
 const cred=credentials[c.slug];const owner=literal(cred.ownerHash),reviewer=literal(cred.reviewerHash),slug=literal(c.slug);
 const profile={companyName:c.name,taxCode:'',companyType:'limited',industry:c.industry,companySize:'20_100',province:c.location,address:`${28+index*17} Nguyễn Văn Linh, ${c.location}`,website:'',branchCount:2,contactName:c.person,contactRole:'Giám đốc điều hành',email:`${c.username}@example.com`,phone:`09080010${String(index+10)}`,needs:packs[c.industry].focus,currentTools:'Bảng tính và chứng từ nội bộ',rolloutWindow:'now',ownerName:c.person,nextContactOn:'2026-10-26'};
 const setup={industryPreset:c.industry,enabledModules:['human_resources','attendance','warehouse','accounting',...(c.industry==='construction'?['projects']:[])],shortName:c.name.slice(0,30),systemName:'DIMIXO ERP',workflow:packs[c.industry].focus,deploymentId:'',projectRef:'',organizationId:'',baseUrl:'',region:'ap-southeast-1',environment:'staging',adminUsername:c.username,adminDisplayName:c.person,adminEmployeeCode:'',trialStartsOn:'2026-10-01',trialEndsOn:'2027-01-21',checks:{database:true,configuration:true,account:true,access:false,data:true}};
 // Shared tenants use the same document validation mode as crm_save_customer for provisioned tenants.
 emit(`select public.crm_validate_documents(${json(profile)},${json(setup)},'discovery');
 insert into public.crm_customers(id,profile,setup,stage) values(${qid('customer')},${json(profile)},${json(setup)},'active');
 insert into public.business_tenants(id,customer_id,slug,name,system_name,industry,features,status,trial_ends_at,is_demo) values(${qid('tenant')},${qid('customer')},${slug},${literal(c.name)},'DIMIXO ERP',${literal(c.industry)},${json(packs[c.industry].features)},'active',now()+interval '90 days',true);
 insert into public.business_accounts(id,tenant_id,username,display_name,password_hash,role,must_change_password) values(${qid('owner')},${qid('tenant')},${literal(c.username)},${literal(c.person)},${literal(cred.passwordHash)},'owner',false),(${qid('accountant')},${qid('tenant')},'ketoan',${literal(accountants[index])},${literal(cred.passwordHash)},'editor',false);
 insert into public.business_sessions(token_hash,tenant_id,account_id,credential_version,expires_at) values(${owner},${qid('tenant')},${qid('owner')},1,now()+interval '1 hour'),(${reviewer},${qid('tenant')},${qid('accountant')},1,now()+interval '1 hour');
 insert into public.crm_activities(id,customer_id,kind,note) values(gen_random_uuid(),${qid('customer')},'created','Đã đồng bộ không gian trải nghiệm ngành ${packs[c.industry].label} và tài khoản vận hành');`);
 function rec(kind,key,name,values={}){
  const d={code:key.toUpperCase().replaceAll('_','-'),name,notes:''};for(const [k,f] of Object.entries(entities[kind].fields))if(!f.computed)d[k]=values[k]??f.default??null;
  for(const k of Object.keys(values))if(!(k in d))throw Error(`Unknown ${kind}.${k}`);
  emit(`select pg_temp.dimixo_put(${owner},${slug},${literal(kind)},${qid(key)},${json(d)});`);return uid(key);
 }
 function act(kind,key,action='post',review=false){if(review)emit(`select pg_temp.dimixo_action(${reviewer},${slug},${literal(kind)},${qid(key)},'approve');`);emit(`select pg_temp.dimixo_action(${owner},${slug},${literal(kind)},${qid(key)},${literal(action)});`);}
 function doc(kind,key,name,values,post=true){const i=rec(kind,key,name,values);if(post&&entities[kind].mode==='document')act(kind,key,'post',financeKinds.includes(kind));return i;}
 const accounts=[['1111','Tiền mặt VND','debit'],['1121','Tiền gửi ngân hàng VND','debit'],['131','Phải thu khách hàng','both'],['1331','Thuế GTGT đầu vào','debit'],['152','Nguyên liệu, vật liệu','debit'],['154','Chi phí sản xuất dở dang','debit'],['155','Thành phẩm','debit'],['156','Hàng hóa','debit'],['211','Tài sản cố định hữu hình','debit'],['214','Hao mòn tài sản cố định','credit'],['242','Chi phí trả trước','debit'],['331','Phải trả nhà cung cấp','both'],['3331','Thuế GTGT đầu ra','credit'],['334','Phải trả người lao động','credit'],['338','Các khoản phải trả khác','credit'],['411','Vốn góp chủ sở hữu','credit'],['421','Lợi nhuận chưa phân phối','both'],['511','Doanh thu bán hàng','credit'],['632','Giá vốn hàng bán','debit'],['642','Chi phí quản lý','debit']];
 for(const [code,name,nature] of accounts)rec('gl_accounts',code,name,{nature});
 rec('accounting_periods','kt-1026','Kỳ kế toán tháng 10/2026',{starts_on:'2026-10-01',ends_on:'2026-10-31'});act('accounting_periods','kt-1026','release');
 rec('journal_entries','ct-1026-001','Số dư đầu kỳ tháng 10',{document_date:'2026-10-01',posting_date:'2026-10-01',period_id:uid('kt-1026'),document_type:'opening'});
 rec('journal_lines','dk-001','Tiền mặt đầu kỳ',{journal_id:uid('ct-1026-001'),account_id:uid('1111'),debit:180000000});
 rec('journal_lines','dk-002','Tiền gửi ngân hàng đầu kỳ',{journal_id:uid('ct-1026-001'),account_id:uid('1121'),debit:1800000000+index*100000000});
 rec('journal_lines','dk-003','Vốn góp đầu kỳ',{journal_id:uid('ct-1026-001'),account_id:uid('411'),credit:1980000000+index*100000000});act('journal_entries','ct-1026-001','post',true);
 const warehouse=rec('warehouses','kho-01',c.industry==='construction'?'Kho vật tư trung tâm':'Kho trung tâm',{address:profile.address});rec('warehouses','kho-02',c.industry==='trading'?'Kho chi nhánh Đà Nẵng':'Kho thành phẩm',{address:c.location});
 const partnerNames=['Minh Long','Bảo Minh','Hải Đăng','Ngọc Khánh','Gia Phúc','Tân Tiến','Đông Nam','Hòa Bình'];
 const partners=[];for(let j=0;j<8;j++)partners.push(rec('partners',`dt-${j+1}`,`Công ty ${j<3?'Cung ứng':'Thương mại'} ${partnerNames[(j+index)%8]}`,{partner_type:j<3?'supplier':'customer',phone:`090811${index}${String(j).padStart(3,'0')}`,email:`lienhe${j+1}@example.com`}));
 for(let j=0;j<4;j++)doc('interactions',`lh-${j+1}`,['Chốt lịch giao hàng tháng 10','Trao đổi bổ sung đơn hàng','Đối chiếu công nợ tháng 10','Hẹn giới thiệu sản phẩm mới'][j],{partner_id:partners[j+3],channel:['meeting','call','email','meeting'][j],next_contact_on:`2026-10-${25+j}`});
 const itemIds=[],lots=[];const hasLots=packs[c.industry].features.includes('quality')||packs[c.industry].features.includes('traceability');
 for(const [j,[name,unit,cost]] of products[index].entries()){
  itemIds.push(rec('items',`vt-${j+1}`,name,{unit,tracking:hasLots?'lot':'none',standard_cost:cost}));
  let lot=null;if(hasLots){lot=rec('lots',`lo-1026-${j+1}`,`Lô ${name} tháng 10`,{item_id:itemIds[j],manufactured_on:'2026-10-01',expires_on:c.industry==='food_beverage'?'2026-12-31':null});doc('quality_checks',`cl-${j+1}`,`Kiểm tra đầu vào ${name}`,{lot_id:lot,checked_quantity:1000,rejected_quantity:0,result:'passed',checked_on:'2026-10-02'});}lots.push(lot);
  // Finished product 6 is received through production below; no opening stock duplicated.
  if(j!==5||!packs[c.industry].features.includes('production'))doc('stock_moves',`nk-1026-${j+1}`,`Nhập đầu kỳ ${name}`,{item_id:itemIds[j],warehouse_id:warehouse,lot_id:lot,direction:'in',quantity:1000,unit_cost:cost,document_date:'2026-10-02'});
 }
 const openingInventory=products[index].reduce((n,p,j)=>n+((j!==5||!packs[c.industry].features.includes('production'))?1000*p[2]:0),0);
 rec('journal_entries','ct-1026-002','Giá trị tồn kho đầu kỳ',{document_date:'2026-10-02',posting_date:'2026-10-02',period_id:uid('kt-1026'),document_type:'opening'});
 rec('journal_lines','dk-004','Tồn kho đầu kỳ',{journal_id:uid('ct-1026-002'),account_id:uid(c.industry==='trading'?'156':'152'),debit:openingInventory});rec('journal_lines','dk-005','Vốn đầu kỳ hàng tồn kho',{journal_id:uid('ct-1026-002'),account_id:uid('411'),credit:openingInventory});act('journal_entries','ct-1026-002','post',true);
 if(packs[c.industry].features.includes('production')){
  const bom=rec('boms','dm-01',`Định mức ${products[index][5][0]}`,{item_id:itemIds[5],output_quantity:1,revision:'R02'});
  rec('bom_lines','dm-01-01','Nguyên liệu chính',{bom_id:bom,item_id:itemIds[0],quantity:1,waste_percent:3});rec('bom_lines','dm-01-02','Nguyên liệu phụ',{bom_id:bom,item_id:itemIds[1],quantity:.2,waste_percent:2});
  let mold=null;if(c.industry==='plastics_packaging')mold=rec('molds','khuon-750','Khuôn hộp thực phẩm 750ml',{item_id:itemIds[5],cavities:4,cycle_seconds:18});
  const centers=[];if(packs[c.industry].features.includes('mes'))for(let n=0;n<2;n++)centers.push(rec('work_centers',`tram-${n+1}`,[['Trung tâm CNC 01','Trạm hoàn thiện'],['Máy ép nhựa 180T','Trạm đóng gói'],['Dây chuyền SMT','Trạm kiểm thử chức năng']][Math.min(index,2)][n],{labor_rate:65000+n*10000,machine_rate:120000+n*20000}));
  for(let n=0;n<4;n++){
   const key=`lsx-1026-${n+1}`,quantity=100+n*20;const wo=rec('work_orders',key,`${products[index][5][0]} · Đợt ${n+1}`,{item_id:itemIds[5],bom_id:bom,mold_id:mold,quantity,due_date:`2026-10-${24+n}`});
   const ops=[];for(let o=0;o<centers.length;o++)ops.push(rec('operations',`cd-${n+1}-${o+1}`,o===0?'Gia công / lắp ráp':'Hoàn thiện / kiểm thử',{work_order_id:wo,work_center_id:centers[o],sequence:o+1,planned_hours:12+o*3}));
   if(n===3)continue;act('work_orders',key,'release');
   const good=n===2?60:quantity;
   doc('material_issues',`cx-${n+1}-1`,'Cấp nguyên liệu chính theo định mức',{work_order_id:wo,item_id:itemIds[0],warehouse_id:warehouse,lot_id:lots[0],quantity,unit_cost:products[index][0][2],document_date:'2026-10-07'});
   doc('material_issues',`cx-${n+1}-2`,'Cấp nguyên liệu phụ theo định mức',{work_order_id:wo,item_id:itemIds[1],warehouse_id:warehouse,lot_id:lots[1],quantity:quantity*.2,unit_cost:products[index][1][2],document_date:'2026-10-07'});
   if(ops.length)for(let o=0;o<ops.length;o++)doc('production_reports',`bc-${n+1}-${o+1}`,`Xác nhận ${o===0?'gia công':'kiểm thử'} đợt ${n+1}`,{work_order_id:wo,operation_id:ops[o],good_quantity:good,scrap_quantity:0,labor_hours:10+o,machine_hours:8+o,report_date:'2026-10-09'});
   else doc('production_reports',`bc-${n+1}`,'Xác nhận sản lượng mẻ',{work_order_id:wo,good_quantity:good,scrap_quantity:0,report_date:'2026-10-09'});
   doc('production_receipts',`ntp-${n+1}`,`Nhập ${products[index][5][0]} đợt ${n+1}`,{work_order_id:wo,warehouse_id:warehouse,lot_id:lots[5],quantity:good,unit_cost:products[index][5][2],document_date:'2026-10-10'});
   if(n<2)act('work_orders',key,'complete');
  }
 }
 for(let n=0;n<4;n++){
  const key=`dmh-1026-${n+1}`,qty=100+n*30,price=products[index][n][2];const po=rec('purchase_orders',key,`Đặt ${products[index][n][0]} bổ sung`,{partner_id:partners[n%3],order_date:'2026-10-04',expected_on:`2026-10-${15+n}`});rec('purchase_lines',`ctm-${n+1}`,'Chi tiết đặt hàng',{purchase_order_id:po,item_id:itemIds[n],quantity:qty,unit_price:price});if(n===3)continue;act('purchase_orders',key,'release');
  doc('purchase_receipts',`nmh-${n+1}`,`Nhận ${products[index][n][0]}`,{purchase_order_id:po,item_id:itemIds[n],warehouse_id:warehouse,lot_id:lots[n],quantity:n===2?qty/2:qty,unit_cost:price,document_date:'2026-10-12'});if(n<2)act('purchase_orders',key,'complete');
  const invoice=doc('vendor_invoices',`hdm-${n+1}`,`Mua ${products[index][n][0]}`,{partner_id:partners[n%3],invoice_number:`00010${index}${n+1}`,document_date:'2026-10-12',posting_date:'2026-10-12',due_date:n===0?'2026-10-20':'2026-11-12',base_amount:qty*price,tax_amount:0,purchase_order_id:po,expense_account_id:uid(c.industry==='trading'?'156':'152'),payable_account_id:uid('331')});
  if(n<2){const d={code:`UNC-1026-${n+1}`,name:'Chuyển khoản thanh toán nhà cung cấp',notes:'',payable_id:null,cash_account_id:uid('1121'),amount:qty*price*(n===0?.5:1),paid_on:'2026-10-15'};const paymentId=uid(`ttncc-${n+1}`);emit(`select pg_temp.dimixo_put(${owner},${slug},'supplier_payments',${literal(paymentId)},jsonb_set(${json(d)},'{payable_id}',to_jsonb((select id from public.business_payables where tenant_id=${qid('tenant')} and vendor_invoice_id=${literal(invoice)}))));`);act('supplier_payments',`ttncc-${n+1}`,'post',true);}
 }
 for(let n=0;n<5;n++){
  const key=`dbh-1026-${n+1}`,item=5+(n%4),qty=20+n*5,price=Math.round(products[index][item][2]*1.35);const order=rec('sales_orders',key,`Giao ${products[index][item][0]} cho ${partnerNames[(n+3+index)%8]}`,{partner_id:partners[3+n],order_date:'2026-10-11',due_date:n===0?'2026-10-20':`2026-10-${24+n}`});rec('sales_lines',`ctb-${n+1}`,'Chi tiết bán hàng',{sales_order_id:order,item_id:itemIds[item],quantity:qty,unit_price:price});if(n===4)continue;act('sales_orders',key,'release');
  const delivered=n===2?qty/2:qty;
  emit(`select public.business_deliver_sales_order(${owner},${slug},gen_random_uuid(),${literal(order)},(select row_version from public.business_sales_orders where tenant_id=${qid('tenant')} and id=${literal(order)}),'2026-10-16',${json([{itemId:itemIds[item],warehouseId:warehouse,lotId:lots[item],quantity:delivered,unitCost:products[index][item][2]}])});`);if(n<2||n===3)act('sales_orders',key,'complete');
  doc('sales_invoices',`hdb-${n+1}`,`Bán ${products[index][item][0]}`,{partner_id:partners[3+n],invoice_number:`00020${index}${n+1}`,document_date:'2026-10-16',posting_date:'2026-10-16',due_date:n===0?'2026-10-20':'2026-11-16',base_amount:qty*price,tax_amount:0,sales_order_id:order,revenue_account_id:uid('511'),receivable_account_id:uid('131')});
  if(n<2){const d={code:`PT-1026-${n+1}`,name:'Khách hàng chuyển khoản thanh toán',notes:'',receivable_id:null,cash_account_id:uid('1121'),amount:qty*price*(n===0?.5:1),paid_on:'2026-10-18'};emit(`select pg_temp.dimixo_put(${owner},${slug},'payments',${qid(`thu-${n+1}`)},jsonb_set(${json(d)},'{receivable_id}',to_jsonb((select id from public.business_receivables where tenant_id=${qid('tenant')} and sales_order_id=${literal(order)} and status='posted'))));`);act('payments',`thu-${n+1}`,'post',true);}
 }
 let project=null;if(c.industry==='construction'){
  const projectNames=['Nhà phố An Khánh','Văn phòng Phú Mỹ','Cải tạo biệt thự Thảo Điền'];
  for(let j=0;j<3;j++){const p=rec('projects',`ct-${j+1}`,projectNames[j],{budget:1200000000+j*450000000,starts_on:'2026-10-01',ends_on:'2027-03-31'});if(j===0)project=p;doc('project_materials',`vtct-${j+1}`,`Xuất vật tư ${projectNames[j]}`,{project_id:p,item_id:itemIds[j],warehouse_id:warehouse,quantity:100+j*20,unit_cost:products[index][j][2],document_date:'2026-10-17'});doc('project_costs',`cp-${j+1}`,`Nhân công ${projectNames[j]}`,{project_id:p,category:'labor',amount:45000000+j*8000000,occurred_on:'2026-10-18'});doc('project_updates',`td-${j+1}`,`Nghiệm thu tiến độ ${projectNames[j]}`,{project_id:p,completion_percent:25+j*15,reported_on:'2026-10-20'});}
 }
 const staff=[];for(let j=0;j<8;j++){staff.push(rec('staff',`nv-${j+1}`,j===0?c.person:j===1?accountants[index]:people[(j+index)%people.length],{department:j<2?'Văn phòng':c.industry==='construction'?'Đội thi công':c.industry==='trading'?'Kinh doanh & kho':'Sản xuất',position:j===0?'Giám đốc':j===1?'Kế toán tổng hợp':j===2?'Trưởng bộ phận':'Nhân viên',joined_on:'2025-03-03',base_salary:9000000+j*1500000,phone:`090822${index}${String(j).padStart(3,'0')}`}));for(let day=1;day<=16;day++){const date=`2026-10-${String(day).padStart(2,'0')}`;if([0,6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()))continue;doc('timecards',`cc-${j+1}-${day}`,`${j===0?c.person:j===1?accountants[index]:people[(j+index)%people.length]} · ${day}/10`,{staff_id:staff[j],work_date:date,worked_hours:8,overtime_hours:0,project_id:project});}}
 const salary=rec('salary_runs','bl-1026-01','Bảng lương kỳ 01–16/10',{starts_on:'2026-10-01',ends_on:'2026-10-16',posting_date:'2026-10-20',standard_days:26,expense_account_id:uid('642'),payable_account_id:uid('334'),deduction_account_id:uid('338')});for(let j=0;j<staff.length;j++)rec('salary_lines',`luong-${j+1}`,`Lương ${j===0?c.person:j===1?accountants[index]:people[(j+index)%people.length]}`,{salary_run_id:salary,staff_id:staff[j],base_salary:9000000+j*1500000,worked_days:12,allowances:350000,deductions:0});act('salary_runs','bl-1026-01','post',true);
 doc('cash_vouchers','pc-1026-01','Chi văn phòng phẩm tháng 10',{direction:'out',document_date:'2026-10-19',posting_date:'2026-10-19',cash_account_id:uid('1111'),counter_account_id:uid('642'),amount:2450000});
 doc('cash_vouchers','unc-1026-08','Chuyển khoản lương kỳ 01–16/10',{direction:'out',document_date:'2026-10-21',posting_date:'2026-10-21',cash_account_id:uid('1121'),counter_account_id:uid('334'),amount:staff.reduce((n,_,j)=>n+Math.round((9000000+j*1500000)*12/26+350000),0)});
 // Compile and calculate each read model with the same isolated session used by the UI.
 emit(`select public.business_financial_snapshot(${owner},${slug},'2026-10-01','2026-10-23');
 select public.business_operations_view(${owner},${slug},'purchasing');select public.business_operations_view(${owner},${slug},'people');
 update public.business_sessions set revoked_at=now() where token_hash in (${owner},${reviewer});`);
}
emit(`do $$ begin if exists(select 1 from public.business_journal_entries h left join public.business_journal_lines l on l.tenant_id=h.tenant_id and l.journal_id=h.id and l.status='active' where h.tenant_id in (select id from public.business_tenants where is_demo) and h.status='posted' group by h.id having coalesce(sum(l.debit),0)<>coalesce(sum(l.credit),0)) then raise exception 'Unbalanced experience journal';end if;end $$;
commit;`);
await writeFile('.tmp/dimixo-experience.sql',text.join('\n'));
await writeFile('.tmp/dimixo-experience-credentials.json',JSON.stringify(credentials,null,2));
await writeFile('.tmp/DIMIXO-tai-khoan-trai-nghiem.md','# Tài khoản trải nghiệm DIMIXO\n\nDữ liệu và tên người được dựng để mô phỏng vận hành, không phải giao dịch thật. Chỉ dùng cho môi trường phát triển trên máy này.\n\n'+companies.map((c,i)=>`## ${c.name}\n\n- Đăng nhập: http://localhost:3000/erp/${c.slug}/login\n- Quản lý: \`${c.username}\` · ${c.person}\n- Kế toán: \`ketoan\` · ${accountants[i]}\n- Mật khẩu của hai tài khoản: \`${credentials[c.slug].password}\`\n`).join('\n'));
console.log(JSON.stringify({target:manifest.projectRef,companies:companies.length,sqlStatements:text.length,credentialsFile:'.tmp/DIMIXO-tai-khoan-trai-nghiem.md',applied:false}));
