import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { canDecideApprovalDomain, canViewApprovalInbox, canViewGeneralApprovals } from "@/lib/auth/approvalAccess";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { formatWaitingHours } from "@/features/shared-platforms/rules";
import type { ApprovalCase,ApprovalStep } from "@/features/shared-platforms/types";
import { resolvePlatformIdentity } from "./platformIdentity";
import { publishNotificationEvent } from "./notificationRepository";
import { recordAuditLog } from "@/services/audit/auditLog";

type Row=Record<string,unknown>;const select="*,approval_steps(*,delegated_from:app_accounts!approval_steps_delegated_from_account_id_fkey(display_name))";
function db(){const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return client;}
function txt(row:Row,key:string){const v=row[key];return typeof v==="string"&&v?v:undefined;}
function nested(row:Row,key:string){const v=row[key];return v&&typeof v==="object"&&!Array.isArray(v)?v as Row:undefined;}
function mapStep(row:Row):ApprovalStep{return{id:String(row.id),sourceStepId:txt(row,"source_step_id"),stepOrder:Number(row.step_order),stepName:String(row.step_name),approverSource:String(row.approver_source),approverAccountId:txt(row,"resolved_approver_account_id"),approverName:txt(row,"resolved_approver_name"),status:row.status as ApprovalStep["status"],actedAt:txt(row,"acted_at"),comment:txt(row,"comment"),delegatedFromName:txt(nested(row,"delegated_from")??{},"display_name")};}
function mapCase(row:Row):ApprovalCase{const submittedAt=String(row.submitted_at);return{id:String(row.id),domainType:String(row.domain_type),domainId:String(row.domain_id),referenceNumber:String(row.reference_number),requesterName:String(row.requester_name),organizationName:txt(row,"organization_name"),summary:String(row.summary),domainLink:String(row.domain_link),workflowVersion:Number(row.workflow_version),status:row.status as ApprovalCase["status"],currentStep:row.current_step==null?undefined:Number(row.current_step),submittedAt,completedAt:txt(row,"completed_at"),waitingHours:formatWaitingHours(submittedAt),metadata:(row.metadata_summary??{}) as Record<string,unknown>,steps:((row.approval_steps??[]) as Row[]).map(mapStep).sort((a,b)=>a.stepOrder-b.stepOrder)};}
async function assignedCaseIds(client:SupabaseClient,accountId:string,delegated=false,completed=false){let assignees=[accountId];const delegationScopes=new Map<string,string[]>();if(delegated){const{data}=await client.from("approval_delegations").select("from_account_id,scope").eq("to_account_id",accountId).eq("status","active").lte("start_at",new Date().toISOString()).gte("end_at",new Date().toISOString());for(const row of data??[]){const id=String(row.from_account_id);delegationScopes.set(id,[...(delegationScopes.get(id)??[]),String(row.scope)]);}assignees=[...delegationScopes.keys()];}if(!assignees.length)return[];let query=client.from("approval_steps").select("approval_case_id,step_order,resolved_approver_account_id").in("resolved_approver_account_id",assignees);query=completed?query.in("status",["approved","rejected"]):query.eq("status","pending");const{data}=await query;if(completed)return[...new Set((data??[]).map(row=>String(row.approval_case_id)))];const ids=[...new Set((data??[]).map(row=>String(row.approval_case_id)))];if(!ids.length)return[];const{data:cases}=await client.from("approval_cases").select("id,current_step,domain_type").in("id",ids).eq("status","pending");const currentByCase=new Map((cases??[]).map(item=>[String(item.id),{step:Number(item.current_step),domain:String(item.domain_type)}]));return[...new Set((data??[]).filter(step=>{const item=currentByCase.get(String(step.approval_case_id));if(!item||item.step!==Number(step.step_order))return false;if(!delegated)return true;const scopes=delegationScopes.get(String(step.resolved_approver_account_id))??[];return scopes.includes("ALL_APPROVALS")||scopes.includes(item.domain);}).map(step=>String(step.approval_case_id)))];}

