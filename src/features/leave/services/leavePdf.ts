import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import { embedVietnamesePdfFonts, wrapPdfText } from "@/lib/documents/pdfFonts";

import type { SystemSettingsDocument } from "@/config/systemSettings";
import type { LeaveRequest } from "@/features/leave/types/leaveTypes";

const A4:[number,number]=[595.28,841.89];
const labels:Record<string,string>={draft:"Nháp",submitted:"Đã gửi",pending_approval:"Chờ duyệt",approved:"Đã duyệt",rejected:"Từ chối",withdrawn:"Đã thu hồi",cancelled:"Đã hủy",pending:"Chờ duyệt"};
const dayPart:Record<string,string>={full_day:"Cả ngày",morning:"Buổi sáng",afternoon:"Buổi chiều"};

function splitText(text:string,font:PDFFont,size:number,width:number){return wrapPdfText(text,font,size,width);}

export async function generateLeaveRequestPdf(request:LeaveRequest,settings:SystemSettingsDocument):Promise<Uint8Array>{
  const document=await PDFDocument.create();const {regular,bold}=await embedVietnamesePdfFonts(document);
  let page:PDFPage=document.addPage(A4);let y=790;const left=48;const width=A4[0]-96;
  const ensure=(height:number)=>{if(y-height<48){page=document.addPage(A4);y=790;}};
  const line=(value:string,font=regular,size=10,gap=17)=>{for(const part of splitText(value,font,size,width)){ensure(gap);page.drawText(part,{x:left,y,font,size,color:rgb(.11,.16,.24)});y-=gap;}};
  const field=(name:string,value:string)=>{const parts=splitText(value,regular,10,A4[0]-48-190);ensure(Math.max(22,parts.length*15+7));page.drawText(name,{x:left,y,font:bold,size:10,color:rgb(.25,.3,.38)});parts.forEach((part,index)=>page.drawText(part,{x:190,y:y-index*15,font:regular,size:10,color:rgb(.08,.12,.18)}));y-=Math.max(22,parts.length*15+7);};
  line(settings.organization.companyName.toUpperCase(),bold,11,18);line(settings.organization.address||settings.organization.shortName,regular,9,15);y-=12;
  page.drawLine({start:{x:left,y},end:{x:A4[0]-48,y},thickness:1,color:rgb(.18,.42,.77)});y-=42;
  const title="ĐƠN XIN NGHỈ PHÉP";page.drawText(title,{x:(A4[0]-bold.widthOfTextAtSize(title,18))/2,y,font:bold,size:18,color:rgb(.06,.16,.3)});y-=38;
  field("Mã đơn",request.requestNumber);field("Trạng thái",labels[request.status]??request.status);field("Nhân viên",`${request.employeeCode} · ${request.employeeName}`);field("Phòng ban",request.departmentName);field("Chức danh",request.positionName);field("Loại nghỉ",request.leaveTypeName);field("Thời gian",`${request.startDate} (${dayPart[request.startDayPart]}) – ${request.endDate} (${dayPart[request.endDayPart]})`);field("Số ngày",String(request.calculatedDays));
  y-=6;line("LÝ DO",bold,11,19);line(request.reason,regular,10,17);y-=12;line("LỊCH SỬ PHÊ DUYỆT",bold,11,20);
  if(!request.approvalSteps.length)line("Chưa có bước phê duyệt.");
  for(const step of request.approvalSteps){line(`${step.stepOrder}. ${step.approverName??"Chưa xác định"} · ${labels[step.status]??step.status}${step.actedAt?` · ${new Date(step.actedAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}`:""}`,step.status==="approved"?bold:regular,10,17);if(step.comment)line(`Ý kiến: ${step.comment}`,regular,9,15);}
  y-=18;line(`Ngày xuất: ${new Date().toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}`,regular,8,14);line(`${settings.organization.shortName} · ${settings.organization.phone} · ${settings.organization.email}`,regular,8,14);
  return document.save();
}
