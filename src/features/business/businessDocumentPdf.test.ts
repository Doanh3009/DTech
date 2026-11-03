// @vitest-environment node
import{describe,expect,it}from"vitest";
import{PDFDocument}from"pdf-lib";
import{buildBusinessDocumentPdf,type BusinessDocumentExport}from"./businessDocumentPdf";
const source:BusinessDocumentExport={record:{id:"id",code:"PO-2026-000001",name:"Đơn mua thép cho công trình",status:"draft",row_version:1,created_at:"2026-11-03T01:00:00Z",partner_id:"partner",order_date:"2026-11-03",expected_on:"2026-11-04",references:{partner_id:"NCC01 · Công ty Thép Việt"},notes:"Giao nhận tại công trường"},lines:[{name:"Thép hộp",quantity:2,unit_price:15000,item_id:"item",references:{item_id:"VT01 · Thép hộp"}}],lineKind:"purchase_lines",tenantName:"Doanh nghiệp mô phỏng",systemName:"ERP",isDemo:true,createdBy:"Nguyễn Văn A"};
describe("business document PDF",()=>{
 it("creates a Vietnamese PDF with tenant identity and an explicit demo subject",async()=>{const bytes=await buildBusinessDocumentPdf("purchase_orders",source);const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);expect(pdf.getTitle()).toBe("Đơn mua hàng · PO-2026-000001");expect(pdf.getAuthor()).toBe(source.tenantName);expect(pdf.getSubject()).toBe("Dữ liệu trải nghiệm");});
 it("handles unsupported emoji safely and paginates long notes",async()=>{const bytes=await buildBusinessDocumentPdf("purchase_orders",{...source,record:{...source.record,name:"Đơn thép 📦",notes:Array.from({length:100},(_,index)=>`Dòng ${index}: giao nhận thép đúng quy cách, kiểm đếm tại công trình.`).join("\n")}});expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);});
 it("rejects documents above the row bound before rendering",async()=>{await expect(buildBusinessDocumentPdf("purchase_orders",{...source,lines:Array.from({length:501},()=>({}))})).rejects.toThrow("500");});
});
