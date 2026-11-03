import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { readTrialBody } from "@/features/marketing/trialRequestService";
import { businessHash } from "@/features/business/businessCredentials";
import {downloadBusinessAttachment,listBusinessAttachments,uploadBusinessAttachment} from "@/features/business/businessAttachmentService";
import { businessAccessCommand, businessKind, businessListSchema, businessLoginSchema, businessOwnerTransfer, businessPassword, businessProjectTaskAcceptanceCommand, businessProjectTaskCommand, businessProjectTaskUpdateCommand, businessRecordAction, businessRecordCommand } from "@/features/business/businessSchemas";
import { businessRpc, businessSessionArgs, changeBusinessPassword, commandBusinessMember, loginBusiness, logoutBusiness, readBusinessWorkspace, saveBusinessRecord } from "@/features/business/businessService";
import { salesDeliverySchema } from "@/features/business/salesFulfillment";
import { featureKeys } from "@/features/business/businessCatalog";
import { misaViewKeys } from "@/features/business/businessMisaViews";
import { buildBusinessMisaCsv, collectBusinessMisaExportRows, type BusinessMisaExportPage } from "@/features/business/businessMisaExport";
import {approvalPolicySchema,approvalDelegationSchema,formVersionSchema,formRecordSchema} from "@/features/business/businessApprovalSchemas";
type Context={params:Promise<{slug:string;path:string[]}>};
const ok=(data:unknown)=>successResponse(data,{headers:{"cache-control":"no-store"}});
export async function GET(request:Request,{params}:Context){try{
 const {slug,path}=await params;
 if(path.length===3&&path[0]==="attachments")return ok(await listBusinessAttachments(slug,parseWithSchema(businessKind,path[1]),parseWithSchema(z.string().uuid(),path[2])));
 if(path.length===4&&path[0]==="attachments")return await downloadBusinessAttachment(slug,parseWithSchema(businessKind,path[1]),parseWithSchema(z.string().uuid(),path[2]),parseWithSchema(z.string().uuid(),path[3]));
 if(path.length===1&&path[0]==="session")return ok(await readBusinessWorkspace(slug));
 if(path.length===2&&path[0]==="items"&&path[1]==="convert-quantity"){
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  const d=parseWithSchema(z.object({itemId:z.string().uuid(),fromUnit:z.string().trim().min(1).max(30),quantity:z.coerce.number().finite().positive().max(1e15),on:date}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_item_quantity_conversion",{...await businessSessionArgs(slug),p_item_id:d.itemId,p_from_unit:d.fromUnit,p_quantity:d.quantity,p_on:d.on}));
 }
 if(path.length===1&&path[0]==="search"){const d=parseWithSchema(z.object({q:z.string().trim().min(2).max(80),feature:z.enum(featureKeys).optional()}).strict(),Object.fromEntries(new URL(request.url).searchParams));const args={...await businessSessionArgs(slug),p_query:d.q};return ok(await businessRpc(d.feature?"business_search_module_records":"business_search_records",d.feature?{...args,p_feature:d.feature}:args));}
 if(path.length===1&&path[0]==="notifications"){const d=parseWithSchema(z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),Object.fromEntries(new URL(request.url).searchParams));return ok(await businessRpc("business_notifications_workspace",{...await businessSessionArgs(slug),p_page:d.page}));}
 if(path.length===1&&path[0]==="calendar"){
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  const d=parseWithSchema(z.object({from:date,to:date}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=41*86400000),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_meeting_calendar",{...await businessSessionArgs(slug),p_from:d.from,p_to:d.to}));
 }
 if(path.length===1&&path[0]==="project-tasks"){
  const d=parseWithSchema(z.object({projectId:z.string().uuid().optional()}).strict(),Object.fromEntries(new URL(request.url).searchParams));
  return ok(await businessRpc("business_project_task_workspace",{...await businessSessionArgs(slug),p_project_id:d.projectId??null}));
 }
 if(path.length===3&&path[0]==="project-tasks"&&path[2]==="updates")return ok(await businessRpc("business_project_task_updates_workspace",{...await businessSessionArgs(slug),p_task_id:parseWithSchema(z.string().uuid(),path[1])}));
 if(path.length===1&&path[0]==="access")return ok(await businessRpc("business_access_snapshot",await businessSessionArgs(slug)));
 if(path.length===2&&path[0]==="members"&&path[1]==="owner-targets")return ok(await businessRpc("business_owner_transfer_targets",await businessSessionArgs(slug)));
  if(path.length===2&&path[0]==="approval"&&path[1]==="inbox"){
   const d=parseWithSchema(z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).strict(),Object.fromEntries(new URL(request.url).searchParams));
   return ok(await businessRpc("business_approval_inbox",{...await businessSessionArgs(slug),p_page:d.page}));
  }
 if(path.length===2&&path[0]==="approval"&&path[1]==="report")return ok(await businessRpc("business_approval_report",await businessSessionArgs(slug)));
 if(path.length===2&&path[0]==="approval"&&path[1]==="settings")return ok(await businessRpc("business_approval_settings",await businessSessionArgs(slug)));
 if(path.length===3&&["approval","forms"].includes(path[0]))return ok(await businessRpc(path[0]==="approval"?"business_approval_snapshot":"business_form_snapshot",{...await businessSessionArgs(slug),p_kind:parseWithSchema(businessKind,path[1]),p_id:parseWithSchema(z.string().uuid(),path[2])}));
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
 if(path.length===2&&path[0]==="misa"&&path[1]==="export"){
  const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
  const d=parseWithSchema(z.object({view:z.enum(misaViewKeys),from:date,to:date}).strict().refine(v=>v.from<=v.to&&Date.parse(v.to)-Date.parse(v.from)<=366*86400000),Object.fromEntries(new URL(request.url).searchParams));
  const args=await businessSessionArgs(slug);
  const rows=await collectBusinessMisaExportRows(page=>businessRpc<BusinessMisaExportPage>("business_misa_snapshot",{...args,p_view:d.view,p_from:d.from,p_to:d.to,p_page:page}));
  return new Response(buildBusinessMisaCsv(d.view,rows),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="misa-${d.view}-${d.from}-${d.to}.csv"`,"cache-control":"private, no-store"}});
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
 if(path.length===2&&path[0]==="quality"&&path[1]==="dashboard"){
  const args=await businessSessionArgs(slug);const [dashboard,trend]=await Promise.all([businessRpc<Record<string,unknown>>("business_quality_dashboard",args),businessRpc<{months:unknown[];periodMonths:number;asOf:string}>("business_quality_trend",args)]);
  return ok({...dashboard,trend:trend.months,trendPeriodMonths:trend.periodMonths});
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
 if(path.length===2&&path[0]==="notifications"&&path[1]==="read"){const d=parseWithSchema(z.object({id:z.string().uuid()}).strict(),await readTrialBody(request,1000));return ok(await businessRpc("business_notification_read",{...await businessSessionArgs(slug),p_id:d.id}));}
 if(path.length===2&&path[0]==="members"&&path[1]==="transfer-owner"){
  const d=parseWithSchema(businessOwnerTransfer,await readTrialBody(request,3000));
  return ok(await businessRpc("business_owner_transfer",{...await businessSessionArgs(slug),p_request_id:d.requestId,p_owner_version:d.ownerVersion,p_target_id:d.targetId,p_reason:d.reason,p_payload_hash:businessHash("owner.transfer",JSON.stringify(d))}));
 }
 if(path.length===1&&path[0]==="project-tasks"){
  const d=parseWithSchema(businessProjectTaskCommand,await readTrialBody(request,40000));
  const data={code:d.data.code,name:d.data.name,notes:d.data.notes,project_id:d.data.projectId,wbs_id:d.data.wbsId,parent_task_id:d.data.parentTaskId,assigned_staff_id:d.data.assignedStaffId,planned_start_on:d.data.plannedStartOn,due_on:d.data.dueOn,priority:d.data.priority,task_state:d.data.taskState,progress_percent:d.data.progressPercent,checklist:d.data.checklist,dependencies:d.data.dependencies};
  return ok(await businessRpc("business_project_task_save",{...await businessSessionArgs(slug),p_request_id:d.requestId,p_task_id:d.taskId,p_expected_version:d.expectedVersion,p_data:data,p_payload_hash:businessHash("project.task",JSON.stringify(d))}));
 }
 if(path.length===3&&path[0]==="project-tasks"&&path[2]==="acceptance"){
  const d=parseWithSchema(businessProjectTaskAcceptanceCommand,await readTrialBody(request,4000));
  return ok(await businessRpc("business_project_task_acceptance",{...await businessSessionArgs(slug),p_task_id:parseWithSchema(z.string().uuid(),path[1]),p_expected_version:d.expectedVersion,p_decision:d.decision,p_reason:d.reason,p_request_id:d.requestId,p_payload_hash:businessHash("project.task.acceptance",JSON.stringify(d))}));
 }
 if(path.length===3&&path[0]==="project-tasks"&&path[2]==="updates"){
  const d=parseWithSchema(businessProjectTaskUpdateCommand,await readTrialBody(request,8000));
  return ok(await businessRpc("business_project_task_update_add",{...await businessSessionArgs(slug),p_request_id:d.requestId,p_task_id:parseWithSchema(z.string().uuid(),path[1]),p_event_type:d.eventType,p_body:d.body,p_work_date:d.workDate,p_shift:d.shift,p_hours:d.hours,p_payload_hash:businessHash("project.task.update",JSON.stringify(d))}));
 }
 if(path.length===3&&path[0]==="attachments"){
  const declaredLength=request.headers.get("content-length");if(declaredLength&&(!/^\d+$/.test(declaredLength)||Number(declaredLength)>16*1024*1024))throw new AppError("VALIDATION_ERROR","Yêu cầu tải lên vượt quá giới hạn.");
  const kind=parseWithSchema(businessKind,path[1]),recordId=parseWithSchema(z.string().uuid(),path[2]),form=await request.formData(),file=form.get("file"),requestId=parseWithSchema(z.string().uuid(),form.get("requestId"));
  if(!(file instanceof File))throw new AppError("VALIDATION_ERROR","Chọn một tệp hợp lệ.");
  return ok(await uploadBusinessAttachment(slug,kind,recordId,file,requestId));
 }
 if(path.length===2&&path[0]==="approval"&&["policies","delegations","forms"].includes(path[1])){
  const input=await readTrialBody(request,80000);
  if(path[1]==="delegations"){
   const d=parseWithSchema(approvalDelegationSchema,input);const {requestId,delegationId,operation,...data}=d;
   return ok(await businessRpc("business_approval_delegation_save",{...await businessSessionArgs(slug),p_request_id:requestId,p_id:delegationId,p_operation:operation,p_data:data,p_payload_hash:businessHash("approval.delegation",JSON.stringify(d))}));
  }
  const d=path[1]==="policies"?parseWithSchema(approvalPolicySchema,input):parseWithSchema(formVersionSchema,input);const {requestId,rowVersion,...data}=d;
  return ok(await businessRpc(path[1]==="policies"?"business_approval_policy_save":"business_form_version_save",{...await businessSessionArgs(slug),p_request_id:requestId,p_expected_version:rowVersion,p_data:data,p_payload_hash:businessHash("approval.config",JSON.stringify(d))}));
 }
 if(path.length===3&&path[0]==="forms"){
  const kind=parseWithSchema(businessKind,path[1]),id=parseWithSchema(z.string().uuid(),path[2]);const d=parseWithSchema(formRecordSchema,await readTrialBody(request,80000));
  return ok(await businessRpc("business_form_record_save",{...await businessSessionArgs(slug),p_request_id:d.requestId,p_kind:kind,p_id:id,p_expected_version:d.rowVersion,p_parent_version:d.parentVersion,p_form_id:d.formId,p_data:d.data,p_payload_hash:businessHash("form.data",JSON.stringify({kind,id,...d}))}));
 }
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