export async function listApprovalCases(user:AuthenticatedUser,view:"pending"|"completed"|"delegated"="pending"){
  if(!canViewApprovalInbox(user.permissions))throw new AppError("PERMISSION_DENIED");
  const client=db(),actor=await resolvePlatformIdentity(client,user);
  let query=client.from("approval_cases").select(select).order(view==="completed"?"completed_at":"submitted_at",{ascending:false}).limit(100);
  if(!canViewGeneralApprovals(user.permissions))query=query.eq("domain_type","LEAVE");
  query=view==="completed"?query.in("status",["approved","rejected","cancelled","withdrawn"]):query.eq("status","pending");
  if(!can(user.permissions,"approval.view_all")||view==="delegated"){
    const ids=await assignedCaseIds(client,actor.accountId,view==="delegated",view==="completed");
    if(!ids.length)return[];
    query=query.in("id",ids);
  }
  const{data,error}=await query;
  if(error)throw new AppError("SERVER_ERROR","Không thể đọc trung tâm phê duyệt.");
  return(data??[]).map(row=>mapCase(row as Row));
}
export async function getApprovalCase(user:AuthenticatedUser,id:string){
  const client=db(),actor=await resolvePlatformIdentity(client,user);
  const{data,error}=await client.from("approval_cases").select(select).eq("id",id).maybeSingle();
  if(error)throw new AppError("SERVER_ERROR","Không thể đọc yêu cầu phê duyệt.");
  if(!data)throw new AppError("NOT_FOUND","Không tìm thấy yêu cầu.");
  const item=mapCase(data as Row);
  const pending=item.steps.find(step=>step.status==="pending"&&step.stepOrder===item.currentStep);
  const assigned=pending?.approverAccountId===actor.accountId;
  const acted=item.steps.some(step=>["approved","rejected"].includes(step.status)&&step.approverAccountId===actor.accountId);
  const{data:delegation,error:delegationError}=pending?.approverAccountId&&!assigned
    ?await client.from("approval_delegations").select("id").eq("to_account_id",actor.accountId).eq("from_account_id",pending.approverAccountId).eq("status","active").lte("start_at",new Date().toISOString()).gte("end_at",new Date().toISOString()).or(`scope.eq.ALL_APPROVALS,scope.eq.${item.domainType}`).limit(1).maybeSingle()
    :{data:null,error:null};
  if(delegationError)throw new AppError("SERVER_ERROR","Không thể xác định quyền phê duyệt.");
  const owner=String(data.requester_account_id)===actor.accountId;
  const domainVisible=canViewGeneralApprovals(user.permissions)||item.domainType==="LEAVE"&&canViewApprovalInbox(user.permissions);
  if(!owner&&!can(user.permissions,"approval.view_all")&&!(domainVisible&&(assigned||acted||delegation)))throw new AppError("PERMISSION_DENIED");
  const mayDecide=item.status==="pending"&&Boolean(pending)&&canDecideApprovalDomain(user.permissions,item.domainType)&&Boolean(assigned||delegation&&can(user.permissions,"approval.act"));
  item.availableActions={approve:mayDecide,reject:mayDecide,reassign:item.status==="pending"&&Boolean(pending)&&can(user.permissions,"approval.reassign")};
  return item;
}

