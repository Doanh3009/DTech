import "server-only";

import type { z } from "zod";

import { employeeContractInputSchema } from "@/features/employees/schemas/employeeSchemas";
import type { EmployeeContract } from "@/features/employees/types";
import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";
import { generateContractDocument } from "@/features/employees/services/contractTemplateService";

type Input = z.infer<typeof employeeContractInputSchema>;
type Row = Record<string, unknown>;

function db(){const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return client;}
function required(user:AuthenticatedUser,permission:"contract.view"|"contract.edit"|"contract.file.upload"){if(!can(user.permissions,permission))throw new AppError("PERMISSION_DENIED");}
function map(row:Row):EmployeeContract{return{id:String(row.id),employeeId:String(row.employee_id),contractNumber:String(row.contract_number),contractType:String(row.contract_type),signedDate:row.signed_date?String(row.signed_date):undefined,effectiveDate:row.effective_date?String(row.effective_date):String(row.start_date),startDate:String(row.start_date),endDate:row.end_date?String(row.end_date):undefined,status:String(row.status) as EmployeeContract["status"],attachmentFileId:row.attachment_file_id?String(row.attachment_file_id):undefined,templateId:row.template_id?String(row.template_id):undefined,note:row.note?String(row.note):undefined,archivedAt:row.archived_at?String(row.archived_at):undefined,rowVersion:Number(row.row_version??1)};}

export async function listContractEmployeeOptions(user:AuthenticatedUser){required(user,"contract.edit");const{data,error}=await db().from("employees").select("id,employee_code,full_name,departments!employees_department_id_fkey(name),positions(name)").neq("employment_status","terminated").order("full_name");if(error)throw new AppError("SERVER_ERROR","Không thể đọc danh sách nhân viên.");return(data??[]).map(row=>{const department=Array.isArray(row.departments)?row.departments[0]:row.departments;const position=Array.isArray(row.positions)?row.positions[0]:row.positions;return{id:String(row.id),code:String(row.employee_code),name:String(row.full_name),departmentName:department?.name?String(department.name):undefined,positionName:position?.name?String(position.name):undefined};});}

async function upload(user:AuthenticatedUser,employeeId:string,contractId:string,file:File){
  required(user,"contract.file.upload");
  const bytes=await validateUploadedFile(file,{allowedMimeTypes:["application/pdf"],maxBytes:15*1024*1024});
  const client=db(),assetId=crypto.randomUUID(),path=`${employeeId}/contracts/${contractId}/${assetId}-${safeUploadName(file.name,"contract.pdf")}`;
  const{error:uploadError}=await client.storage.from("employee-private").upload(path,bytes,{contentType:file.type,upsert:false});
  if(uploadError)throw new AppError("SERVER_ERROR","Không thể tải file hợp đồng.");
  const{error}=await client.from("file_assets").insert({id:assetId,bucket:"employee-private",object_path:path,owner_entity_type:"employee_contract",owner_entity_id:contractId,mime_type:file.type,byte_size:file.size,visibility:"private",created_by:user.id,metadata:{originalName:file.name}});
  if(error){await client.storage.from("employee-private").remove([path]);throw new AppError("SERVER_ERROR","Không thể lưu file hợp đồng.");}
  return{assetId,path};
}

