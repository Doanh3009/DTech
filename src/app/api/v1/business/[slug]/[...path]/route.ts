import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { readTrialBody } from "@/features/marketing/trialRequestService";
import { businessHash } from "@/features/business/businessCredentials";
import { businessAccessCommand, businessKind, businessListSchema, businessLoginSchema, businessPassword, businessRecordAction, businessRecordCommand } from "@/features/business/businessSchemas";
import { businessRpc, businessSessionArgs, changeBusinessPassword, commandBusinessMember, loginBusiness, logoutBusiness, readBusinessWorkspace, saveBusinessRecord } from "@/features/business/businessService";
import { salesDeliverySchema } from "@/features/business/salesFulfillment";
import { featureKeys } from "@/features/business/businessCatalog";
import { misaViewKeys } from "@/features/business/businessMisaViews";
type Context={params:Promise<{slug:string;path:string[]}>};
const ok=(data:unknown)=>successResponse(data,{headers:{"cache-control":"no-store"}});
export async function GET(request:Request,{params}:Context){try{
 const {slug,path}=await params;
 if(path.length===1&&path[0]==="session")return ok(await readBusinessWorkspace(slug));
 if(path.length===1&&path[0]==="access")return ok(await businessRpc("business_access_snapshot",await businessSessionArgs(slug)));
 if(path.length===1&&path[0]==="crm"){
  const d=parseWithSchema(z.object({view:z.enum(["pipeline","quotes","tickets","campaigns"]),page:z.coerce.number().int().min(1).max(100000).default(1)}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_crm_workspace",{...await businessSessionArgs(slug),p_view:d.view,p_page:d.page}));
 }
 if(path.length===1&&["members","audit"].includes(path[0])){
  const d=parseWithSchema(businessListSchema,Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc(path[0]==="members"?"business_members_snapshot":"business_audit_snapshot",{...await businessSessionArgs(slug),p_page:d.page,p_query:d.q}));
 }
 if(path.length===3&&path[0]==="document-lines"){
  const d=parseWithSchema(z.object({page:z.coerce.number().int().min(1).max(100000).default(1)}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_document_lines",{...await businessSessionArgs(slug),p_parent_kind:parseWithSchema(businessKind,path[1]),p_parent_id:parseWithSchema(z.string().uuid(),path[2]),p_page:d.page}));
 }
 if(path.length===3&&path[0]==="records")return ok(await businessRpc("business_record_detail",{...await businessSessionArgs(slug),p_kind:parseWithSchema(businessKind,path[1]),p_id:parseWithSchema(z.string().uuid(),path[2])}));
 if(path.length===1&&path[0]==="overview")return ok(await businessRpc("business_overview",await businessSessionArgs(slug)));
 if(path.length===1&&path[0]==="workflow"){
  const d=parseWithSchema(z.object({view:z.enum(["procurement","projects"]),page:z.coerce.number().int().min(1).max(100000).default(1),requestId:z.string().uuid().optional()}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_workflow_workspace",{...await businessSessionArgs(slug),p_view:d.view,p_page:d.page,p_request_id:d.requestId??null}));
 }
 if(path.length===1&&path[0]==="misa"){
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  const d=parseWithSchema(z.object({view:z.enum(misaViewKeys),from:date,to:date,page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_misa_snapshot",{...await businessSessionArgs(slug),p_view:d.view,p_from:d.from,p_to:d.to,p_page:d.page}));
 }
 if(path.length===1&&path[0]==="dashboard"){
  const d=parseWithSchema(z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_company_dashboard",{...await businessSessionArgs(slug),p_month:`${d.month}-01`}));
 }
 if(path.length===1&&path[0]==="people"){
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  const d=parseWithSchema(z.object({from:date,to:date,page:z.coerce.number().int().min(1).max(100000).default(1)}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_people_workspace",{...await businessSessionArgs(slug),p_from:d.from,p_to:d.to,p_page:d.page}));
 }
 if(path.length===2&&path[0]==="journals")return ok(await businessRpc("business_journal_detail",{...await businessSessionArgs(slug),p_id:parseWithSchema(z.string().uuid(),path[1])}));
 if(path.length===1&&path[0]==="finance"){
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  const d=parseWithSchema(z.object({from:date,to:date,account:z.string().uuid().optional()}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_financial_snapshot",{...await businessSessionArgs(slug),p_from:d.from,p_to:d.to,p_account:d.account??null}));
 }
 if(path.length===1&&path[0]==="operations"){
  const d=parseWithSchema(z.object({feature:z.enum(featureKeys)}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_operations_view",{...await businessSessionArgs(slug),p_feature:d.feature}));
 }
 if(path.length===1&&path[0]==="procurement"){
  const d=parseWithSchema(businessListSchema,Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_procurement_matching",{...await businessSessionArgs(slug),p_page:d.page,p_query:d.q}));
 }
 if(path.length===1&&path[0]==="trace"){
  const d=parseWithSchema(z.object({lotId:z.string().uuid(),direction:z.enum(["inputs","outputs"])}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_trace_lot",{...await businessSessionArgs(slug),p_lot_id:d.lotId,p_direction:d.direction}));
 }
 if(path.length===3&&path[0]==="sales-orders"&&path[2]==="fulfillment"){
  const id=parseWithSchema(z.string().uuid(),path[1]);
  return ok(await businessRpc("business_sales_fulfillment",{...await businessSessionArgs(slug),p_order_id:id}));
 }
 if(path.length===2&&["records","options"].includes(path[0])){
  const kind=parseWithSchema(businessKind,path[1]);const args={...await businessSessionArgs(slug),p_kind:kind};
  if(path[0]==="options"){const f=parseWithSchema(z.object({q:z.string().max(100).default(""),selected:z.string().uuid().optional()}).strict(),Object.fromEntries(new URL(request.url).searchParams));return ok(await businessRpc("business_record_options",{...args,p_query:f.q,p_selected:f.selected??null}));}
  const f=parseWithSchema(businessListSchema,Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_list_records",{...args,p_page:f.page,p_query:f.q}));
 }throw new AppError("NOT_FOUND");
}catch(e){return errorResponse(e);}}
export async function POST(request:Request,{params}:Context){try{
 const {slug,path}=await params;
 if(path.length===1&&path[0]==="members")return ok(await commandBusinessMember(slug,await readTrialBody(request,6000)));
 if(path.length===1&&path[0]==="access"){
  const d=parseWithSchema(businessAccessCommand,await readTrialBody(request,120000));
  return ok(await businessRpc("business_access_update",{...await businessSessionArgs(slug),p_account:d.accountId,p_expected_version:d.rowVersion,p_custom:d.customAccess,p_grants:d.grants,p_request_id:d.requestId,p_payload_hash:businessHash("access",JSON.stringify(d)),p_expires_at:d.expiresAt,p_reason:d.reason}));
 }
 if(path.length===1&&path[0]==="login"){
  const d=parseWithSchema(businessLoginSchema,{...await readTrialBody(request,2000) as object,slug});
  // Network identity is best effort. Account and global limits remain enforced in the database.
  return ok(await loginBusiness(d,request.headers.get("x-real-ip")??request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"shared"));
 }
 if(path.length===1&&path[0]==="logout")return ok(await logoutBusiness());
 if(path.length===1&&path[0]==="password")return ok(await changeBusinessPassword(slug,parseWithSchema(z.object({currentPassword:z.string().min(1).max(128),password:businessPassword}).strict(),await readTrialBody(request,2000))));
 if(path.length===3&&path[0]==="sales-orders"&&path[2]==="deliveries"){
  const id=parseWithSchema(z.string().uuid(),path[1]);
  const d=parseWithSchema(salesDeliverySchema,await readTrialBody(request,24000));
  return ok(await businessRpc("business_deliver_sales_order",{...await businessSessionArgs(slug),p_order_id:id,p_request_id:d.requestId,p_expected_version:d.rowVersion,p_document_date:d.documentDate,p_lines:d.lines}));
 }
 if(path[0]==="records"&&path.length===2){const kind=parseWithSchema(businessKind,path[1]);return ok(await saveBusinessRecord(slug,kind,parseWithSchema(businessRecordCommand,await readTrialBody(request,24000))));}
 if(path[0]==="records"&&path.length===4&&path[3]==="actions"){
  const kind=parseWithSchema(businessKind,path[1]);const id=parseWithSchema(z.string().uuid(),path[2]);const d=parseWithSchema(businessRecordAction,await readTrialBody(request,2000));
  return ok(await businessRpc("business_record_action",{...await businessSessionArgs(slug),p_kind:kind,p_id:id,p_expected_version:d.rowVersion,p_action:d.action,p_reason:d.reason,p_request_id:d.requestId,p_payload_hash:businessHash("action",JSON.stringify({kind,id,...d}))}));
 }throw new AppError("NOT_FOUND");
}catch(e){return errorResponse(e);}}