export async function decideApprovalCase(user:AuthenticatedUser,id:string,action:"approve"|"reject",comment?:string){const client=db(),actor=await resolvePlatformIdentity(client,user),item=await getApprovalCase(user,id),correlationId=crypto.randomUUID(),assignedStep=item.steps.find(step=>step.status==="pending"&&step.stepOrder===item.currentStep);if(!canDecideApprovalDomain(user.permissions,item.domainType))throw new AppError("PERMISSION_DENIED");if(item.status!=="pending")throw new AppError("CONFLICT","Yêu cầu đã được xử lý.");if(!assignedStep?.approverAccountId)throw new AppError("CONFLICT","Chưa xác định người duyệt.");if(assignedStep.approverAccountId!==actor.accountId){if(!can(user.permissions,"approval.act"))throw new AppError("PERMISSION_DENIED");const{data:delegation}=await client.from("approval_delegations").select("id").eq("from_account_id",assignedStep.approverAccountId).eq("to_account_id",actor.accountId).eq("status","active").lte("start_at",new Date().toISOString()).gte("end_at",new Date().toISOString()).or(`scope.eq.ALL_APPROVALS,scope.eq.${item.domainType}`).limit(1).maybeSingle();if(!delegation)throw new AppError("PERMISSION_DENIED");}if(item.domainType==="LEAVE"){
    const pending=assignedStep;if(!pending.sourceStepId)throw new AppError("CONFLICT","Bước duyệt nghỉ chưa được liên kết.");
    const{data:leave,error:leaveError}=await client.from("leave_requests").select("version").eq("id",item.domainId).maybeSingle();if(leaveError)throw new AppError("SERVER_ERROR","Không thể đọc phiên bản đơn nghỉ.");if(!leave)throw new AppError("NOT_FOUND","Không tìm thấy đơn nghỉ.");
    const{error}=await client.rpc("process_leave_approval_command",{p_request_id:item.domainId,p_actor_id:actor.accountId,p_action:action,p_comment:comment??null,p_expected_version:leave.version,p_expected_step_id:pending.sourceStepId,p_override_assignee:false,p_allow_delegation:true});if(error){if(error.message.includes("APPROVER")||error.message.includes("ACTOR_DENIED"))throw new AppError("PERMISSION_DENIED");if(error.message.includes("REJECT_REASON"))throw new AppError("VALIDATION_ERROR","Cần nhập lý do từ chối.");if(error.message.includes("BALANCE_INSUFFICIENT"))throw new AppError("CONFLICT","Số ngày phép không đủ.");if(error.message.includes("TIMESHEET_LOCKED"))throw new AppError("CONFLICT","Kỳ công trong thời gian nghỉ đã khóa. Cần mở lại kỳ công trước khi duyệt.");if(error.message.includes("CROSS_YEAR"))throw new AppError("VALIDATION_ERROR","Đơn trừ phép qua năm cần tách theo từng năm.");throw new AppError("CONFLICT","Yêu cầu đã được cập nhật ở nơi khác. Vui lòng tải lại.");}
  }else{const{error}=await client.rpc("process_approval_case",{p_case_id:id,p_actor_id:actor.accountId,p_action:action,p_comment:comment??null});if(error){if(error.message.includes("ASSIGNEE"))throw new AppError("PERMISSION_DENIED");if(error.message.includes("REJECT_REASON"))throw new AppError("VALIDATION_ERROR","Cần nhập lý do từ chối.");throw new AppError("CONFLICT","Yêu cầu đã được xử lý.");}}
  const updated=await getApprovalCase(user,id),pending=updated.steps.find(step=>step.status==="pending"),{data:owner}=await client.from("approval_cases").select("requester_account_id").eq("id",id).single(),recipients=pending?.approverAccountId?[pending.approverAccountId]:owner?.requester_account_id?[String(owner.requester_account_id)]:[],eventKey=pending?"approval.required":action==="approve"?"approval.approved":"approval.rejected";await publishNotificationEvent({eventKey,aggregateType:"approval_case",aggregateId:id,actorAccountId:actor.accountId,correlationId,idempotencyKey:`approval:${id}:${updated.steps.filter(s=>s.status!=="pending").length}:${eventKey}`,recipients,values:{reference_number:item.referenceNumber},deepLink:pending?`/approvals/${id}`:item.domainLink,priority:pending?"important":"normal"},client);
  await recordAuditLog({actorId:actor.accountId,action:`approval.${action}d`,entityType:"approval_case",entityId:id,reason:comment,metadata:{domainType:item.domainType,domainId:item.domainId,referenceNumber:item.referenceNumber,correlationId}});return updated;
}
export async function reassignApprovalCase(user:AuthenticatedUser,id:string,toAccountId:string,reason:string){if(!can(user.permissions,"approval.reassign"))throw new AppError("PERMISSION_DENIED");const client=db(),actor=await resolvePlatformIdentity(client,user),item=await getApprovalCase(user,id),pending=item.steps.find(step=>step.status==="pending"&&step.stepOrder===item.currentStep),changed=pending?.approverAccountId!==toAccountId;const{data:reassignmentId,error}=await client.rpc("reassign_approval_step",{p_case_id:id,p_actor_id:actor.accountId,p_to_account_id:toAccountId,p_reason:reason});if(error||!reassignmentId)throw new AppError("CONFLICT","Không thể chuyển người duyệt.");
  await publishNotificationEvent({eventKey:"approval.required",aggregateType:"approval_case",aggregateId:id,actorAccountId:actor.accountId,idempotencyKey:`approval:${id}:reassign:${reassignmentId}`,recipients:[toAccountId],values:{reference_number:item.referenceNumber},deepLink:`/approvals/${id}`,priority:"important"},client);if(changed)await recordAuditLog({actorId:actor.accountId,action:"approval.reassigned",entityType:"approval_case",entityId:id,reason,after:{toAccountId},metadata:{domainType:item.domainType,domainId:item.domainId,reassignmentId}});return getApprovalCase(user,id);
}