export async function listContracts(user:AuthenticatedUser,employeeId:string){required(user,"contract.view");const client=db(),{data,error}=await client.from("employee_contracts").select("*").eq("employee_id",employeeId).order("effective_date",{ascending:false,nullsFirst:false}).order("start_date",{ascending:false});if(error)throw new AppError("SERVER_ERROR","Không thể đọc hợp đồng.");const contracts=(data??[]).map(row=>map(row as Row));if(!contracts.length||!can(user.permissions,"contract.file.view"))return contracts;const{data:assets,error:assetError}=await client.from("file_assets").select("id,owner_entity_id,mime_type,created_at,metadata").eq("owner_entity_type","employee_contract").in("owner_entity_id",contracts.map(row=>row.id)).order("created_at",{ascending:false});if(assetError)throw new AppError("SERVER_ERROR","Không thể đọc lịch sử file hợp đồng.");return contracts.map(row=>{const versions=(assets??[]).filter(asset=>asset.owner_entity_id===row.id).map(asset=>({fileId:String(asset.id),fileName:typeof asset.metadata?.originalName==="string"?asset.metadata.originalName:"Tài liệu hợp đồng",mimeType:String(asset.mime_type),uploadedAt:String(asset.created_at)}));const current=versions.find(version=>version.fileId===row.attachmentFileId);return{...row,attachmentFileName:current?.fileName,attachmentMimeType:current?.mimeType,fileVersions:versions};});}

export async function createContract(user:AuthenticatedUser,employeeId:string,input:Input,file?:File,templateId?:string){
  required(user,"contract.edit");const client=db(),id=crypto.randomUUID();
  if(file&&templateId)throw new AppError("VALIDATION_ERROR","Chọn mẫu Word hoặc file PDF, không dùng đồng thời.");
  const stored=file?await upload(user,employeeId,id,file):undefined;
  const result=await client.from("employee_contracts").insert({id,employee_id:employeeId,contract_number:input.contractNumber,contract_type:input.contractType,signed_date:input.signedDate??null,effective_date:input.effectiveDate,start_date:input.effectiveDate,end_date:input.endDate??null,status:input.status,attachment_file_id:stored?.assetId??null,template_id:templateId??null,note:input.note??null,created_by:user.id}).select("*").single();
  let data=result.data;
  if(result.error||!data){
    const verified=await client.from("employee_contracts").select("*").eq("id",id).eq("employee_id",employeeId).maybeSingle();
    if(verified.data)data=verified.data;
    else{
      if(stored&&!verified.error){await client.from("file_assets").delete().eq("id",stored.assetId);await client.storage.from("employee-private").remove([stored.path]);}
      throw new AppError(result.error?.code==="23505"?"CONFLICT":"SERVER_ERROR","Không thể xác nhận đã tạo hợp đồng. Vui lòng tải lại.");
    }
  }
  if(templateId){try{await generateContractDocument(user,id,templateId);}catch(reason){await client.from("employee_contracts").delete().eq("id",id);if(stored){await client.from("file_assets").delete().eq("id",stored.assetId);await client.storage.from("employee-private").remove([stored.path]);}throw reason;}}
  await recordAuditLog({actorId:user.id,action:"employee.contract.created",entityType:"employee_contract",entityId:id,after:{employeeId,contractNumber:input.contractNumber,status:input.status,templateId}});
  const{data:created}=await client.from("employee_contracts").select("*").eq("id",id).single();return map((created??data) as Row);
}

