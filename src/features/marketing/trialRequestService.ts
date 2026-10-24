import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { trialRequestSchema, trialReviewSchema, type TrialRequestInput, type TrialRequestRecord } from "./trialSchemas";
import { intakeQualificationSchema } from "./intakeSchemas";

function commandError(message?: string): never {
  if (message?.includes("TRIAL_INVALID_INPUT")) throw new AppError("VALIDATION_ERROR");
  if (message?.includes("TRIAL_RATE_LIMITED")) throw new AppError("RATE_LIMITED");
  if (message?.includes("TRIAL_ACTOR_FORBIDDEN") || message?.includes("CRM_FORBIDDEN")) throw new AppError("PERMISSION_DENIED");
  if (message?.includes("TRIAL_NOT_FOUND")) throw new AppError("NOT_FOUND");
  if (["TRIAL_REQUEST_CONFLICT","TRIAL_VERSION_CONFLICT","TRIAL_INVALID_TRANSITION"].some((code) => message?.includes(code))) throw new AppError("CONFLICT");
  throw new AppError("NETWORK_ERROR", "Chưa thể xác nhận kết quả. Vui lòng giữ yêu cầu và thử lại.");
}
function linkedCustomerId(value:unknown):string|undefined {const parsed=z.object({id:z.string().uuid()}).safeParse(Array.isArray(value)?value[0]:value);return parsed.success?parsed.data.id:undefined;}
export async function readTrialBody(request: Request, limit = 10_000): Promise<unknown> {
  const reader=request.body?.getReader(); if (!reader) throw new AppError("VALIDATION_ERROR");
  const chunks:Uint8Array[]=[]; let length=0;
  try { while (true) { const {done,value}=await reader.read(); if (done) break; length+=value.byteLength; if (length>limit) { await reader.cancel(); throw new AppError("VALIDATION_ERROR", "Nội dung yêu cầu quá dài."); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new AppError("VALIDATION_ERROR"); }
}
export async function submitTrialRequest(input: TrialRequestInput, networkAddress: string) {
  const parsed=trialRequestSchema.safeParse(input); if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Vui lòng kiểm tra thông tin doanh nghiệp và thông tin liên hệ.");
  const key=process.env.SESSION_HASH_PEPPER; if (!key || key.length<32) commandError();
  const hash=(value:string)=>createHmac("sha256",key).update(`dtech:product-trial:v1:${value}`).digest("hex");
  const {requestId,website:honeypot,qualification,...payload}=parsed.data; if (honeypot) throw new AppError("VALIDATION_ERROR");
  const client=getSupabaseServiceClient({timeoutMs:10_000}); if (!client) commandError();
  let result;
  try { result=await client.rpc("submit_product_trial_request_v2",{p_request_id:requestId,p_payload:payload,p_qualification:qualification??{},p_payload_hash:hash(JSON.stringify(qualification?{...payload,qualification}:payload)),p_requester_hash:hash(`network:${networkAddress.slice(0,128)}`),p_contact_hash:hash(`email:${payload.email}`)}).abortSignal(AbortSignal.timeout(10_000)); }
  catch { commandError(); }
  if (result.error) commandError(result.error.message);
  if (!result.data || result.data.requestId!==requestId || result.data.received!==true) commandError();
  return {requestId,received:true as const};
}
const recordSchema=z.object({request_id:z.string().uuid(),created_at:z.string(),company_name:z.string(),contact_name:z.string(),email:z.string(),phone:z.string(),industry:z.enum(["construction","trading","services","garment","other","metalworking","plastics_packaging","electronics","food_beverage"]),company_size:z.enum(["under_20","20_100","101_300","over_300"]),needs:z.string(),status:z.enum(["new","contacted","qualified","closed"]),row_version:z.number().int().positive(),review_note:z.string().nullable(),reviewed_at:z.string().nullable()});
export async function listTrialRequests(page=1, query="", status=""):Promise<{requests:TrialRequestRecord[];total:number;page:number;pageSize:number}> {
  const client=getSupabaseServiceClient({timeoutMs:10_000}); if (!client) commandError();
  let command=client.from("product_trial_requests").select("request_id,created_at,company_name,contact_name,email,phone,industry,company_size,needs,status,row_version,review_note,reviewed_at,qualification,customers:crm_customers(id)",{count:"exact"}).order("created_at",{ascending:false}).order("request_id",{ascending:true});
  if(query)command=command.ilike("company_name",`%${query.replace(/[\\%_]/g,"\\$&")}%`);
  if(status)command=command.eq("status",status);
  const result=await command.range((page-1)*25,page*25-1).abortSignal(AbortSignal.timeout(10_000));
  if (result.error) commandError(result.error.message);
  const parsed=z.array(recordSchema).safeParse(result.data); if (!parsed.success) commandError();
  const requests=parsed.data.map((r,i)=>({requestId:r.request_id,createdAt:r.created_at,companyName:r.company_name,contactName:r.contact_name,email:r.email,phone:r.phone,industry:r.industry,companySize:r.company_size,needs:r.needs,status:r.status,rowVersion:r.row_version,reviewNote:r.review_note,reviewedAt:r.reviewed_at,customerId:linkedCustomerId(result.data?.[i]?.customers),qualification:intakeQualificationSchema.safeParse(result.data?.[i]?.qualification).success?intakeQualificationSchema.parse(result.data?.[i]?.qualification):undefined}));
  return {requests,total:result.count??requests.length,page,pageSize:25};
}
export async function reviewTrialRequest(requestId:string,input:unknown,actorId:string) {
  const parsed=trialReviewSchema.safeParse(input); if (!z.string().uuid().safeParse(requestId).success || !parsed.success) throw new AppError("VALIDATION_ERROR");
  const client=getSupabaseServiceClient({timeoutMs:10_000}); if (!client) commandError();
  let result; try { result=await client.rpc("crm_review_trial",{p_request_id:requestId,p_expected_version:parsed.data.rowVersion,p_status:parsed.data.status,p_reason:parsed.data.reason,p_actor_id:actorId}).abortSignal(AbortSignal.timeout(10_000)); } catch { commandError(); }
  if (result.error) commandError(result.error.message);
  const receipt=result.data; if (!receipt || receipt.requestId!==requestId || receipt.rowVersion!==parsed.data.rowVersion+1 || receipt.status!==parsed.data.status) commandError();
  return {requestId,rowVersion:receipt.rowVersion as number,status:parsed.data.status};
}
