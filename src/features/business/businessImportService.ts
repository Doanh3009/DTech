import "server-only";
import {createHash} from "node:crypto";
import {AppError} from "@/lib/api/errors";
import {entitiesFor,recordSchema} from "./businessCatalog";
import {businessHash} from "./businessCredentials";
import {businessCan} from "./businessAccess";
import {businessRpc,businessSessionArgs,readBusinessWorkspace} from "./businessService";
import {canImportCatalog,importLimits,prepareImportRows,type ImportCommit,type ImportHistory,type ImportKind,type ImportMatch,type ImportPreview,type ImportReceipt} from "./businessImport";
import {businessImportTemplate,readBusinessImportFile} from "./businessImportFile";

export async function authorizeBusinessImport(slug:string,kind:ImportKind){
 const workspace=await readBusinessWorkspace(slug);
 if(!entitiesFor(workspace.industry,workspace.features).includes(kind)||!canImportCatalog(workspace,kind))throw new AppError("PERMISSION_DENIED");return workspace;
}
export async function readImportUpload(request:Request){
 const max=importLimits.fileBytes+65536,declared=request.headers.get("content-length");
 if(declared&&(!/^\d+$/.test(declared)||Number(declared)>max))throw new AppError("VALIDATION_ERROR","Yêu cầu tải lên vượt giới hạn.");
 const reader=request.body?.getReader();if(!reader)throw new AppError("VALIDATION_ERROR","Chọn tệp nhập.");
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw new AppError("VALIDATION_ERROR","Yêu cầu tải lên vượt giới hạn.");}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let position=0;for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
 let form:FormData;try{form=await new Response(bytes,{headers:{"content-type":request.headers.get("content-type")??""}}).formData();}catch{throw new AppError("VALIDATION_ERROR","Không đọc được tệp tải lên.");}
 const file=form.get("file");if(!(file instanceof File)||form.getAll("file").length!==1||[...form.keys()].some(key=>key!=="file"))throw new AppError("VALIDATION_ERROR","Chọn đúng một tệp nhập.");return file;
}
export async function previewBusinessImport(slug:string,kind:ImportKind,file:File):Promise<ImportPreview>{
 const w=await authorizeBusinessImport(slug,kind),source=await readBusinessImportFile(kind,file);
 const codes=[...new Set(source.map(row=>String(row.values.code??"").normalize("NFC").trim()).filter(code=>code.length>0&&code.length<=50))];
 const matches=await businessRpc<ImportMatch[]>("business_catalog_import_matches",{...await businessSessionArgs(slug),p_kind:kind,p_codes:codes});
 return {fileName:file.name.replace(/^.*[/\\]/,"").replace(/[\u0000-\u001f\u007f]/g,"").normalize("NFC").slice(0,180)||"danh-muc.xlsx",fileHash:createHash("sha256").update(new Uint8Array(await file.arrayBuffer())).digest("hex"),rows:prepareImportRows(kind,source,matches,w)};
}
export async function commitBusinessImport(slug:string,kind:ImportKind,input:ImportCommit){
 const w=await authorizeBusinessImport(slug,kind),codes=new Set<string>();
 const rows=input.rows.map(row=>{
  const data=recordSchema(kind).safeParse(row.data);if(!data.success||Object.values(row.data).some(value=>typeof value==="string"&&value.includes("\u0000")))throw new AppError("VALIDATION_ERROR",`Dòng ${row.rowNumber}: kiểm tra dữ liệu trước khi nhập.`);
  const code=String(data.data.code).normalize("NFC").toLocaleLowerCase("vi");if(codes.has(code))throw new AppError("VALIDATION_ERROR","Mã bị trùng trong yêu cầu nhập.");codes.add(code);
  if(!businessCan(w,kind,row.action))throw new AppError("PERMISSION_DENIED");
  return {...row,data:data.data};
 });
 const payload={...input,rows,kind};
 return businessRpc<ImportReceipt>("business_catalog_import_commit",{...await businessSessionArgs(slug),p_kind:kind,p_request_id:input.requestId,p_file_name:input.fileName,p_file_hash:input.fileHash,p_rows:rows,p_payload_hash:businessHash("catalog.import",JSON.stringify(payload))});
}
export async function templateBusinessImport(slug:string,kind:ImportKind){await authorizeBusinessImport(slug,kind);await businessRpc("business_catalog_import_matches",{...await businessSessionArgs(slug),p_kind:kind,p_codes:[]});return businessImportTemplate(kind);}
export async function historyBusinessImport(slug:string,kind:ImportKind){await authorizeBusinessImport(slug,kind);return businessRpc<ImportHistory[]>("business_catalog_import_history",{...await businessSessionArgs(slug),p_kind:kind});}