async function persistContractUpdate(user:AuthenticatedUser,employeeId:string,contractId:string,rowVersion:number,input?:Input,file?:File){
  if(input)required(user,"contract.edit");else required(user,"contract.file.upload");
  const client=db(),{data:current,error:readError}=await client.from("employee_contracts").select("*").eq("id",contractId).eq("employee_id",employeeId).maybeSingle();
  if(readError)throw new AppError("SERVER_ERROR","Không thể đọc hợp đồng.");if(!current)throw new AppError("NOT_FOUND","Không tìm thấy hợp đồng.");
  if(Number(current.row_version??1)!==rowVersion)throw new AppError("CONFLICT","Hợp đồng đã thay đổi, vui lòng tải lại.");
  if(current.archived_at)throw new AppError("CONFLICT","Hợp đồng đã lưu trữ không thể chỉnh sửa.");
  const stored=file?await upload(user,employeeId,contractId,file):undefined;
  const payload:Row={row_version:rowVersion+1,...(stored?{attachment_file_id:stored.assetId}:{})};
  if(input)Object.assign(payload,{contract_number:input.contractNumber,contract_type:input.contractType,signed_date:input.signedDate??null,effective_date:input.effectiveDate,start_date:input.effectiveDate,end_date:input.endDate??null,status:input.status,note:input.note??null});
  const result=await client.from("employee_contracts").update(payload).eq("id",contractId).eq("employee_id",employeeId).eq("row_version",rowVersion).is("archived_at",null).select("*").maybeSingle();
  let data=result.data;
  if(result.error||!data){
    if(stored){
      // A lost response does not imply rollback. Never remove an object that
      // the committed contract still references, or one we cannot verify.
      const verified=await client.from("employee_contracts").select("*").eq("id",contractId).eq("employee_id",employeeId).maybeSingle();
      if(verified.data?.attachment_file_id===stored.assetId)data=verified.data;
      else if(!verified.error){await client.from("file_assets").delete().eq("id",stored.assetId);await client.storage.from("employee-private").remove([stored.path]);}
    }
    if(!data)throw new AppError(result.error?"SERVER_ERROR":"CONFLICT",result.error?"Không thể xác nhận đã lưu hợp đồng. Vui lòng tải lại.":"Hợp đồng đã thay đổi, vui lòng tải lại.");
  }
  await recordAuditLog({actorId:user.id,action:stored?"employee.contract.file_replaced":"employee.contract.updated",entityType:"employee_contract",entityId:contractId,before:{status:current.status,attachmentFileId:current.attachment_file_id,rowVersion},after:{status:data.status,attachmentFileId:data.attachment_file_id,rowVersion:Number(data.row_version)}});return map(data as Row);
}

export async function updateContract(user:AuthenticatedUser,employeeId:string,contractId:string,input:Input&{rowVersion:number},file?:File){return persistContractUpdate(user,employeeId,contractId,input.rowVersion,input,file);}
export async function replaceContractFile(user:AuthenticatedUser,employeeId:string,contractId:string,rowVersion:number,file?:File){if(!file)throw new AppError("VALIDATION_ERROR","Chọn file hợp đồng PDF.");return persistContractUpdate(user,employeeId,contractId,rowVersion,undefined,file);}

export async function archiveContract(user:AuthenticatedUser,employeeId:string,contractId:string,reason:string,rowVersion:number){
  required(user,"contract.edit");
  if(reason.trim().length<3)throw new AppError("VALIDATION_ERROR","Cần nhập lý do lưu trữ.");
  const client=db(),{data:current,error:readError}=await client.from("employee_contracts").select("id,status,archived_at,row_version").eq("id",contractId).eq("employee_id",employeeId).maybeSingle();
  if(readError)throw new AppError("SERVER_ERROR","Không thể đọc hợp đồng.");
  if(!current)throw new AppError("NOT_FOUND","Không tìm thấy hợp đồng.");
  if(current.archived_at||Number(current.row_version??1)!==rowVersion)throw new AppError("CONFLICT","Hợp đồng đã thay đổi, vui lòng tải lại.");
  const{data,error}=await client.from("employee_contracts").update({archived_at:new Date().toISOString(),archived_by:user.id,status:"terminated",row_version:rowVersion+1}).eq("id",contractId).eq("employee_id",employeeId).eq("row_version",rowVersion).is("archived_at",null).select("*").maybeSingle();
  if(error)throw new AppError("SERVER_ERROR","Không thể xác nhận đã lưu trữ hợp đồng. Vui lòng tải lại.");
  if(!data)throw new AppError("CONFLICT","Hợp đồng đã thay đổi, vui lòng tải lại.");
  await recordAuditLog({actorId:user.id,action:"employee.contract.archived",entityType:"employee_contract",entityId:contractId,before:{status:current.status,rowVersion},after:{status:"terminated",rowVersion:rowVersion+1},reason});return map(data as Row);
}
