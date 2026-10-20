import "server-only";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { delegationSchema, systemNoticeSchema, workflowInputSchema } from "@/features/shared-platforms/schemas";
import { resolvePlatformIdentity } from "./platformIdentity";
import { publishNotificationEvent } from "./notificationRepository";
import { recordAuditLog } from "@/services/audit/auditLog";

function db() { const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return client; }

export async function listSettingsCatalog(user:AuthenticatedUser,q?:string){
  if(!can(user.permissions,"settings.view"))throw new AppError("PERMISSION_DENIED");
  let query=db().from("business_configuration_catalog").select("*").eq("status","active").order("group_key").order("sort_order");
  if(q)query=query.ilike("label",`%${q.replaceAll("%","")}%`);
  const{data,error}=await query;if(error)throw new AppError("SERVER_ERROR");return data??[];
}

export async function listApprovalWorkflows(user:AuthenticatedUser){
  if(!can(user.permissions,"settings.view")&&!can(user.permissions,"approval.workflow.manage"))throw new AppError("PERMISSION_DENIED");
  const{data,error}=await db().from("approval_workflows").select("*,approval_workflow_versions(*,approval_workflow_steps(*))").order("name");
  if(error)throw new AppError("SERVER_ERROR");return data??[];
}

export async function publishApprovalWorkflow(user:AuthenticatedUser,input:z.infer<typeof workflowInputSchema>){
  if(!can(user.permissions,"approval.workflow.manage"))throw new AppError("PERMISSION_DENIED");
  const client=db(),actor=await resolvePlatformIdentity(client,user);
  if(input.domainType==="LEAVE"&&input.steps.some(step=>!["direct_manager","department_manager","specific_role","specific_user","hr_resolver"].includes(step.approverSource)))throw new AppError("VALIDATION_ERROR","Nguồn người duyệt không hỗ trợ cho nghiệp vụ nghỉ phép.");
  for(const step of input.steps){
    if(step.approverSource==="specific_user"){
      const id=step.resolverConfig.accountId;if(typeof id!=="string")throw new AppError("VALIDATION_ERROR","Bước người duyệt cụ thể cần accountId.");
      const{data,error}=await client.from("app_accounts").select("id").eq("id",id).eq("status","active").maybeSingle();if(error)throw new AppError("SERVER_ERROR","Không thể đọc người duyệt.");if(!data)throw new AppError("VALIDATION_ERROR","Người duyệt cụ thể không hoạt động.");
    }
    if(step.approverSource==="specific_role"){
      const code=step.resolverConfig.roleCode;if(typeof code!=="string")throw new AppError("VALIDATION_ERROR","Bước theo vai trò cần roleCode.");
      const{data,error}=await client.from("roles").select("id").eq("code",code).maybeSingle();if(error)throw new AppError("SERVER_ERROR","Không thể đọc vai trò người duyệt.");if(!data)throw new AppError("VALIDATION_ERROR","Vai trò không tồn tại.");
    }
  }
  const{data,error}=await client.rpc("publish_approval_workflow_command",{p_code:input.code,p_name:input.name,p_domain_type:input.domainType,p_expected_processing_hours:input.expectedProcessingHours??null,p_steps:input.steps,p_actor_id:actor.accountId});
  if(error||!data||typeof data!=="object"||Array.isArray(data))throw new AppError("SERVER_ERROR","Không thể phát hành quy trình.");
  const result=data as{workflow_id?:unknown;version?:unknown},workflowId=String(result.workflow_id??""),version=Number(result.version);if(!workflowId||!Number.isInteger(version))throw new AppError("SERVER_ERROR","Kết quả phát hành quy trình không hợp lệ.");
  await recordAuditLog({actorId:actor.accountId,action:"approval.workflow_published",entityType:"approval_workflow",entityId:workflowId,after:{version,...input}});return{id:workflowId,version};
}

export async function listDelegations(user:AuthenticatedUser){if(!can(user.permissions,"approval.delegation.manage"))throw new AppError("PERMISSION_DENIED");const{data,error}=await db().from("approval_delegations").select("*,from_user:app_accounts!approval_delegations_from_account_id_fkey(display_name),to_user:app_accounts!approval_delegations_to_account_id_fkey(display_name)").order("start_at",{ascending:false});if(error)throw new AppError("SERVER_ERROR");return data??[];}
export async function createDelegation(user:AuthenticatedUser,input:z.infer<typeof delegationSchema>){if(!can(user.permissions,"approval.delegation.manage"))throw new AppError("PERMISSION_DENIED");const client=db(),actor=await resolvePlatformIdentity(client,user);const{data:users,error:usersError}=await client.from("app_accounts").select("id").in("id",[input.fromAccountId,input.toAccountId]).eq("status","active");if(usersError)throw new AppError("SERVER_ERROR","Không thể đọc tài khoản ủy quyền.");if(users?.length!==2)throw new AppError("VALIDATION_ERROR","Tài khoản ủy quyền không hợp lệ.");const{data,error}=await client.from("approval_delegations").insert({from_account_id:input.fromAccountId,to_account_id:input.toAccountId,start_at:input.startAt,end_at:input.endAt,scope:input.scope,status:"active",reason:input.reason,created_by:actor.accountId}).select("id").single();if(error||!data)throw new AppError("SERVER_ERROR","Không thể tạo ủy quyền.");await recordAuditLog({actorId:actor.accountId,action:"approval.delegation_created",entityType:"approval_delegation",entityId:data.id,after:input,reason:input.reason});return data;}

