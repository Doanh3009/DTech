import{PDFDocument,rgb}from"pdf-lib";
import{embedVietnamesePdfFonts,wrapPdfText}from"@/lib/documents/pdfFonts";
import{businessEntities,recordStates,type EntityKind}from"./businessCatalog";
import{recordFieldText}from"./businessPresentation";
export interface BusinessDocumentExport{record:Record<string,unknown>;lines:Record<string,unknown>[];lineKind:EntityKind|null;tenantName:string;systemName:string;isDemo:boolean;createdBy:string;journalLines?:Record<string,unknown>[];journalCode?:string}
export async function buildBusinessDocumentPdf(kind:EntityKind,input:BusinessDocumentExport){
 if(input.lines.length>500||(input.journalLines?.length??0)>500)throw Error("Chứng từ vượt quá 500 dòng.");
 const definition=businessEntities[kind],document=await PDFDocument.create(),{regular,bold}=await embedVietnamesePdfFonts(document),charset=new Set(regular.getCharacterSet());
 document.setTitle(`${definition.label} · ${String(input.record.code)}`);document.setAuthor(input.tenantName);document.setSubject(input.isDemo?"Dữ liệu trải nghiệm":"Chứng từ nội bộ");
 const safe=(value:unknown)=>Array.from(String(value??"—").normalize("NFC")).map(char=>char==="\n"||charset.has(char.codePointAt(0)!)?char:char==="\r"?"":"?").join("");
 const width=595.28,height=841.89,left=42,contentWidth=width-left*2,ink=rgb(.14,.19,.24),muted=rgb(.4,.45,.51);let page=document.addPage([width,height]),y=height-50;
 function newPage(){if(document.getPageCount()>=80)throw Error("Chứng từ quá dài để tạo PDF.");page=document.addPage([width,height]);y=height-50;}
 function ensure(height:number){if(y-height<58)newPage();}
 function text(value:unknown,{size=10,strong=false,indent=0,gap=15}:{size?:number;strong?:boolean;indent?:number;gap?:number}={}){const font=strong?bold:regular;for(const line of wrapPdfText(safe(value),font,size,contentWidth-indent)){ensure(gap);page.drawText(line,{x:left+indent,y,font,size,color:ink});y-=gap;}}
 function field(label:string,value:unknown){const labels=wrapPdfText(safe(label),regular,9,148),values=wrapPdfText(safe(value),regular,10,contentWidth-162),rows=Math.max(labels.length,values.length);for(let i=0;i<rows;i++){ensure(15);if(labels[i])page.drawText(labels[i],{x:left,y,font:regular,size:9,color:muted});if(values[i])page.drawText(values[i],{x:left+162,y,font:regular,size:10,color:ink});y-=15;}y-=6;}
 text(input.tenantName,{size:13,strong:true,gap:19});text(input.systemName,{size:9,gap:20});if(input.isDemo)text("DỮ LIỆU TRẢI NGHIỆM",{size:10,strong:true,gap:21});text(definition.label,{size:19,strong:true,gap:27});
 field("Số / mã",input.record.code);field("Tên / diễn giải",input.record.name);field("Trạng thái",recordStates[input.record.status as keyof typeof recordStates]??"—");field("Phiên bản",input.record.row_version);field("Người lập",input.createdBy);
 if(input.record.created_at)field("Lập lúc",new Date(String(input.record.created_at)).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}));
 for(const[key,definitionField]of Object.entries(definition.fields))if(Object.hasOwn(input.record,key))field(definitionField.label,recordFieldText(input.record,key,definitionField));
 if(input.record.notes)field("Ghi chú",input.record.notes);
 if(input.lineKind&&input.lines.length){y-=12;ensure(35);text(businessEntities[input.lineKind].label,{size:13,strong:true,gap:23});const child=businessEntities[input.lineKind];for(const[index,row]of input.lines.entries()){ensure(42);text(`${index+1}. ${String(row.name??row.code??"")}`,{size:10,strong:true,gap:20});for(const[key,fieldDefinition]of Object.entries(child.fields))if(key!==child.parentField&&Object.hasOwn(row,key))field(fieldDefinition.label,recordFieldText(row,key,fieldDefinition));y-=10;}}
 if(input.journalLines?.length){ensure(50);y-=10;text(`Định khoản${input.journalCode?" · "+input.journalCode:""}`,{size:13,strong:true,gap:24});let debit=0,credit=0;for(const row of input.journalLines){field("Tài khoản",(row.references as Record<string,string>|undefined)?.account_id??"—");field("Diễn giải",row.name);field("Nợ / Có",`${Number(row.debit??0).toLocaleString("vi-VN")} / ${Number(row.credit??0).toLocaleString("vi-VN")}`);debit+=Number(row.debit??0);credit+=Number(row.credit??0);}text(`Tổng Nợ: ${debit.toLocaleString("vi-VN")} · Tổng Có: ${credit.toLocaleString("vi-VN")}`,{strong:true});}
 const pages=document.getPages();for(const[index,item]of pages.entries()){item.drawLine({start:{x:left,y:43},end:{x:width-left,y:43},thickness:.5,color:rgb(.8,.82,.84)});item.drawText(safe(`${input.record.code} · ${input.isDemo?"Trải nghiệm · ":""}Trang ${index+1}/${pages.length}`),{x:left,y:28,font:regular,size:8,color:muted});}
 return document.save();
}
