import workflows from "@/config/businessWorkflows.json";
import { businessEntities, type BusinessIndustry, type BusinessFeature, type EntityKind } from "./businessCatalog";

export const businessWorkflows = workflows;
export function industrySteps(industry: BusinessIndustry, features: readonly string[]) {
  return workflows[industry].steps.filter(step => features.includes(businessEntities[step.kind as EntityKind].feature));
}
export type OperationRow = Record<string, string | number | null | Record<string, unknown>>;
export interface OperationsSnapshot { rows: OperationRow[]; details: OperationRow[]; limit: number }
interface ViewDefinition { title: string; kind: EntityKind; columns: string[]; detailTitle?: string; detailKind?: EntityKind; detailColumns?: string[] }
export const operationViews: Record<BusinessFeature, ViewDefinition> = {
 assets:{title:"Sổ tài sản & phân bổ",kind:"assets",columns:["code","name","asset_type","original_cost","service_state"]},
 costing:{title:"Giá thành & dở dang",kind:"costing_runs",columns:["code","name","starts_on","ends_on","total_amount","completed_amount"]},
 accounting: { title: "Nhật ký kế toán", kind: "journal_entries", columns: ["code","name","posting_date","status","debit","credit"] },
 purchasing: { title: "Đặt mua & nhận hàng", kind: "purchase_orders", columns: ["code","name","customer","status","amount","ordered","received","remaining","expected_on"] },
 people: { title: "Nhân sự & công đã xác nhận", kind: "staff", columns: ["code","name","department","position","worked_hours","overtime_hours","joined_on"] },
 production: { title: "Lệnh & sản lượng cuối", kind: "work_orders", columns: ["code","name","status","planned","good","received","scrap","material_cost","conversion_cost","due_date"], detailTitle: "Định mức & lượng cấp thực tế", detailKind: "work_orders", detailColumns: ["code","item_code","item_name","required","allowed","issued","variance","unit"] },
 mes: { title: "Tiến độ công đoạn", kind: "operations", columns: ["code","order_code","name","work_center","sequence","planned_hours","labor_hours","machine_hours","good","scrap"] },
 inventory: { title: "Tồn kho theo lô & hạn dùng", kind: "items", columns: ["code","name","warehouse","lot_code","quantity","unit","expires_on","availability"] },
 quality: { title: "Tồn lô & chất lượng", kind: "items", columns: ["code","name","warehouse","lot_code","quantity","quality_state","expires_on","availability"], detailTitle: "Lô chờ xử lý", detailKind: "lots", detailColumns: ["code","name","item_name","manufactured_on","expires_on","quality_state"] },
 traceability: { title: "Thành phẩm → nguyên liệu", kind: "lot_links", columns: ["code","assembly_lot","component_lot","quantity","unit","order_code"] },
 sales: { title: "Đơn hàng & giao nhận", kind: "sales_orders", columns: ["code","name","customer","status","amount","ordered","shipped","remaining","due_date"], detailTitle: "Công nợ còn phải thu", detailKind: "receivables", detailColumns: ["code","customer","amount","paid_amount","remaining","due_date"] },
 projects: { title: "Ngân sách & chi phí thực tế", kind: "projects", columns: ["code","name","budget","material_cost","other_cost","actual_cost","balance","completion_percent","ends_on"], detailTitle: "Chi phí theo khoản mục", detailKind: "projects", detailColumns: ["code","category","amount"] },
 crm: { title: "Lịch chăm sóc khách hàng", kind: "interactions", columns: ["code","name","customer","channel","next_contact_on"] }
};
export const operationColumnLabels: Record<string, string> = {
 posting_date:"Ngày hạch toán",debit:"Phát sinh Nợ",credit:"Phát sinh Có",expected_on:"Ngày nhận dự kiến",department:"Bộ phận",position:"Chức danh",worked_hours:"Giờ công",overtime_hours:"Giờ tăng ca",joined_on:"Ngày vào làm",
 mold_code:"Khuôn",cavities:"Số lòng",cycle_seconds:"Chu kỳ (giây)",scrap_percent:"Phế / đầu ra (%)",actual_unit_cost:"Chi phí / SP đạt",
 code:"Mã",name:"Tên",status:"Trạng thái",planned:"Kế hoạch",good:"Đạt cuối",received:"Đã nhập kho",scrap:"Phế phẩm",material_cost:"Chi phí vật tư",conversion_cost:"Nhân công & máy",due_date:"Hạn",item_code:"Mã vật tư",item_name:"Vật tư",required:"Định mức gốc",allowed:"Gồm hao hụt cho phép",issued:"Đã cấp",variance:"Chênh lệch với gốc",unit:"ĐVT",order_code:"Lệnh",work_center:"Trạm",sequence:"Thứ tự",planned_hours:"Giờ kế hoạch",labor_hours:"Giờ nhân công",machine_hours:"Giờ máy",warehouse:"Kho",lot_code:"Lô",quantity:"Số lượng",expires_on:"Hạn dùng",availability:"Khả dụng",quality_state:"Chất lượng",manufactured_on:"Ngày sản xuất",assembly_lot:"Lô thành phẩm",component_lot:"Lô nguyên liệu",customer:"Khách hàng",amount:"Giá trị",ordered:"Đặt hàng",shipped:"Đã giao",remaining:"Còn phải thu",paid_amount:"Đã thu",budget:"Ngân sách",other_cost:"Chi phí khác",actual_cost:"Tổng thực chi",balance:"Ngân sách còn lại",completion_percent:"Tiến độ (%)",ends_on:"Hạn công trình",category:"Khoản mục",channel:"Hình thức",next_contact_on:"Hẹn tiếp theo"
};
export function enrichOperationRow(row: OperationRow): OperationRow {
 const mold=row.mold_snapshot as Record<string,unknown>|null;
 return {...row, ...(row.issued!==undefined?{variance:Number(row.issued)-Number(row.required)}:{}), ...(row.budget!==undefined?{actual_cost:Number(row.material_cost)+Number(row.other_cost),balance:Number(row.budget)-Number(row.material_cost)-Number(row.other_cost)}:{}), ...(row.good!==undefined?{scrap_percent:Number(row.good)+Number(row.scrap)>0?Math.round(Number(row.scrap)/(Number(row.good)+Number(row.scrap))*10000)/100:0,actual_unit_cost:Number(row.good)>0&&row.material_cost!==undefined?(Number(row.material_cost)+Number(row.conversion_cost))/Number(row.good):null}:{}), ...(mold?{mold_code:String(mold.code),cavities:Number(mold.cavities),cycle_seconds:Number(mold.cycleSeconds)}:{})};
}
export function industryOperationView(industry:BusinessIndustry,feature:BusinessFeature):ViewDefinition {
 const view=operationViews[feature];
 if(feature!=="production")return view;
 if(industry==="plastics_packaging")return {...view,title:"Lệnh, khuôn & hao hụt",columns:["code","name","mold_code","cavities","cycle_seconds","planned","good","received","scrap","scrap_percent","actual_unit_cost"]};
 if(industry==="food_beverage")return {...view,title:"Lệnh theo mẻ & nhập thành phẩm"};
 if(industry==="electronics")return {...view,title:"Lắp ráp & sản lượng kiểm thử"};
 return {...view,title:"Lệnh gia công & chi phí thực tế"};
}
