import "server-only";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/api/errors";
import { crmActivitySchema, crmConvertSchema, crmProfileSchema, crmSaveSchema, crmSetupSchema, emptySetup, type CrmActivity, type CrmCustomer } from "./crmSchemas";

function failure(message?: string): never {
  if(message?.includes("BUSINESS_USE_WORKSPACE_CONFIGURATION"))throw new AppError("CONFLICT","Đổi gói ngành tại Cấu hình ERP rồi lưu đồng bộ.");
  if (message?.includes("CRM_FORBIDDEN")) throw new AppError("PERMISSION_DENIED");
  if (message?.includes("CRM_NOT_FOUND")) throw new AppError("NOT_FOUND");
  if (message?.includes("CRM_INVALID_INPUT")) throw new AppError("VALIDATION_ERROR");
  if (["CRM_VERSION_CONFLICT", "CRM_DUPLICATE_TARGET", "CRM_INVALID_TRANSITION", "CRM_CHECKS_STALE", "CRM_SETUP_INCOMPLETE", "CRM_TARGET_PROTECTED"].some(c => message?.includes(c))) throw new AppError("CONFLICT", "Dữ liệu đã thay đổi hoặc chưa đáp ứng điều kiện triển khai. Tải lại hồ sơ để đối chiếu.");
  throw new AppError("NETWORK_ERROR", "Chưa xác nhận được kết quả. Tải lại hồ sơ trước khi tiếp tục.");
}
function client() { const c = getSupabaseServiceClient({ timeoutMs: 10_000 }); if (!c) failure(); return c; }
const record = z.object({ id: z.string().uuid(), source_request_id: z.string().uuid().nullable(), profile: crmProfileSchema, setup: crmSetupSchema, stage: crmSaveSchema.shape.stage, row_version: z.number().int().positive(), created_at: z.string(), updated_at: z.string() });
function customer(input: unknown): CrmCustomer { const p = record.safeParse(input); if (!p.success) failure(); const r=p.data; return {customerId:r.id,sourceRequestId:r.source_request_id,profile:r.profile,setup:r.setup,stage:r.stage,rowVersion:r.row_version,createdAt:r.created_at,updatedAt:r.updated_at}; }
async function command(name: string, args: Record<string, unknown>) {
  let result; try { result = await client().rpc(name,args).abortSignal(AbortSignal.timeout(10_000)); } catch { failure(); }
  if (result.error) failure(result.error.message);
  const receipt=z.object({customerId:z.string().uuid(),rowVersion:z.number().int().positive()}).safeParse(result.data); if(!receipt.success)failure(); return receipt.data;
}
export async function listCustomers(page: number, query: string, stage: string) {
  let q=client().from("crm_customers").select("id,source_request_id,profile,setup,stage,row_version,created_at,updated_at",{count:"exact"}).order("updated_at",{ascending:false}).order("id",{ascending:true});
  if(query) { const escaped=query.replace(/[\\%_]/g,"\\$&"); q=q.ilike("search_text",`%${escaped}%`); }
  if(stage)q=q.eq("stage",stage);
  const r=await q.range((page-1)*25,page*25-1).abortSignal(AbortSignal.timeout(10_000));if(r.error)failure(r.error.message);
  return {customers:(r.data??[]).map(customer),total:r.count??0,page,pageSize:25};
}
export async function readCustomer(id:string) {
  if(!z.string().uuid().safeParse(id).success)throw new AppError("VALIDATION_ERROR");
  const r=await client().from("crm_customers").select("id,source_request_id,profile,setup,stage,row_version,created_at,updated_at").eq("id",id).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();if(r.error)failure(r.error.message);if(!r.data)throw new AppError("NOT_FOUND");
  const a=await client().from("crm_activities").select("id,kind,note,created_at,actor:app_accounts(display_name)").eq("customer_id",id).order("created_at",{ascending:false}).limit(100).abortSignal(AbortSignal.timeout(10_000));if(a.error)failure(a.error.message);
  const activities:CrmActivity[]=(a.data??[]).map(v=>({activityId:v.id,kind:v.kind,note:v.note,createdAt:v.created_at,actorName:((v.actor as unknown as {display_name:string}|null)?.display_name)||"Tài khoản đã ngừng"}));
  return {customer:customer(r.data),activities};
}
export async function saveCustomer(input:unknown,actorId:string) {
  const p=crmSaveSchema.safeParse(input);if(!p.success)throw new AppError("VALIDATION_ERROR", "Kiểm tra thông tin doanh nghiệp, ngày dùng thử và cấu hình môi trường.");
  const d=p.data; const receipt=await command("crm_save_customer",{p_id:d.customerId,p_expected_version:d.rowVersion,p_profile:d.profile,p_setup:d.setup,p_stage:d.stage,p_reason:d.reason,p_actor_id:actorId});
  if(receipt.customerId!==d.customerId||receipt.rowVersion!==d.rowVersion+1)failure();return receipt;
}
export async function convertTrial(input:unknown,actorId:string) {
  const p=crmConvertSchema.safeParse(input);if(!p.success)throw new AppError("VALIDATION_ERROR");
  const r=await client().from("product_trial_requests").select("industry").eq("request_id",p.data.requestId).abortSignal(AbortSignal.timeout(10_000)).maybeSingle();if(r.error)failure(r.error.message);if(!r.data)throw new AppError("NOT_FOUND");
  const industry=crmSetupSchema.innerType().shape.industryPreset.safeParse(r.data.industry); const setup=emptySetup(industry.success?industry.data:"general");
  return command("crm_convert_trial",{p_id:p.data.customerId,p_request_id:p.data.requestId,p_expected_version:p.data.rowVersion,p_setup:setup,p_actor_id:actorId});
}
export async function addCustomerActivity(id:string,input:unknown,actorId:string) {
  const p=crmActivitySchema.safeParse(input);if(!z.string().uuid().safeParse(id).success||!p.success)throw new AppError("VALIDATION_ERROR");
  const receipt=await command("crm_add_activity",{p_id:id,p_activity_id:p.data.activityId,p_expected_version:p.data.rowVersion,p_kind:p.data.kind,p_note:p.data.note,p_actor_id:actorId});if(receipt.customerId!==id||receipt.rowVersion<p.data.rowVersion+1)failure();return receipt;
}
