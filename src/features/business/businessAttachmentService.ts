import "server-only";
import {createHash} from "node:crypto";
import {AppError} from "@/lib/api/errors";
import {getSupabaseServiceClient} from "@/lib/supabase/server";
import {safeUploadName,validateUploadedFile} from "@/lib/security/filePolicy";
import {businessHash} from "./businessCredentials";
import {businessRpc,businessSessionArgs} from "./businessService";
import type {EntityKind} from "./businessCatalog";

const bucket="business-private";
const allowedMimeTypes=["image/jpeg","image/png","image/webp","application/pdf","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/csv"] as const;
interface AttachmentDownload{objectPath:string;name:string;mimeType:string;size:number;sha256:string}
function client(){const value=getSupabaseServiceClient({timeoutMs:20000});if(!value)throw new AppError("SERVER_ERROR","Kho tệp chưa sẵn sàng.");return value;}

export async function uploadBusinessAttachment(slug:string,kind:EntityKind,recordId:string,file:File,requestId:string){
 if(!/^[0-9a-f-]{36}$/i.test(recordId)||!/^[0-9a-f-]{36}$/i.test(requestId))throw new AppError("VALIDATION_ERROR");
 const bytes=await validateUploadedFile(file,{allowedMimeTypes,maxBytes:15*1024*1024});
 const name=safeUploadName(file.name,"attachment");if(name.length>160)throw new AppError("VALIDATION_ERROR","Tên tệp quá dài.");
 const sha256=createHash("sha256").update(bytes).digest("hex");
 const metadata={requestId,kind,recordId,name,mimeType:file.type,size:bytes.byteLength,sha256};
 const begin=await businessRpc<{id:string;objectPath:string}>("business_attachment_begin",{...await businessSessionArgs(slug),p_request_id:requestId,p_kind:kind,p_record_id:recordId,p_name:name,p_mime:file.type,p_size:bytes.byteLength,p_sha256:sha256,p_payload_hash:businessHash("attachment.begin",JSON.stringify(metadata))});
 const storage=client().storage.from(bucket);
 const uploaded=await storage.upload(begin.objectPath,bytes,{contentType:file.type,upsert:true});
 if(uploaded.error)throw new AppError("SERVER_ERROR","Không tải được tệp lên kho riêng.");
 return businessRpc("business_attachment_complete",{...await businessSessionArgs(slug),p_file_id:begin.id});
}

export async function listBusinessAttachments(slug:string,kind:EntityKind,recordId:string){
 return businessRpc("business_attachments_snapshot",{...await businessSessionArgs(slug),p_kind:kind,p_record_id:recordId});
}

export async function downloadBusinessAttachment(slug:string,kind:EntityKind,recordId:string,fileId:string){
 const meta=await businessRpc<AttachmentDownload>("business_attachment_download",{...await businessSessionArgs(slug),p_kind:kind,p_record_id:recordId,p_file_id:fileId});
 const {data,error}=await client().storage.from(bucket).download(meta.objectPath);
 if(error||!data)throw new AppError("NOT_FOUND","Không tìm thấy tệp.");
 const bytes=new Uint8Array(await data.arrayBuffer());if(bytes.byteLength!==meta.size||createHash("sha256").update(bytes).digest("hex")!==meta.sha256)throw new AppError("SERVER_ERROR","Tệp không khớp dấu kiểm tra.");
 return new Response(bytes,{headers:{"content-type":meta.mimeType,"content-length":String(meta.size),"content-disposition":`attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
