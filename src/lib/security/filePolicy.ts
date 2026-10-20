import { AppError } from "@/lib/api/errors";

const extensions:Record<string,readonly string[]>={
  "image/jpeg":["jpg","jpeg"],"image/png":["png"],"image/webp":["webp"],"application/pdf":["pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":["xlsx"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":["docx"],"text/csv":["csv"]
};
function starts(bytes:Uint8Array,values:number[]){return values.every((value,index)=>bytes[index]===value);}
function signatureMatches(bytes:Uint8Array,mime:string){
  if(mime==="image/jpeg")return starts(bytes,[0xff,0xd8,0xff]);
  if(mime==="image/png")return starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(mime==="image/webp")return starts(bytes,[0x52,0x49,0x46,0x46])&&String.fromCharCode(...bytes.slice(8,12))==="WEBP";
  if(mime==="application/pdf")return String.fromCharCode(...bytes.slice(0,5))==="%PDF-";
  if(mime.includes("openxmlformats"))return starts(bytes,[0x50,0x4b,0x03,0x04])||starts(bytes,[0x50,0x4b,0x05,0x06]);
  if(mime==="text/csv")return !bytes.slice(0,4096).includes(0);
  return false;
}

export async function validateUploadedFile(file:File,policy:{allowedMimeTypes:readonly string[];maxBytes:number}):Promise<Uint8Array>{
  const extension=file.name.toLowerCase().split(".").pop()||"";
  if(!policy.allowedMimeTypes.includes(file.type)||!extensions[file.type]?.includes(extension))throw new AppError("VALIDATION_ERROR","Tên tệp hoặc định dạng tệp không được hỗ trợ.");
  if(file.size<=0||file.size>policy.maxBytes)throw new AppError("VALIDATION_ERROR",`Tệp phải nhỏ hơn hoặc bằng ${Math.floor(policy.maxBytes/1024/1024)} MB.`);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!signatureMatches(bytes,file.type))throw new AppError("VALIDATION_ERROR","Nội dung tệp không khớp định dạng khai báo.");
  return bytes;
}

export function safeUploadName(name:string,fallback="document"):string{
  const normalized=name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/^[-.]+/,"").slice(-120);
  return normalized||fallback;
}

export function sanitizeSpreadsheetCell(value:unknown):unknown{
  if(typeof value!=="string")return value;
  return /^[=+\-@\t\r]/.test(value)?`'${value}`:value;
}