export async function listSystemNotices(user:AuthenticatedUser){if(!can(user.permissions,"notification.system_notice.manage"))throw new AppError("PERMISSION_DENIED");const{data,error}=await db().from("system_notices").select("*").order("start_at",{ascending:false});if(error)throw new AppError("SERVER_ERROR");return data??[];}

export async function listActiveSystemNotices(user:AuthenticatedUser){
  const client=db(),actor=await resolvePlatformIdentity(client,user),now=new Date().toISOString();
  const{data,error}=await client.from("system_notices").select("id,title,message,priority,start_at,end_at,audience_type,audience_ids").eq("status","active").lte("start_at",now).gte("end_at",now).order("priority",{ascending:false});if(error)throw new AppError("SERVER_ERROR");if(!data?.length)return[];
  const[{data:roles,error:rolesError},{data:employee,error:employeeError}]=await Promise.all([client.from("account_roles").select("role_id").eq("account_id",actor.accountId),actor.employeeId?client.from("employees").select("department_id").eq("id",actor.employeeId).maybeSingle():Promise.resolve({data:null,error:null})]);
  if(rolesError||employeeError)throw new AppError("SERVER_ERROR","Không thể xác định đối tượng nhận thông báo.");
  return data.filter(notice=>notice.audience_type==="all_users"||notice.audience_type==="specific_roles"&&(roles??[]).some(role=>(notice.audience_ids as string[]).includes(role.role_id))||notice.audience_type==="specific_departments"&&employee?.department_id&&(notice.audience_ids as string[]).includes(employee.department_id));
}

async function noticeRecipients(client:SupabaseClient,input:z.infer<typeof systemNoticeSchema>):Promise<string[]>{
  if(input.audienceType==="all_users"){
    const{data,error}=await client.from("app_accounts").select("id").eq("status","active");
    if(error)throw new AppError("SERVER_ERROR","Không thể đọc người nhận thông báo.");
    return(data??[]).map(item=>item.id);
  }
  if(input.audienceType==="specific_roles"){
    const{data,error}=await client.from("account_roles").select("account_id,recipient:app_accounts!account_roles_account_id_fkey!inner(status)").in("role_id",input.audienceIds).eq("recipient.status","active");
    if(error)throw new AppError("SERVER_ERROR","Không thể đọc người nhận theo vai trò.");
    return[...new Set((data??[]).map(item=>item.account_id))];
  }
  const{data:employees,error:employeesError}=await client.from("employees").select("id").in("department_id",input.audienceIds);
  if(employeesError)throw new AppError("SERVER_ERROR","Không thể đọc nhân sự nhận thông báo.");
  const employeeIds=(employees??[]).map(item=>item.id);
  if(!employeeIds.length)return[];
  const{data,error}=await client.from("app_accounts").select("id").in("employee_id",employeeIds).eq("status","active");
  if(error)throw new AppError("SERVER_ERROR","Không thể đọc người nhận theo phòng ban.");
  return(data??[]).map(item=>item.id);
}

export async function createSystemNotice(user:AuthenticatedUser,input:z.infer<typeof systemNoticeSchema>){
  if(!can(user.permissions,"notification.system_notice.manage"))throw new AppError("PERMISSION_DENIED");const client=db(),actor=await resolvePlatformIdentity(client,user);
  const recipients=input.status==="active"?await noticeRecipients(client,input):[];
  const{data,error}=await client.from("system_notices").insert({title:input.title,message:input.message,start_at:input.startAt,end_at:input.endAt,audience_type:input.audienceType,audience_ids:input.audienceIds,priority:input.priority,status:input.status,created_by:actor.accountId}).select("id").single();if(error||!data)throw new AppError("SERVER_ERROR","Không thể tạo thông báo.");
  if(input.status==="active"){await publishNotificationEvent({eventKey:"system.notice",aggregateType:"system_notice",aggregateId:data.id,actorAccountId:actor.accountId,idempotencyKey:`system-notice:${data.id}`,recipients,values:{notice_title:input.title,notice_message:input.message},deepLink:"/notifications",priority:input.priority},client);}
  await recordAuditLog({actorId:actor.accountId,action:"system.notice.created",entityType:"system_notice",entityId:data.id,after:input});return data;
}
