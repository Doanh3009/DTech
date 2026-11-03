import {PDFDocument,rgb} from "pdf-lib";
import {embedVietnamesePdfFonts,wrapPdfText} from "@/lib/documents/pdfFonts";
import {businessIntegrations,simulationScenarios,simulationStates,type SimulationReceipt} from "./businessSimulation";
export async function buildBusinessSimulationPdf(receipt:SimulationReceipt){
 const document=await PDFDocument.create(),{regular,bold}=await embedVietnamesePdfFonts(document),supported=new Set(regular.getCharacterSet());
 const safe=(value:unknown)=>Array.from(String(value??"—").normalize("NFC")).map(char=>char==="\n"||supported.has(char.codePointAt(0)!)?char:"?").join("");
 document.setTitle(`MÔ PHỎNG · ${receipt.reference}`);document.setAuthor(receipt.tenantName);document.setSubject("Mô phỏng · Không có giá trị giao dịch hoặc chữ ký số pháp lý");
 let page=document.addPage([595.28,841.89]),y=790;
 function text(value:unknown,strong=false){for(const line of wrapPdfText(safe(value),strong?bold:regular,strong?13:10,505)){if(y<60){page=document.addPage([595.28,841.89]);y=790;}page.drawText(line,{x:45,y,size:strong?13:10,font:strong?bold:regular,color:rgb(.13,.18,.23)});y-=18;}y-=8;}
 text(receipt.tenantName,true);text("MÔ PHỎNG — KHÔNG CÓ GIÁ TRỊ GIAO DỊCH",true);text(`Biên nhận ${businessIntegrations[receipt.service].label}`,true);
 for(const[label,value]of [["Mã biên nhận",receipt.reference],["Chứng từ",`${receipt.sourceCode} · ${receipt.sourceName}`],["Phiên bản nguồn",receipt.sourceVersion],["Trạng thái",simulationStates[receipt.state]],["Kịch bản",simulationScenarios[receipt.scenario]],["Số lần xử lý",receipt.attempts],["SHA-256 nguồn",receipt.sourceSha256],["Người nhận xem trước",receipt.recipient],["Lập lúc",new Date(receipt.createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})]])if(value!==null)text(`${label}: ${value}`);
 if(receipt.result.grossAmount!==undefined)text(`Giá trị mô phỏng: ${Number(receipt.result.grossAmount).toLocaleString("vi-VN")} VND`);
 if(receipt.result.documentSha256)text(`SHA-256 tệp nguồn: ${receipt.result.documentSha256}`);
 if(receipt.result.subject)text(`Tiêu đề email: ${receipt.result.subject}`);
 if(receipt.lastError)text(receipt.lastError);
 text("Lịch sử xử lý",true);for(const event of receipt.events)text(`${new Date(event.createdAt).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})} · ${simulationStates[event.state]} · ${event.actor}`);
 for(const item of document.getPages())item.drawText("MÔ PHỎNG · Không gửi tới nhà cung cấp thật",{x:45,y:30,font:regular,size:8,color:rgb(.4,.43,.47)});
 return document.save();
}
