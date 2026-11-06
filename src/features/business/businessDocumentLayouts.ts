import {businessEntities,type EntityKind} from "./businessCatalog";
import {recordFormGroups,type RecordFieldEntry} from "./businessPresentation";
type Group={key:string;label:string;keys:string[]};
const layouts:Partial<Record<EntityKind,Group[]>>={
 purchase_orders:[{key:"purchase",label:"Đối tác & lịch nhận",keys:["partner_id","order_date","expected_on","project_id"]},{key:"source",label:"Chứng từ nguồn",keys:["procurement_award_id"]}],
 sales_orders:[{key:"sale",label:"Khách hàng & thanh toán",keys:["partner_id","order_date","due_date"]}],
 purchase_receipts:[{key:"receipt",label:"Hàng nhận & kho",keys:["purchase_order_id","item_id","warehouse_id","lot_id","document_date"]},{key:"quantity",label:"Số lượng & giá nhập",keys:["entry_unit","entry_quantity","entry_price","quantity","unit_cost","base_unit","unit_factor"]}],
 stock_moves:[{key:"stock",label:"Kho & vật tư",keys:["direction","document_date","warehouse_id","item_id","lot_id","sales_order_id"]},{key:"quantity",label:"Số lượng & đơn giá",keys:["entry_unit","entry_quantity","entry_price","quantity","unit_cost","base_unit","unit_factor"]}],
 vendor_invoices:[{key:"invoice",label:"Hóa đơn nhà cung cấp",keys:["partner_id","invoice_number","purchase_order_id","document_date","posting_date","due_date"]},{key:"amount",label:"Giá trị & thuế",keys:["base_amount","tax_amount","tax_account_id"]},{key:"accounts",label:"Hạch toán",keys:["expense_account_id","payable_account_id"]}],
 sales_invoices:[{key:"invoice",label:"Hóa đơn khách hàng",keys:["partner_id","invoice_number","sales_order_id","document_date","posting_date","due_date"]},{key:"amount",label:"Giá trị & thuế",keys:["base_amount","tax_amount","tax_account_id"]},{key:"accounts",label:"Hạch toán",keys:["revenue_account_id","receivable_account_id"]}],
 cash_vouchers:[{key:"voucher",label:"Nội dung thu chi",keys:["direction","partner_id","amount","document_date","posting_date","project_id"]},{key:"accounts",label:"Hạch toán",keys:["cash_account_id","counter_account_id"]}],
 work_orders:[{key:"production",label:"Kế hoạch sản xuất",keys:["item_id","quantity","due_date"]},{key:"standard",label:"Định mức & nguồn lực",keys:["bom_id","mold_id"]}],
 boms:[{key:"standard",label:"Định mức thành phẩm",keys:["item_id","output_quantity","revision"]}],
 salary_runs:[{key:"period",label:"Kỳ lương & ngày công",keys:["starts_on","ends_on","posting_date","standard_days","standard_hours"]},{key:"accounts",label:"Hạch toán lương",keys:["expense_account_id","payable_account_id","deduction_account_id"]}]
};
export function businessDocumentGroups(kind:EntityKind,entries:RecordFieldEntry[]){
 const profile=layouts[kind];if(!profile)return recordFormGroups(entries);
 const assigned=new Set(profile.flatMap(group=>group.keys));
 return [...profile.map(group=>({key:group.key,label:group.label,fields:group.keys.flatMap(key=>entries.filter(([field])=>field===key))})),{key:"additional",label:"Thông tin bổ sung",fields:entries.filter(([key])=>!assigned.has(key))}].filter(group=>group.fields.length);
}
export function businessRecordNameLabel(kind:EntityKind){return businessEntities[kind].mode==="master"&&!businessEntities[kind].parentKind?"Tên":"Diễn giải";}
export function businessWideField(key:string){return ["partner_id","purchase_order_id","sales_order_id","project_id"].includes(key);}
