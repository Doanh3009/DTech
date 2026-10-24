"use client";
import { DataTable } from "@/components/shared/DataTable";
import { businessEntities,type EntityKind } from "./businessCatalog";
import styles from "./Business.module.css";
const displayValues:Record<string,string>={new:"Mới",working:"Đang chăm sóc / xử lý",qualified:"Đủ điều kiện",converted:"Đã chuyển đổi",proposal:"Báo giá",negotiation:"Đàm phán",won:"Thắng",lost:"Thua",prepared:"Chờ phản hồi",accepted:"Chấp nhận",assigned:"Đã phân công",resolved:"Đã giải quyết",closed:"Đã đóng",respond:"Phản hồi",start:"Bắt đầu xử lý",resolve:"Giải quyết",close:"Đóng yêu cầu",reopen:"Mở lại",escalate:"Chuyển cấp",assign:"Phân công",output:"Thuế GTGT đầu ra",input:"Thuế GTGT đầu vào",input_carry:"Khấu trừ kỳ trước",taxable_income:"Thu nhập tính thuế",withheld_pit:"Thuế TNCN khấu trừ",insurance:"Bảo hiểm",active:"Đang thi công",paused:"Tạm dừng"};
const configs:Record<string,[string,string][]>= {
 lead_events:[["sourceName","Khách tiềm năng"],["previousState","Trước xử lý"],["nextState","Kết quả"]],
 lead_conversions:[["sourceName","Khách tiềm năng"],["nextState","Kết quả"]],
 opportunity_events:[["sourceName","Cơ hội"],["previousState","Trước xử lý"],["nextState","Kết quả"]],
 customer_quotes:[["sourceName","Hàng hóa"],["quantity","Số lượng"],["unitCost","Đơn giá sau chiết khấu"],["amount","Trước thuế"]],
 quote_decisions:[["sourceName","Báo giá"],["nextState","Phản hồi"],["amount","Trước thuế"]],
 sales_contracts:[["sourceName","Hàng hóa"],["quantity","Khối lượng"],["unitCost","Đơn giá trước thuế"],["amount","Giá trị"]],
 contract_amendments:[["sourceName","Hạng mục"],["previousQuantity","Khối lượng trước"],["quantity","Khối lượng sau"],["unitCost","Đơn giá sau"],["amount","Chênh lệch giá trị"]],
 contract_order_releases:[["sourceName","Hàng hóa"],["quantity","Đặt lần này"],["remaining","Còn được đặt trước lần này"],["unitCost","Đơn giá hợp đồng"],["amount","Giá trị"]],
 ticket_events:[["sourceName","Yêu cầu hỗ trợ"],["previousState","Tiến độ trước"],["nextState","Xử lý"]],
 salary_payments:[["staffName","Nhân viên"],["sourceCode","Bảng lương"],["netSalary","Thực lĩnh"],["paidBefore","Đã chi trước lần này"],["remainingBefore","Còn phải chi trước lần này"],["amount","Chi lần này"]],
 shift_assignments:[["staffName","Nhân viên"],["sourceName","Ca làm việc"],["workDate","Ngày công"],["startsAt","Bắt đầu"],["endsAt","Kết thúc"],["regularHours","Giờ theo ca"]],
 leave_requests:[["sourceName","Nhân viên"],["workDate","Ngày nghỉ"],["hours","Giờ nghỉ"],["scheduled","Giờ phân ca"],["used","Công / nghỉ đã ghi nhận"]],
 overtime_requests:[["staffName","Nhân viên"],["workDate","Ngày công"],["hours","Giờ làm thêm được duyệt"]],
 attendance_confirmations:[["staffName","Nhân viên"],["workDate","Ngày công"],["startsAt","Vào ca"],["endsAt","Ra ca"],["regularHours","Công thường · giờ"],["overtimeHours","Tăng ca · giờ"]],
 attendance_locks:[["sourceName","Nguồn đã khóa"],["hours","Giờ"]],
 budget_versions:[["sourceName","Hạng mục"],["category","Khoản mục"],["amount","Hạn mức"]],
 project_acceptances:[["sourceName","Hạng mục"],["quantity","Nghiệm thu lần này"],["remaining","Còn được nghiệm thu trước lần này"],["amount","Giá trị"]],
 project_variations:[["sourceName","Hạng mục"],["oldQuantity","Khối lượng trước"],["oldUnitPrice","Đơn giá trước"],["amount","Thay đổi giá trị"]],
 project_lifecycle_events:[["sourceName","Công trình"],["previousState","Trạng thái trước"]],
 procurement_requests:[["sourceName","Vật tư / hàng hóa"],["quantity","Số lượng"],["unitCost","Đơn giá dự kiến"],["amount","Dự toán"]],
 supplier_quotes:[["sourceName","Vật tư / hàng hóa"],["quantity","Số lượng chào"],["unitCost","Đơn giá chào"],["amount","Giá trị"]],
 procurement_awards:[["sourceName","Vật tư / hàng hóa"],["quantity","Số lượng đặt lần này"],["unitCost","Đơn giá chốt"],["amount","Giá trị"]],
 stock_transfers:[["quantity","Số lượng"],["unitCost","Đơn giá bình quân"],["amount","Giá trị điều chuyển"]],
 stock_counts:[["sourceName","Vật tư / hàng hóa"],["systemQuantity","Tồn sổ"],["countedQuantity","Thực đếm"],["quantity","Chênh lệch"],["unitCost","Đơn giá"],["amount","Giá trị chênh lệch"]],
 project_material_returns:[["sourceCode","Phiếu xuất gốc"],["quantity","Số lượng hoàn"],["unitCost","Giá xuất gốc"],["amount","Giá trị hoàn"]],
 payroll_cost_allocations:[["staffName","Nhân viên"],["sourceName","Nguồn chi phí"],["amount","Phân bổ"]],
 asset_charge_runs:[["assetName","Tài sản / CCDC"],["amount","Phân bổ lần này"],["accumulated","Lũy kế"],["remaining","Còn lại"]],
 costing_runs:[["sourceName","Nguồn chi phí"],["sourceCode","Chứng từ nguồn"],["category","Khoản mục"],["amount","Chi phí"]],
 stock_valuation_runs:[["itemName","Vật tư / thành phẩm"],["stockCode","Phiếu kho"],["quantity","Số lượng"],["unitCost","Đơn giá"],["amount","Giá trị"]],
 closing_runs:[["code","Tài khoản"],["name","Tên tài khoản"],["balance","Số kết chuyển"]],
 tax_filings:[["indicator","Chỉ tiêu"],["source_code","Chứng từ"],["base_amount","Cơ sở tính"],["tax_amount","Thuế"]],
 payroll_tax_runs:[["staffName","Nhân viên"],["gross","Thu nhập"],["employeeInsurance","BH người lao động"],["employerInsurance","BH doanh nghiệp"],["pit","Thuế TNCN"],["manual","Khấu trừ khác"]]
};
export function BusinessCalculationPanel({kind,snapshot}:{kind:EntityKind;snapshot:unknown}){
 if(!snapshot||typeof snapshot!=="object")return null;const data=snapshot as Record<string,unknown>;const rows=Array.isArray(data.rows)?data.rows as Record<string,unknown>[]:[];const fields=configs[kind];
 const metrics:Record<string,string>={totalHours:"Tổng giờ",total:"Tổng giá trị",openingWip:"Dở dang đầu lần tính",completed:"Giá trị kết chuyển",closingWip:"Dở dang cuối lần tính",interest:"Lãi vay",outstanding:"Dư nợ gốc",base:"Cơ sở tính",tax:"Nghĩa vụ",credit:"Thuế còn được khấu trừ",profit:"Kết quả kết chuyển",unpaidOffset:"Giảm công nợ chưa thanh toán",refundCredit:"Tiền cần hoàn trả"};
 if(!fields&&!Object.keys(metrics).some(k=>typeof data[k]==="number"))return null;
 return <section className={styles.stack} aria-label="Kết quả tính & đối chiếu"><h2>Kết quả tính & đối chiếu</h2><div className={styles.fields}>{Object.entries(metrics).filter(([key])=>typeof data[key]==="number").map(([key,label])=><div className={styles.readOnly} key={key}><span>{label}</span><strong className={styles.calculationValue}>{Number(data[key]).toLocaleString("vi-VN",{maximumFractionDigits:2})} <small>{key==="totalHours"?"giờ":"VND"}</small></strong></div>)}</div>{fields?<DataTable<Record<string,unknown>> className={styles.operationalTable} ariaLabel="Chi tiết tính toán" data={rows} emptyTitle="Không có dòng phát sinh" columns={fields.map(([key,label],i)=>({id:key,header:label,priority:i===0?"primary":undefined,hiddenOnMobile:i>2,cell:r=>["indicator","previousState","nextState"].includes(key)?displayValues[String(r[key])]??String(r[key]??"—"):key==="category"?businessEntities.costing_lines.fields.category.values?.[String(r[key])]??String(r[key]??"—"):typeof r[key]==="number"?<span className={styles.numeric}>{Number(r[key]).toLocaleString("vi-VN",{maximumFractionDigits:4})}</span>:String(r[key]??"—")}))}/>:null}</section>;
}
