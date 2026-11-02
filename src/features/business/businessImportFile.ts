import "server-only";
import ExcelJS from "exceljs";
import {inflateRawSync} from "node:zlib";
import {AppError} from "@/lib/api/errors";
import {importColumns,importLimits,resolveImportHeaders,type ImportCell,type ImportKind,type ImportSourceRow} from "./businessImport";

function invalid(message:string):never{throw new AppError("VALIDATION_ERROR",message);}
/** Bound real expansion before ExcelJS sees any XML, including sparse row/cell indices. */
export function guardImportWorkbook(bytes:Uint8Array){
 const b=Buffer.from(bytes);if(b.length<22||b.readUInt32LE(0)!==0x04034b50)invalid("Tệp XLSX không hợp lệ.");
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 if(end<0)invalid("Không đọc được cấu trúc XLSX.");
 const count=b.readUInt16LE(end+10),size=b.readUInt32LE(end+12),start=b.readUInt32LE(end+16);
 if(b.readUInt16LE(end+4)||b.readUInt16LE(end+6)||b.readUInt16LE(end+8)!==count||count<1||count>100||start+size!==end)invalid("Cấu trúc XLSX không được hỗ trợ.");
 let offset=start,expanded=0,sheets=0;const names=new Set<string>();
 for(let n=0;n<count;n++){
  if(offset+46>end||b.readUInt32LE(offset)!==0x02014b50)invalid("Tệp XLSX bị hỏng.");
  const flags=b.readUInt16LE(offset+8),method=b.readUInt16LE(offset+10),compressed=b.readUInt32LE(offset+20),length=b.readUInt32LE(offset+24),nameLength=b.readUInt16LE(offset+28),extra=b.readUInt16LE(offset+30),comment=b.readUInt16LE(offset+32),local=b.readUInt32LE(offset+42);
  if(offset+46+nameLength+extra+comment>end||length>importLimits.expandedBytes-expanded||(flags&1)||![0,8].includes(method)||local+30>start)invalid("Tệp XLSX vượt giới hạn hoặc đã mã hóa.");
  const nameBytes=b.subarray(offset+46,offset+46+nameLength),name=nameBytes.toString("utf8");
  if(names.has(name)||name.includes("..")||name.includes("\\")||name.startsWith("/")||/vbaProject|externalLinks|drawings|media\//i.test(name))invalid("Chỉ nhận XLSX một trang tính, không macro hoặc nội dung nhúng.");names.add(name);
  if(b.readUInt32LE(local)!==0x04034b50||b.readUInt16LE(local+8)!==method||b.readUInt16LE(local+6)!==flags)invalid("Tệp XLSX bị hỏng.");
  const localName=b.readUInt16LE(local+26),localExtra=b.readUInt16LE(local+28),dataStart=local+30+localName+localExtra;
  if(dataStart+compressed>start||!b.subarray(local+30,local+30+localName).equals(nameBytes))invalid("Tệp XLSX bị hỏng.");
  let content:Buffer;try{content=method===0?b.subarray(dataStart,dataStart+compressed):inflateRawSync(b.subarray(dataStart,dataStart+compressed),{maxOutputLength:Math.max(1,length)});}catch{invalid("Không giải nén được XLSX trong giới hạn cho phép.");}
  if(content.length!==length)invalid("Kích thước nội dung XLSX không khớp.");expanded+=length;
  if(name.endsWith(".xml")||name.endsWith(".rels")){
   const xml=content.toString("utf8");if(/<!DOCTYPE|<!ENTITY/i.test(xml))invalid("Không nhận XML có khai báo thực thể.");
   if(/^xl\/worksheets\/[^/]+\.xml$/.test(name)){
    sheets++;if(sheets>1)invalid("Mỗi tệp chỉ dùng một trang tính.");
    if((xml.match(/<row\b/g)??[]).length>importLimits.rows+1)invalid(`Tệp vượt quá ${importLimits.rows} dòng dữ liệu.`);
    for(const match of xml.matchAll(/<row\b[^>]*\br\s*=\s*["'](\d+)["']/g))if(Number(match[1])>importLimits.rows+1)invalid(`Dòng dữ liệu phải nằm trong ${importLimits.rows+1} dòng đầu.`);
    for(const match of xml.matchAll(/<c\b[^>]*\br\s*=\s*["']([A-Z]+)(\d+)["']/gi)){let column=0;for(const c of match[1].toUpperCase())column=column*26+c.charCodeAt(0)-64;if(column>importLimits.columns||Number(match[2])>importLimits.rows+1)invalid("Ô dữ liệu nằm ngoài vùng nhập cho phép.");}
    if(/<mergeCell\b/.test(xml))invalid("Bỏ gộp ô trước khi nhập dữ liệu.");
   }
  }
  offset+=46+nameLength+extra+comment;
 }
 if(offset!==end||sheets!==1)invalid("Tệp cần đúng một trang tính dữ liệu.");
}

export function parseImportCsv(source:string):string[][]{
 const text=source.replace(/^\uFEFF/,"");let quoted=false,firstLine="";
 for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){firstLine+='""';i++;continue;}quoted=!quoted;}if(!quoted&&/[\r\n]/.test(char))break;firstLine+=char;}
 const delimiter=[",",";","\t"].sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
 const matrix:string[][]=[];let row:string[]=[],cell="",inQuote=false,closed=false;
 function finishCell(){row.push(cell);cell="";closed=false;if(row.length>importLimits.columns)invalid("Tệp có quá nhiều cột.");}
 function finishRow(){finishCell();matrix.push(row);row=[];if(matrix.length>importLimits.rows+1)invalid(`Tệp vượt quá ${importLimits.rows} dòng dữ liệu.`);}
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(inQuote){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{inQuote=false;closed=true;}}else cell+=char;}
  else if(char==='"'){if(cell||closed)invalid("Dấu ngoặc kép trong CSV chưa hợp lệ.");inQuote=true;}
  else if(char===delimiter)finishCell();
  else if(char==="\n"||char==="\r"){if(char==="\r"&&text[i+1]==="\n")i++;finishRow();}
  else if(closed)invalid("Có ký tự sau dấu ngoặc kép đóng trong CSV.");else cell+=char;
  if(cell.length>4000)invalid("Một ô dữ liệu vượt quá 4.000 ký tự.");
 }
 if(inQuote)invalid("Dấu ngoặc kép trong CSV chưa đóng.");if(cell||row.length||closed)finishRow();return matrix;
}

export async function readBusinessImportFile(kind:ImportKind,file:File):Promise<ImportSourceRow[]>{
 if(file.size<=0||file.size>importLimits.fileBytes)invalid("Tệp phải có dữ liệu và không vượt quá 1 MB.");
 const bytes=new Uint8Array(await file.arrayBuffer());let matrix:ImportCell[][]=[];const rowErrors=new Map<number,string[]>();
 if(/\.csv$/i.test(file.name)){let source:string;try{source=new TextDecoder("utf-8",{fatal:true}).decode(bytes);}catch{invalid("Lưu CSV theo mã hóa UTF-8 trước khi nhập.");}matrix=parseImportCsv(source);}
 else if(/\.xlsx$/i.test(file.name)){
  guardImportWorkbook(bytes);const workbook=new ExcelJS.Workbook();try{await workbook.xlsx.load(bytes as never);}catch{invalid("Không đọc được XLSX. Kiểm tra và lưu lại tệp.");}
  if(workbook.worksheets.length!==1)invalid("Mỗi tệp chỉ dùng một trang tính.");const sheet=workbook.worksheets[0];
  if(sheet.rowCount>importLimits.rows+1||sheet.columnCount>importLimits.columns)invalid("Dữ liệu nằm ngoài vùng nhập cho phép.");
  for(let r=1;r<=sheet.rowCount;r++){
   const values:ImportCell[]=[],errors:string[]=[];
   for(let c=1;c<=sheet.columnCount;c++){
    const value=sheet.getCell(r,c).value;
    if(value===null||typeof value==="string"||typeof value==="number")values.push(value);
    else if(typeof value==="object"&&"richText" in value)values.push(value.richText.map(part=>part.text).join(""));
    else{values.push(null);errors.push(`Ô ${sheet.getCell(r,c).address}: không nhận công thức, liên kết hoặc kiểu dữ liệu này.`);}
   }
   matrix.push(values);if(errors.length)rowErrors.set(r,errors);
  }
 }else invalid("Chỉ nhận tệp .csv hoặc .xlsx.");
 if(!matrix.length||matrix.length<2)invalid("Tệp chưa có dòng dữ liệu.");
 let columns:string[];try{columns=resolveImportHeaders(kind,matrix[0].map(value=>String(value??"")));}catch(error){invalid(error instanceof Error?error.message:"Kiểm tra cột dữ liệu.");}
 const rows:ImportSourceRow[]=[];
 for(let i=1;i<matrix.length;i++){
  const values=matrix[i];if(values.every(value=>value===null||String(value).trim()==="")&&!rowErrors.has(i+1))continue;
  const errors=[...(rowErrors.get(i+1)??[])];if(values.length>columns.length&&values.slice(columns.length).some(value=>value!==null&&value!==""))errors.push("Có dữ liệu không có tên cột.");
  if(values.some(value=>typeof value==="string"&&(value.length>4000||value.includes("\u0000"))))errors.push("Ô dữ liệu quá dài hoặc có ký tự không hợp lệ.");
  rows.push({rowNumber:i+1,values:Object.fromEntries(columns.map((column,index)=>[column,values[index]??null])),errors});
 }
 if(!rows.length)invalid("Tệp chưa có dòng dữ liệu.");return rows;
}

export async function businessImportTemplate(kind:ImportKind){
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("Danh mục");const columns=importColumns(kind);
 sheet.columns=columns.map(column=>({header:column.label,key:column.key,width:column.key==="name"||column.key==="notes"?36:22,style:{numFmt:businessEntitiesNumber(kind,column.key)?"0.0000":"@"}}));
 sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
 return new Uint8Array(await workbook.xlsx.writeBuffer());
}
function businessEntitiesNumber(kind:ImportKind,column:string){return kind==="items"&&column==="standard_cost";}
