import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { leaveYearSchema, type leaveAdjustmentSchema, type leaveGrantSchema, type leavePolicyInputSchema, type leaveRequestFiltersSchema, type leaveRequestInputSchema, type leaveRequestUpdateSchema, type leaveTypeInputSchema, type leaveWorkflowInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { calculateLeaveDays, calculateLeaveWorkingDates, summarizeLedger, withPending } from "@/features/leave/services/leaveRules";
import type { LeaveApprovalStep, LeaveBalance, LeaveLedgerEntry, LeavePolicy, LeaveRequest, LeaveType } from "@/features/leave/types/leaveTypes";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";
import { publishNotificationEvent } from "@/features/shared-platforms/services/notificationRepository";

type Row = Record<string, unknown>;
interface Identity { accountId: string; employeeId: string; employeeCode: string; employeeName: string; departmentId: string; departmentName: string; positionName: string; managerEmployeeId?: string; }
const requestSelect = "*,leave_types(name,deducts_balance),leave_request_approval_steps(*),leave_request_attachments(id,file_name,created_at)";

function db() { const client=getSupabaseServiceClient(); if(!client) throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình."); return client; }
function nested(row:Row,key:string):Row|undefined { const value=row[key]; return Array.isArray(value)?value[0] as Row|undefined:value&&typeof value==="object"?value as Row:undefined; }
function text(row:Row,key:string){const value=row[key]; return typeof value==="string"&&value?value:undefined;}
function required(row:Row,key:string){const value=text(row,key);if(!value)throw new AppError("SERVER_ERROR",`Dữ liệu thiếu ${key}.`);return value;}

async function identity(client:SupabaseClient,user:AuthenticatedUser):Promise<Identity>{
  let accountQuery=client.from("app_accounts").select("id,employee_id,status").limit(1);accountQuery=/^[0-9a-f-]{36}$/i.test(user.id)?accountQuery.eq("id",user.id):accountQuery.eq("primary_email",user.email);
  const {data:account,error}=await accountQuery.maybeSingle();if(error||!account?.employee_id||account.status!=="active")throw new AppError("PERMISSION_DENIED","Tài khoản chưa liên kết hồ sơ nhân viên.");
  const {data:employee,error:employeeError}=await client.from("employees").select("id,employee_code,full_name,department_id,position_id,manager_employee_id").eq("id",account.employee_id).single();
  if(employeeError||!employee)throw new AppError("SERVER_ERROR","Không thể đọc hồ sơ nhân viên.");
  const [{data:department},{data:position}]=await Promise.all([client.from("departments").select("name").eq("id",employee.department_id).maybeSingle(),client.from("positions").select("name").eq("id",employee.position_id).maybeSingle()]);
  return{accountId:String(account.id),employeeId:String(employee.id),employeeCode:employee.employee_code,employeeName:employee.full_name,departmentId:employee.department_id,departmentName:department?.name??"—",positionName:position?.name??"—",managerEmployeeId:employee.manager_employee_id??undefined};
}

/**
 * Management actions are attributed to the signed-in account, not to its
 * employee profile. An employee profile is required only when the operation
 * genuinely acts on the caller's own leave entitlement.
 */
function managementActor(user:AuthenticatedUser):Pick<Identity,"accountId"> { return { accountId:user.id }; }

function mapType(row:Row):LeaveType{return{id:required(row,"id"),code:required(row,"code"),name:required(row,"name"),tone:required(row,"tone") as LeaveType["tone"],deductsBalance:Boolean(row.deducts_balance),requiresReason:Boolean(row.requires_reason),requiresAttachment:Boolean(row.requires_attachment),allowsHalfDay:Boolean(row.allows_half_day),allowsMultiDay:Boolean(row.allows_multi_day),workflowId:required(row,"workflow_id"),active:Boolean(row.active)};}
function mapStep(row:Row):LeaveApprovalStep{return{id:required(row,"id"),stepOrder:Number(row.step_order),approverSource:required(row,"approver_source"),approverAccountId:text(row,"resolved_approver_account_id"),approverName:text(row,"resolved_approver_name"),status:required(row,"status") as LeaveApprovalStep["status"],actedAt:text(row,"acted_at"),comment:text(row,"comment")};}
function mapRequest(row:Row):LeaveRequest{
  const employee=(row.employee_snapshot??{}) as Row;const type=nested(row,"leave_types");const snapshot=(row.request_snapshot??{}) as Row;const typeSnapshot=(snapshot.leaveTypeSnapshot??{}) as Row;const calendar=(snapshot.calendarSnapshot??{}) as Row;
  return{id:required(row,"id"),requestNumber:required(row,"request_number"),employeeId:required(row,"employee_id"),employeeCode:text(employee,"employeeCode")??"—",employeeName:text(employee,"employeeName")??"—",departmentName:text(employee,"departmentName")??"—",positionName:text(employee,"positionName")??"—",leaveTypeId:required(row,"leave_type_id"),leaveTypeName:text(typeSnapshot,"name")??(type?required(type,"name"):"—"),deductsBalance:typeof typeSnapshot.deductsBalance==="boolean"?typeSnapshot.deductsBalance:Boolean(type?.deducts_balance),startDate:required(row,"start_date"),endDate:required(row,"end_date"),startDayPart:required(row,"start_day_part") as LeaveRequest["startDayPart"],endDayPart:required(row,"end_day_part") as LeaveRequest["endDayPart"],calculatedDays:Number(row.calculated_days),reason:text(row,"reason")??"",status:required(row,"status") as LeaveRequest["status"],submittedAt:text(row,"submitted_at"),approvedAt:text(row,"approved_at"),rejectedAt:text(row,"rejected_at"),withdrawnAt:text(row,"withdrawn_at"),cancelledAt:text(row,"cancelled_at"),version:Number(row.version),createdAt:required(row,"created_at"),warnings:Array.isArray(snapshot.warnings)?snapshot.warnings as string[]:[],workingDates:Array.isArray(calendar.workingDates)?calendar.workingDates.filter((value):value is string=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)):undefined,approvalSteps:((row.leave_request_approval_steps??[]) as Row[]).map(mapStep).sort((a,b)=>a.stepOrder-b.stepOrder),attachments:((row.leave_request_attachments??[]) as Row[]).map(item=>({id:required(item,"id"),fileName:required(item,"file_name"),createdAt:required(item,"created_at")}))};
}
function mapLedger(row:Row,typeName:string):LeaveLedgerEntry{return{id:required(row,"id"),employeeId:required(row,"employee_id"),leaveYear:Number(row.leave_year),leaveTypeId:required(row,"leave_type_id"),leaveTypeName:typeName,transactionType:required(row,"transaction_type") as LeaveLedgerEntry["transactionType"],amount:Number(row.amount),referenceType:required(row,"reference_type"),referenceId:required(row,"reference_id"),effectiveDate:required(row,"effective_date"),reason:required(row,"reason"),createdAt:required(row,"created_at")};}

export async function listLeaveTypes(activeOnly=false):Promise<LeaveType[]>{const client=db();const rows=await readAllBalanceRows((from,to)=>{let query=client.from("leave_types").select("*").order("name").order("id");if(activeOnly)query=query.eq("active",true);return query.range(from,to);},"Không thể đọc loại nghỉ.");return rows.map(mapType);}
export async function getLeavePolicy():Promise<LeavePolicy>{const {data,error}=await db().from("leave_policies").select("*").eq("active",true).maybeSingle();if(error||!data)throw new AppError("SERVER_ERROR","Chưa có chính sách nghỉ.");return{weekendDays:data.weekend_days,allowNegativeBalance:data.allow_negative_balance,allowWithdrawPending:data.allow_withdraw_pending,cancellationRequiresApproval:data.cancellation_requires_approval,carryoverEnabled:data.carryover_enabled,carryoverMaxDays:Number(data.carryover_max_days)};}

async function calculatedDays(client:SupabaseClient,input:z.infer<typeof leaveRequestInputSchema>,type:LeaveType){
  if(input.startDate>input.endDate)throw new AppError("VALIDATION_ERROR","Khoảng ngày nghỉ không hợp lệ.");
  leaveYearSchema.parse(Number(input.startDate.slice(0,4)));leaveYearSchema.parse(Number(input.endDate.slice(0,4)));
  if(type.deductsBalance&&input.startDate.slice(0,4)!==input.endDate.slice(0,4))throw new AppError("VALIDATION_ERROR","Đơn trừ phép qua năm cần tách theo từng năm.");
  if(type.requiresReason&&input.reason.trim().length<2)throw new AppError("VALIDATION_ERROR","Loại nghỉ này yêu cầu lý do.");
  if(input.startDate!==input.endDate&&!type.allowsMultiDay)throw new AppError("VALIDATION_ERROR","Loại nghỉ này không cho phép nghỉ nhiều ngày.");
  if((input.startDayPart!=="full_day"||input.endDayPart!=="full_day")&&!type.allowsHalfDay)throw new AppError("VALIDATION_ERROR","Loại nghỉ này không cho phép nghỉ nửa ngày.");
  if(input.startDate===input.endDate&&input.startDayPart!==input.endDayPart)throw new AppError("VALIDATION_ERROR","Một ngày chỉ được chọn một hình thức nghỉ.");
  const policy=await getLeavePolicy();const {data:holidays,error:holidayError}=await client.from("work_calendar_holidays").select("holiday_date").eq("active",true).gte("holiday_date",input.startDate).lte("holiday_date",input.endDate);
  if(holidayError)throw new AppError("SERVER_ERROR","Không thể đọc lịch ngày nghỉ.");
  const holidayDates=(holidays??[]).map(row=>row.holiday_date);const calendarInput={...input,weekendDays:policy.weekendDays,holidays:holidayDates};const days=calculateLeaveDays(calendarInput);if(!days)throw new AppError("VALIDATION_ERROR","Khoảng đã chọn không có ngày làm việc.");return{days,policy,calendarSnapshot:{weekendDays:policy.weekendDays,holidays:holidayDates,workingDates:calculateLeaveWorkingDates(calendarInput)}};
}

export async function listLeaveRequests(user:AuthenticatedUser,scope:"self"|"all"|"approval"|"team"="self",filters:z.infer<typeof leaveRequestFiltersSchema>={}):Promise<LeaveRequest[]>{
  const client=db();let employeeIds:string[]|undefined;
  if(scope==="self"){
    if(!can(user.permissions,"leave.self.view")&&!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");
    employeeIds=[(await identity(client,user)).employeeId];
  }else if(scope==="approval"){
    if(!can(user.permissions,"leave.approve")&&!can(user.permissions,"leave.approve_all"))throw new AppError("PERMISSION_DENIED");
  }else if(scope==="team"||(!can(user.permissions,"leave.view_all")&&!can(user.permissions,"leave.approve_all"))){
    if(!can(user.permissions,"leave.view_team")&&!can(user.permissions,"leave.view_all")&&!can(user.permissions,"leave.approve_all"))throw new AppError("PERMISSION_DENIED");
    const actor=await identity(client,user);
    const reports=await readAllBalanceRows((from,to)=>client.from("employees").select("id").eq("manager_employee_id",actor.employeeId).order("id").range(from,to),"Không thể xác định nhân viên trong nhóm.");
    employeeIds=[actor.employeeId,...reports.map(row=>required(row,"id"))];
  }
  if(filters.employeeId&&employeeIds&&!employeeIds.includes(filters.employeeId))throw new AppError("PERMISSION_DENIED");
  const rows=await readAllBalanceRows((from,to)=>{
    let query=client.from("leave_requests").select(requestSelect).order("created_at",{ascending:false}).order("id").range(from,to);
    if(employeeIds)query=query.in("employee_id",employeeIds);
    if(filters.employeeId)query=query.eq("employee_id",filters.employeeId);
    if(filters.leaveTypeId)query=query.eq("leave_type_id",filters.leaveTypeId);
    if(filters.startDate)query=query.gte("end_date",filters.startDate);
    if(filters.endDate)query=query.lte("start_date",filters.endDate);
    if(scope==="approval")query=query.in("status",["submitted","pending_approval"]);
    if(filters.status)query=query.eq("status",filters.status);
    return query;
  },"Không thể đọc danh sách đơn nghỉ.");
  const requests=rows.map(mapRequest);
  return scope==="approval"&&!can(user.permissions,"leave.approve_all")?requests.filter(item=>item.approvalSteps.find(step=>step.status==="pending")?.approverAccountId===user.id):requests;
}

export async function getLeaveRequest(user:AuthenticatedUser,id:string,scope:"all"|"self"="all"):Promise<LeaveRequest>{
  const client=db();const {data,error}=await client.from("leave_requests").select(requestSelect).eq("id",id).maybeSingle();
  if(error)throw new AppError("SERVER_ERROR","Không thể đọc đơn nghỉ.");if(!data)throw new AppError("NOT_FOUND","Không tìm thấy đơn nghỉ.");
  const request=mapRequest(data as Row);
  let accountQuery=client.from("app_accounts").select("employee_id").eq("status","active");
  accountQuery=/^[0-9a-f-]{36}$/i.test(user.id)?accountQuery.eq("id",user.id):accountQuery.eq("primary_email",user.email);
  const {data:account,error:accountError}=await accountQuery.maybeSingle();if(accountError)throw new AppError("SERVER_ERROR","Không thể xác định quyền với đơn nghỉ.");
  const owner=account?.employee_id===request.employeeId;
  if(scope==="self"&&!owner)throw new AppError("NOT_FOUND","Không tìm thấy đơn nghỉ.");
  const global=can(user.permissions,"leave.view_all")||can(user.permissions,"leave.approve_all");
  const assigned=request.approvalSteps.some(step=>step.approverAccountId===user.id);
  let team=false;
  if(!owner&&!global&&!assigned&&can(user.permissions,"leave.view_team")&&account?.employee_id){
    const {data:employee,error:employeeError}=await client.from("employees").select("manager_employee_id").eq("id",request.employeeId).maybeSingle();
    if(employeeError)throw new AppError("SERVER_ERROR","Không thể xác định phạm vi nghỉ phép.");
    team=employee?.manager_employee_id===account.employee_id;
  }
  if(!owner&&!global&&!assigned&&!team)throw new AppError("PERMISSION_DENIED");
  if(owner&&!global&&!assigned&&!can(user.permissions,"leave.self.view")&&!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");
  const policy=await getLeavePolicy();const pending=request.approvalSteps.find(step=>step.status==="pending");
  request.availableActions={
    submit:owner&&request.status==="draft"&&can(user.permissions,"leave.self.create"),
    edit:owner&&request.status==="draft"&&can(user.permissions,"leave.self.create"),
    withdraw:owner&&["submitted","pending_approval"].includes(request.status)&&policy.allowWithdrawPending&&can(user.permissions,"leave.self.withdraw"),
    cancel:request.status==="approved"&&(owner||can(user.permissions,"leave.view_all")||can(user.permissions,"leave.approve_all"))&&(!policy.cancellationRequiresApproval||can(user.permissions,"leave.approve_all")),
    approve:["submitted","pending_approval"].includes(request.status)&&Boolean(pending)&&(can(user.permissions,"leave.approve_all")||(pending?.approverAccountId===user.id&&can(user.permissions,"leave.approve"))),
    exportPdf:can(user.permissions,"leave.pdf.export_all")||(owner&&can(user.permissions,"leave.pdf.export_self"))
  };
  return request;
}

export async function getLeaveOrganizationSnapshot(user:AuthenticatedUser,id:string):Promise<Row|undefined>{await getLeaveRequest(user,id);const {data}=await db().from("leave_requests").select("organization_snapshot").eq("id",id).maybeSingle();const snapshot=data?.organization_snapshot as Row|undefined;return snapshot&&typeof snapshot.organization==="object"?snapshot.organization as Row:undefined;}

export async function getLeaveRequestForPdf(user:AuthenticatedUser,id:string):Promise<LeaveRequest>{const request=await getLeaveRequest(user,id);if(can(user.permissions,"leave.pdf.export_all")){await recordAuditLog({actorId:user.id,action:"leave.pdf_exported",entityType:"leave_request",entityId:id,metadata:{requestNumber:request.requestNumber}});return request;}const actor=await identity(db(),user);if(request.employeeId!==actor.employeeId||!can(user.permissions,"leave.pdf.export_self"))throw new AppError("PERMISSION_DENIED");await recordAuditLog({actorId:actor.accountId,action:"leave.pdf_exported",entityType:"leave_request",entityId:id,metadata:{requestNumber:request.requestNumber}});return request;}

export async function previewLeaveRequest(user:AuthenticatedUser,input:z.infer<typeof leaveRequestInputSchema>){if(!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=await identity(client,user);const type=(await listLeaveTypes()).find(item=>item.id===input.leaveTypeId&&item.active);if(!type)throw new AppError("VALIDATION_ERROR","Loại nghỉ không hoạt động.");const {days}=await calculatedDays(client,input,type);const balance=type.deductsBalance?await getEmployeeLeaveBalance(actor.employeeId,Number(input.startDate.slice(0,4)),type.id):undefined;return{days,balance};}

export async function getEmployeeLeaveBalance(employeeId:string,year:number,leaveTypeId:string):Promise<LeaveBalance>{
  leaveYearSchema.parse(year);
  const client=db();
  const [{data:employee,error:employeeError},{data:type,error:typeError},ledger,pending]=await Promise.all([
    client.from("employees").select("id,employee_code,full_name,department_id").eq("id",employeeId).single(),
    client.from("leave_types").select("id,name,code,deducts_balance").eq("id",leaveTypeId).single(),
    readAllBalanceRows((from,to)=>client.from("leave_ledger").select("*").eq("employee_id",employeeId).eq("leave_year",year).eq("leave_type_id",leaveTypeId).order("id").range(from,to),"Không thể tính số dư phép."),
    readAllBalanceRows((from,to)=>client.from("leave_requests").select("id,calculated_days,request_snapshot").eq("employee_id",employeeId).eq("leave_type_id",leaveTypeId).in("status",["submitted","pending_approval"]).gte("start_date",`${year}-01-01`).lte("start_date",`${year}-12-31`).order("id").range(from,to),"Không thể tính số dư phép.")
  ]);
  if(employeeError||typeError||!employee||!type)throw new AppError("SERVER_ERROR","Không thể tính số dư phép.");
  const {data:department,error:departmentError}=await client.from("departments").select("name").eq("id",employee.department_id).maybeSingle();if(departmentError)throw new AppError("SERVER_ERROR","Không thể đọc phòng ban.");
  const entries=ledger.map(row=>mapLedger(row,type.name));const summary=summarizeLedger(entries);
  return withPending({employeeId,employeeCode:employee.employee_code,employeeName:employee.full_name,departmentName:department?.name??"—",year,leaveTypeId,leaveTypeName:type.name,leaveTypeCode:type.code,...summary},pending.reduce((sum,row)=>{const snapshot=(row.request_snapshot??{}) as Row;const typeSnapshot=(snapshot.leaveTypeSnapshot??{}) as Row;const deducts=typeof typeSnapshot.deductsBalance==="boolean"?typeSnapshot.deductsBalance:Boolean(type.deducts_balance);return sum+(deducts?Number(row.calculated_days):0);},0));
}

export async function getMyLeaveBalances(user:AuthenticatedUser,year:number):Promise<{balances:LeaveBalance[];ledger:LeaveLedgerEntry[]}>{if(!can(user.permissions,"leave.balance.view_self")&&!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");leaveYearSchema.parse(year);const client=db();const actor=await identity(client,user);const types=await eligibleEmployeeBalanceTypes(client,actor.employeeId,year);const balances=await Promise.all(types.map(type=>getEmployeeLeaveBalance(actor.employeeId,year,type.id)));const ledger=await readAllBalanceRows((from,to)=>client.from("leave_ledger").select("*,leave_types(name)").eq("employee_id",actor.employeeId).eq("leave_year",year).order("effective_date",{ascending:false}).order("id").range(from,to),"Không thể đọc sổ phép.");return{balances,ledger:ledger.map(row=>mapLedger(row,required(nested(row,"leave_types")!,"name")))};}

async function assertRequestAvailability(client:SupabaseClient,actor:Identity,input:z.infer<typeof leaveRequestInputSchema>,type:LeaveType,days:number,policy:LeavePolicy,excludeId?:string){
  let query=client.from("leave_requests").select("id").eq("employee_id",actor.employeeId).in("status",["draft","submitted","pending_approval","approved"]).lte("start_date",input.endDate).gte("end_date",input.startDate).limit(1);if(excludeId)query=query.neq("id",excludeId);
  const {data:overlap,error:overlapError}=await query;if(overlapError)throw new AppError("SERVER_ERROR","Không thể kiểm tra lịch nghỉ trùng.");if(overlap?.length)throw new AppError("CONFLICT","Bạn đã có đơn nghỉ trong khoảng thời gian này.");
  if(type.deductsBalance&&!policy.allowNegativeBalance){const balance=await getEmployeeLeaveBalance(actor.employeeId,Number(input.startDate.slice(0,4)),type.id);if(balance.availableAfterPending<days)throw new AppError("CONFLICT","Số ngày phép không đủ.");}
}

export async function createLeaveRequest(user:AuthenticatedUser,input:z.infer<typeof leaveRequestInputSchema>):Promise<LeaveRequest>{if(!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=await identity(client,user);const type=(await listLeaveTypes()).find(item=>item.id===input.leaveTypeId&&item.active);if(!type)throw new AppError("VALIDATION_ERROR","Loại nghỉ không hoạt động.");const {days,policy,calendarSnapshot}=await calculatedDays(client,input,type);await assertRequestAvailability(client,actor,input,type,days,policy);
  const {data:projects,error:projectError}=await client.from("project_assignments").select("id").eq("employee_id",actor.employeeId).eq("status","active").lte("start_date",input.endDate).or(`end_date.is.null,end_date.gte.${input.startDate}`);if(projectError)throw new AppError("SERVER_ERROR","Không thể kiểm tra phân công dự án.");const warnings=projects?.length?["Có phân công dự án trong thời gian nghỉ."]:[];const snapshot={employeeCode:actor.employeeCode,employeeName:actor.employeeName,departmentName:actor.departmentName,positionName:actor.positionName};const {data,error}=await client.from("leave_requests").insert({employee_id:actor.employeeId,leave_type_id:type.id,start_date:input.startDate,end_date:input.endDate,start_day_part:input.startDayPart,end_day_part:input.endDayPart,calculated_days:days,reason:input.reason,employee_snapshot:snapshot,request_snapshot:{...input,calculatedDays:days,warnings,calendarSnapshot},created_by:actor.accountId}).select("id").single();if(error||!data)throw new AppError("SERVER_ERROR","Không thể tạo đơn nghỉ.");await client.from("leave_domain_events").insert({event_type:"leave.draft_created",aggregate_id:data.id,payload:{employeeId:actor.employeeId}});await recordAuditLog({actorId:actor.accountId,action:"leave.draft_created",entityType:"leave_request",entityId:data.id,after:{days,status:"draft"}});return getLeaveRequest(user,data.id);}

export async function updateLeaveRequest(user:AuthenticatedUser,id:string,input:z.infer<typeof leaveRequestUpdateSchema>):Promise<LeaveRequest>{if(!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=await identity(client,user);const current=await getLeaveRequest(user,id);if(current.employeeId!==actor.employeeId||current.status!=="draft")throw new AppError("CONFLICT","Chỉ có thể sửa đơn nháp của chính bạn.");if(current.version!==input.version)throw new AppError("CONFLICT","Đơn đã được cập nhật ở nơi khác.");const type=(await listLeaveTypes()).find(item=>item.id===input.leaveTypeId&&item.active);if(!type)throw new AppError("VALIDATION_ERROR","Loại nghỉ không hoạt động.");const {days,policy,calendarSnapshot}=await calculatedDays(client,input,type);await assertRequestAvailability(client,actor,input,type,days,policy,id);const {data:projects,error:projectError}=await client.from("project_assignments").select("id").eq("employee_id",actor.employeeId).eq("status","active").lte("start_date",input.endDate).or(`end_date.is.null,end_date.gte.${input.startDate}`);if(projectError)throw new AppError("SERVER_ERROR","Không thể kiểm tra phân công dự án.");const warnings=projects?.length?["Có phân công dự án trong thời gian nghỉ."]:[];const {data,error}=await client.from("leave_requests").update({leave_type_id:type.id,start_date:input.startDate,end_date:input.endDate,start_day_part:input.startDayPart,end_day_part:input.endDayPart,calculated_days:days,reason:input.reason,request_snapshot:{...input,calculatedDays:days,warnings,calendarSnapshot}}).eq("id",id).eq("version",input.version).eq("status","draft").select("id").maybeSingle();if(error||!data)throw new AppError("CONFLICT","Đơn đã được cập nhật ở nơi khác.");await recordAuditLog({actorId:actor.accountId,action:"leave.draft_updated",entityType:"leave_request",entityId:id});return getLeaveRequest(user,id);}

type ApproverOptions={accounts:{id:string;name:string;employeeCode?:string;username?:string;employeeId?:string}[];roles:{id:string;code:string;name:string}[]};
async function loadApproverOptions(client:SupabaseClient):Promise<ApproverOptions>{
  const permissions=await readAllBalanceRows((from,to)=>client.from("role_permissions").select("role_id,permission_key").in("permission_key",["leave.approve","leave.approve_all"]).order("role_id").order("permission_key").range(from,to),"Không thể đọc quyền người duyệt.");
  const roleIds=[...new Set(permissions.map(row=>required(row,"role_id")))];if(!roleIds.length)return{accounts:[],roles:[]};
  const [roles,members]=await Promise.all([
    readAllBalanceRows((from,to)=>client.from("roles").select("id,code,name").in("id",roleIds).order("code").order("id").range(from,to),"Không thể đọc vai trò người duyệt."),
    readAllBalanceRows((from,to)=>client.from("account_roles").select("account_id,role_id,account:app_accounts!account_roles_account_id_fkey!inner(id,display_name,username,status,employee_id,employees!app_accounts_employee_fk(employee_code))").in("role_id",roleIds).eq("account.status","active").order("account_id").order("role_id").range(from,to),"Không thể đọc người duyệt.")
  ]);
  const accounts=new Map<string,ApproverOptions["accounts"][number]>();
  for(const row of members){const account=nested(row,"account");if(!account)continue;const id=required(account,"id");accounts.set(id,{id,name:text(account,"display_name")??text(account,"username")??id,username:text(account,"username"),employeeId:text(account,"employee_id"),employeeCode:text(nested(account,"employees")??{},"employee_code")});}
  return{accounts:[...accounts.values()].sort((a,b)=>a.name.localeCompare(b.name,"vi")),roles:roles.map(row=>({id:required(row,"id"),code:required(row,"code"),name:required(row,"name")}))};
}

export async function listLeaveWorkflowApprovers(user:AuthenticatedUser){
  if(!can(user.permissions,"leave.workflow.manage"))throw new AppError("PERMISSION_DENIED");
  const options=await loadApproverOptions(db());return{accounts:options.accounts.map(({id,name,employeeCode,username})=>({id,name,employeeCode,username})),roles:options.roles.map(({code,name})=>({code,name}))};
}

async function resolveApprover(client:SupabaseClient,source:string,config:Row,actor:Identity,options:ApproverOptions):Promise<{id?:string;name?:string}>{
  let employeeId:string|undefined;let accountId:string|undefined;
  if(source==="direct_manager")employeeId=actor.managerEmployeeId;
  else if(source==="department_manager"){const {data,error}=await client.from("departments").select("manager_employee_id").eq("id",actor.departmentId).single();if(error)throw new AppError("SERVER_ERROR","Không thể đọc trưởng phòng.");employeeId=data?.manager_employee_id??undefined;}
  else if(source==="specific_user")accountId=text(config,"specific_account_id")??text((config.resolver_config??{}) as Row,"accountId");
  else{
    const resolver=(config.resolver_config??{}) as Row;const roleCode=source==="hr_role"||source==="hr_resolver"?"hr":text(config,"specific_role_code")??text(resolver,"roleCode");
    if(roleCode){
      const {data:role,error:roleError}=await client.from("roles").select("id").eq("code",roleCode).maybeSingle();if(roleError)throw new AppError("SERVER_ERROR","Không thể đọc vai trò người duyệt.");
      if(role){const members=await readAllBalanceRows((from,to)=>client.from("account_roles").select("account_id").eq("role_id",role.id).order("account_id").range(from,to),"Không thể đọc người duyệt theo vai trò.");const eligible=new Set(options.accounts.map(account=>account.id));const candidates=members.map(row=>required(row,"account_id")).filter(id=>eligible.has(id));accountId=candidates.find(id=>id!==actor.accountId)??candidates[0];}
    }
  }
  const account=employeeId?options.accounts.find(item=>item.employeeId===employeeId):options.accounts.find(item=>item.id===accountId);
  return account?{id:account.id,name:account.name}:{};
}

export async function submitLeaveRequest(user:AuthenticatedUser,id:string,version:number):Promise<LeaveRequest>{
  if(!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");
  const client=db();const actor=await identity(client,user);const request=await getLeaveRequest(user,id);
  if(request.employeeId!==actor.employeeId||request.status!=="draft")throw new AppError("CONFLICT","Đơn không còn ở trạng thái nháp.");
  if(request.version!==version)throw new AppError("CONFLICT","Đơn đã được cập nhật ở nơi khác.");
  const type=(await listLeaveTypes()).find(item=>item.id===request.leaveTypeId&&item.active);if(!type)throw new AppError("CONFLICT","Loại nghỉ không còn hoạt động.");
  if(type.requiresAttachment&&!request.attachments.length)throw new AppError("VALIDATION_ERROR","Loại nghỉ này yêu cầu tài liệu đính kèm.");
  const validationInput={leaveTypeId:request.leaveTypeId,startDate:request.startDate,endDate:request.endDate,startDayPart:request.startDayPart,endDayPart:request.endDayPart,reason:request.reason};
  const {days,policy,calendarSnapshot}=await calculatedDays(client,validationInput,type);if(days!==request.calculatedDays)throw new AppError("CONFLICT","Lịch làm việc đã thay đổi. Vui lòng cập nhật đơn.");
  const {data:overlap,error:overlapError}=await client.from("leave_requests").select("id").eq("employee_id",actor.employeeId).neq("id",id).in("status",["submitted","pending_approval","approved"]).lte("start_date",request.endDate).gte("end_date",request.startDate).limit(1);if(overlapError)throw new AppError("SERVER_ERROR","Không thể kiểm tra lịch nghỉ trùng.");if(overlap?.length)throw new AppError("CONFLICT","Bạn đã có đơn nghỉ trong khoảng thời gian này.");
  if(type.deductsBalance&&!policy.allowNegativeBalance){const balance=await getEmployeeLeaveBalance(actor.employeeId,Number(request.startDate.slice(0,4)),type.id);if(balance.availableAfterPending<days)throw new AppError("CONFLICT","Số ngày phép không đủ.");}
  const {data:sharedWorkflow,error:sharedError}=await client.from("approval_workflows").select("id,code,name,published_version").eq("id",type.workflowId).eq("active",true).maybeSingle();if(sharedError)throw new AppError("SERVER_ERROR","Không thể đọc quy trình duyệt.");
  let workflow:Row|undefined=sharedWorkflow as Row|undefined,definitions:Row[]=[];const workflowVersion=Number(sharedWorkflow?.published_version??1);
  if(sharedWorkflow){const{data:version,error:versionError}=await client.from("approval_workflow_versions").select("id,approval_workflow_steps(*)").eq("workflow_id",sharedWorkflow.id).eq("version",sharedWorkflow.published_version).eq("status","published").maybeSingle();if(versionError)throw new AppError("SERVER_ERROR","Không thể đọc phiên bản quy trình duyệt.");definitions=((version?.approval_workflow_steps??[]) as Row[]).sort((a,b)=>Number(a.step_order)-Number(b.step_order));}
  else{const{data:legacy,error:legacyError}=await client.from("leave_workflows").select("id,code,name,leave_workflow_steps(*)").eq("id",type.workflowId).eq("active",true).maybeSingle();if(legacyError)throw new AppError("SERVER_ERROR","Không thể đọc quy trình duyệt.");workflow=legacy as Row|undefined;definitions=((legacy?.leave_workflow_steps??[]) as Row[]).sort((a,b)=>Number(a.step_order)-Number(b.step_order));}
  if(!workflow)throw new AppError("CONFLICT","Chưa cấu hình quy trình duyệt.");if(!definitions.length)throw new AppError("CONFLICT","Quy trình chưa có bước duyệt.");
  const options=await loadApproverOptions(client);const steps=[];let missing=false;
  for(const definition of definitions){
    const sharedSource=String(definition.approver_source);
    if(!["direct_manager","department_manager","specific_user","specific_role","hr_role","hr_resolver"].includes(sharedSource)||definition.approval_mode==="all")throw new AppError("CONFLICT","Bước duyệt chưa được hỗ trợ cho đơn nghỉ.");
    const approver=await resolveApprover(client,sharedSource,definition,actor,options);const requiredStep=definition.required!==false;if(!approver.id&&requiredStep)missing=true;
    steps.push({step_order:definition.step_order,approver_source:sharedSource==="hr_resolver"?"hr_role":sharedSource,resolved_approver_account_id:approver.id??null,resolved_approver_name:approver.name??null,status:!approver.id&&!requiredStep?"skipped":"pending",snapshot:{source:sharedSource,required:requiredStep,approvalMode:"single"}});
  }
  if(!steps.some(step=>step.status==="pending"))throw new AppError("CONFLICT","Quy trình chưa có người duyệt.");
  const snapshot={id:workflow.id,code:workflow.code,name:workflow.name,version:workflowVersion,steps:steps.map(step=>step.snapshot)};
  const {error}=await client.rpc("submit_leave_request_command",{p_request_id:id,p_actor_id:actor.accountId,p_expected_version:version,p_workflow_snapshot:snapshot,p_request_snapshot:{...validationInput,calculatedDays:days,warnings:request.warnings,calendarSnapshot,leaveTypeSnapshot:{id:type.id,name:type.name,deductsBalance:type.deductsBalance,requiresReason:type.requiresReason,requiresAttachment:type.requiresAttachment}},p_steps:steps});
  if(error)throw leaveCommandError(error,"Không thể gửi đơn nghỉ.");
  const {data:approvalCase}=await client.from("approval_cases").select("id").eq("domain_type","LEAVE").eq("domain_id",id).maybeSingle();const firstApprover=steps.find(step=>step.status==="pending")?.resolved_approver_account_id;if(approvalCase&&firstApprover)await publishNotificationEvent({eventKey:"approval.required",aggregateType:"approval_case",aggregateId:approvalCase.id,actorAccountId:actor.accountId,idempotencyKey:`leave:${id}:submitted`,recipients:[firstApprover],values:{reference_number:request.requestNumber},deepLink:`/approvals/${approvalCase.id}`,priority:"important"},client);
  await recordAuditLog({actorId:actor.accountId,action:"leave.submitted",entityType:"leave_request",entityId:id,entityReference:request.requestNumber,after:{status:missing?"submitted":"pending_approval"}});return getLeaveRequest(user,id);
}

function leaveCommandError(error:{message:string;code?:string},fallback:string):AppError{
  if(error.message.includes("LEAVE_YEAR_SETTLED"))return new AppError("CONFLICT","Phép năm này đã được quyết toán vào lương. Không thể thay đổi số dư đã quyết toán.");
  if(error.message.includes("NOT_FOUND"))return new AppError("NOT_FOUND","Không tìm thấy đơn nghỉ hoặc quy trình.");
  if(error.message.includes("APPROVER_MISMATCH")||error.message.includes("ACTOR_DENIED"))return new AppError("PERMISSION_DENIED");
  if(error.message.includes("REJECT_REASON"))return new AppError("VALIDATION_ERROR","Cần nhập lý do từ chối.");
  if(error.message.includes("CANCEL_REASON"))return new AppError("VALIDATION_ERROR","Cần nhập lý do hủy đơn.");
  if(error.message.includes("BALANCE_INSUFFICIENT"))return new AppError("CONFLICT","Số ngày phép không đủ.");
  if(error.message.includes("OVERLAP"))return new AppError("CONFLICT","Bạn đã có đơn nghỉ trong khoảng thời gian này.");
  if(error.message.includes("CROSS_YEAR"))return new AppError("VALIDATION_ERROR","Đơn trừ phép qua năm cần tách theo từng năm.");
  if(error.message.includes("TIMESHEET_LOCKED"))return new AppError("CONFLICT","Kỳ công trong thời gian nghỉ đã khóa. Cần mở lại kỳ công trước khi duyệt hoặc hủy đơn.");
  if(error.message.includes("CALENDAR_CHANGED"))return new AppError("CONFLICT","Lịch làm việc đã thay đổi. Vui lòng cập nhật đơn.");
  if(error.message.includes("REASON_REQUIRED"))return new AppError("VALIDATION_ERROR","Loại nghỉ này yêu cầu lý do.");
  if(error.message.includes("ATTACHMENT_REQUIRED"))return new AppError("VALIDATION_ERROR","Loại nghỉ này yêu cầu tài liệu đính kèm.");
  if(error.message.includes("HALFDAY_DISABLED"))return new AppError("VALIDATION_ERROR","Loại nghỉ này không cho phép nghỉ nửa ngày.");
  if(error.message.includes("MULTIDAY_DISABLED"))return new AppError("VALIDATION_ERROR","Loại nghỉ này không cho phép nghỉ nhiều ngày.");
  if(error.message.includes("DAYPART_INVALID"))return new AppError("VALIDATION_ERROR","Một ngày chỉ được chọn một hình thức nghỉ.");
  if(error.message.includes("LEDGER_INPUT_INVALID"))return new AppError("VALIDATION_ERROR","Ngày hiệu lực phải thuộc năm phép; số ngày phép tối đa hai chữ số thập phân.");
  if(error.message.includes("LEDGER_REPLAY_CONFLICT"))return new AppError("CONFLICT","Chứng từ đã được ghi nhận với dữ liệu khác.");
  if(error.message.includes("VERSION_CONFLICT")||error.message.includes("STEP_CONFLICT")||error.message.includes("STATUS_CONFLICT"))return new AppError("CONFLICT","Đơn đã được cập nhật ở nơi khác. Vui lòng tải lại.");
  if(error.message.includes("WITHDRAW_DISABLED"))return new AppError("CONFLICT","Chính sách không cho phép thu hồi đơn đang duyệt.");
  if(error.message.includes("CANCEL_APPROVAL_REQUIRED"))return new AppError("CONFLICT","Chính sách yêu cầu HR phê duyệt việc hủy đơn.");
  if(error.message.includes("TARGET_INVALID")||error.message.includes("WORKFLOW_INVALID"))return new AppError("VALIDATION_ERROR","Người duyệt hoặc bước duyệt không hợp lệ.");
  if(error.code==="23505")return new AppError("CONFLICT","Mã hoặc chứng từ đã tồn tại.");
  return new AppError("SERVER_ERROR",fallback);
}

export async function decideLeaveRequest(user:AuthenticatedUser,id:string,action:"approve"|"reject",comment?:string,version?:number):Promise<LeaveRequest>{
  if(!can(user.permissions,"leave.approve")&&!can(user.permissions,"leave.approve_all"))throw new AppError("PERMISSION_DENIED");
  const client=db();const actor=managementActor(user);const request=await getLeaveRequest(user,id);const pending=request.approvalSteps.find(step=>step.status==="pending");
  if(!["submitted","pending_approval"].includes(request.status)||!pending)throw new AppError("CONFLICT","Đơn đã được xử lý.");
  if(version!==undefined&&request.version!==version)throw new AppError("CONFLICT","Đơn đã được cập nhật ở nơi khác. Vui lòng tải lại.");
  if(pending.approverAccountId!==actor.accountId&&!can(user.permissions,"leave.approve_all"))throw new AppError("PERMISSION_DENIED");
  const {error}=await client.rpc("process_leave_approval_command",{p_request_id:id,p_actor_id:actor.accountId,p_action:action,p_comment:comment??null,p_expected_version:version??request.version,p_expected_step_id:pending.id,p_override_assignee:can(user.permissions,"leave.approve_all")});
  if(error)throw leaveCommandError(error,"Không thể xử lý đơn nghỉ.");
  const updated=await getLeaveRequest(user,id);const next=updated.approvalSteps.find(step=>step.status==="pending");
  const {data:approvalCase}=await client.from("approval_cases").select("id,requester_account_id").eq("domain_type","LEAVE").eq("domain_id",id).maybeSingle();
  const recipients=next?.approverAccountId?[next.approverAccountId]:approvalCase?.requester_account_id?[String(approvalCase.requester_account_id)]:[];
  if(approvalCase&&recipients.length)await publishNotificationEvent({eventKey:next?"approval.required":action==="approve"?"approval.approved":"approval.rejected",aggregateType:"approval_case",aggregateId:approvalCase.id,actorAccountId:actor.accountId,idempotencyKey:`leave:${id}:${pending.id}:${action}`,recipients,values:{reference_number:request.requestNumber},deepLink:next?`/approvals/${approvalCase.id}`:`/leave/requests/${id}`,priority:next?"important":"normal"},client);
  await recordAuditLog({actorId:actor.accountId,action:action==="approve"?(updated.status==="approved"?"leave.approved":"leave.step_approved"):"leave.rejected",entityType:"leave_request",entityId:id,reason:comment,after:{status:updated.status,stepId:pending.id}});return updated;
}

export async function withdrawLeaveRequest(user:AuthenticatedUser,id:string,version:number):Promise<LeaveRequest>{if(!can(user.permissions,"leave.self.withdraw"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=await identity(client,user);const request=await getLeaveRequest(user,id);if(request.employeeId!==actor.employeeId||!["submitted","pending_approval"].includes(request.status))throw new AppError("CONFLICT","Đơn không thể thu hồi.");const {error}=await client.rpc("withdraw_leave_request_command",{p_request_id:id,p_actor_id:actor.accountId,p_expected_version:version});if(error)throw leaveCommandError(error,"Không thể thu hồi đơn nghỉ.");await recordAuditLog({actorId:actor.accountId,action:"leave.withdrawn",entityType:"leave_request",entityId:id});return getLeaveRequest(user,id);}

export async function cancelLeaveRequest(user:AuthenticatedUser,id:string,reason:string,version?:number):Promise<LeaveRequest>{const client=db();const request=await getLeaveRequest(user,id);const actor=managementActor(user);if(!can(user.permissions,"leave.view_all")&&!can(user.permissions,"leave.approve_all")){const self=await identity(client,user);if(request.employeeId!==self.employeeId)throw new AppError("PERMISSION_DENIED");}const policy=await getLeavePolicy();if(policy.cancellationRequiresApproval&&!can(user.permissions,"leave.approve_all"))throw new AppError("CONFLICT","Chính sách yêu cầu HR phê duyệt việc hủy đơn.");const {error}=await client.rpc("cancel_approved_leave_command",{p_request_id:id,p_actor_id:actor.accountId,p_reason:reason,p_expected_version:version??request.version});if(error)throw leaveCommandError(error,"Không thể hủy đơn nghỉ.");await recordAuditLog({actorId:actor.accountId,action:"leave.cancelled",entityType:"leave_request",entityId:id,reason});return getLeaveRequest(user,id);}

export async function postLeaveAdjustment(user:AuthenticatedUser,input:z.infer<typeof leaveAdjustmentSchema>):Promise<LeaveBalance>{if(!can(user.permissions,"leave.balance.adjust"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=managementActor(user);const transactionType=input.direction==="add"?"adjustment_add":"adjustment_subtract";const amount=input.direction==="add"?input.amount:-input.amount;const {error}=await client.rpc("post_leave_ledger_command",{p_employee_ids:[input.employeeId],p_year:input.year,p_leave_type_id:input.leaveTypeId,p_transaction_type:transactionType,p_amount:amount,p_reason:input.reason,p_effective_date:input.effectiveDate,p_idempotency_key:input.idempotencyKey,p_actor_id:actor.accountId});if(error)throw leaveCommandError(error,"Không thể điều chỉnh phép.");await recordAuditLog({actorId:actor.accountId,action:"leave.balance_adjusted",entityType:"leave_balance",entityId:`${input.employeeId}:${input.year}`,reason:input.reason,after:{amount,leaveTypeId:input.leaveTypeId}});return getEmployeeLeaveBalance(input.employeeId,input.year,input.leaveTypeId);}
export async function postLeaveGrant(user:AuthenticatedUser,input:z.infer<typeof leaveGrantSchema>):Promise<LeaveBalance[]>{if(!can(user.permissions,"leave.balance.adjust"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=managementActor(user);const employeeIds=[...new Set(input.employeeIds)].sort();const {error}=await client.rpc("post_leave_ledger_command",{p_employee_ids:employeeIds,p_year:input.year,p_leave_type_id:input.leaveTypeId,p_transaction_type:"grant",p_amount:input.amount,p_reason:input.reason,p_effective_date:`${input.year}-01-01`,p_idempotency_key:input.idempotencyKey,p_actor_id:actor.accountId});if(error)throw leaveCommandError(error,"Không thể cấp phép.");await recordAuditLog({actorId:actor.accountId,action:"leave.balance_granted",entityType:"leave_grant_batch",entityId:input.idempotencyKey,after:{count:employeeIds.length,amount:input.amount}});const selected=new Set(employeeIds);return(await readAllEmployeeLeaveBalances(input.year)).filter(balance=>selected.has(balance.employeeId)&&balance.leaveTypeId===input.leaveTypeId);}

const balanceReadPageSize = 500;
const balanceEmployeeStatuses = ["active", "probation", "pending_onboarding", "on_leave"];

async function readAllBalanceRows(
  query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
  errorMessage: string
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += balanceReadPageSize) {
    const { data, error } = await query(from, from + balanceReadPageSize - 1);
    if (error) throw new AppError("SERVER_ERROR", errorMessage);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < balanceReadPageSize) return rows;
  }
}

export async function listLeaveBalanceEmployees(user:AuthenticatedUser){
  if(!can(user.permissions,"leave.balance.adjust"))throw new AppError("PERMISSION_DENIED");const client=db();
  const [employees,departments]=await Promise.all([
    readAllBalanceRows((from,to)=>client.from("employees").select("id,employee_code,full_name,department_id,employment_status").in("employment_status",balanceEmployeeStatuses).order("full_name").order("id").range(from,to),"Không thể đọc nhân viên."),
    readAllBalanceRows((from,to)=>client.from("departments").select("id,name").order("id").range(from,to),"Không thể đọc phòng ban.")
  ]);
  const departmentNames=new Map(departments.map(row=>[required(row,"id"),required(row,"name")]));
  return employees.map(row=>({id:required(row,"id"),employeeCode:required(row,"employee_code"),fullName:required(row,"full_name"),displayName:required(row,"full_name"),departmentName:departmentNames.get(String(row.department_id))??"—",employmentStatus:required(row,"employment_status")}));
}

async function eligibleEmployeeBalanceTypes(client:SupabaseClient,employeeId:string,year:number):Promise<LeaveType[]>{
  const [types,ledger,requests]=await Promise.all([
    listLeaveTypes(),
    readAllBalanceRows((from,to)=>client.from("leave_ledger").select("id,leave_type_id").eq("employee_id",employeeId).eq("leave_year",year).order("id").range(from,to),"Không thể đọc sổ phép."),
    readAllBalanceRows((from,to)=>client.from("leave_requests").select("id,leave_type_id,request_snapshot").eq("employee_id",employeeId).gte("end_date",`${year}-01-01`).lte("start_date",`${year}-12-31`).order("id").range(from,to),"Không thể đọc lịch sử nghỉ phép.")
  ]);
  const ids=new Set(ledger.map(row=>required(row,"leave_type_id")));const byId=new Map(types.map(type=>[type.id,type]));
  for(const row of requests){const snapshot=(row.request_snapshot??{}) as Row;const typeSnapshot=(snapshot.leaveTypeSnapshot??{}) as Row;const typeId=required(row,"leave_type_id");if(Boolean(byId.get(typeId)?.deductsBalance)||typeSnapshot.deductsBalance===true)ids.add(typeId);}
  return types.filter(type=>type.active&&type.deductsBalance||ids.has(type.id));
}

async function readAllEmployeeLeaveBalances(year: number, includeInactive = false): Promise<LeaveBalance[]> {
  leaveYearSchema.parse(year);
  const client = db();
  // Read each source in bounded pages, rather than querying every employee/type
  // pair. Inner joins scope ledger/pending reads without a growing list of IDs.
  const [employees, catalogTypes, departments, ledger, requests] = await Promise.all([
    readAllBalanceRows((from, to) => client.from("employees")
      .select("id,employee_code,full_name,department_id")
      .in("employment_status", includeInactive ? [...balanceEmployeeStatuses,"terminated"] : balanceEmployeeStatuses).order("id").range(from, to),
    "Không thể đọc nhân sự."),
    readAllBalanceRows((from, to) => client.from("leave_types")
      .select("id,name,code,active,deducts_balance")
      .order("name").order("id").range(from, to),
    "Không thể đọc loại nghỉ."),
    readAllBalanceRows((from, to) => client.from("departments")
      .select("id,name").order("id").range(from, to),
    "Không thể đọc phòng ban."),
    readAllBalanceRows((from, to) => client.from("leave_ledger")
      .select("*,employees!inner(employment_status)")
      .eq("leave_year", year).in("employees.employment_status", includeInactive ? [...balanceEmployeeStatuses,"terminated"] : balanceEmployeeStatuses)
      .order("id").range(from, to),
    "Không thể tính số dư phép."),
    readAllBalanceRows((from, to) => client.from("leave_requests")
      .select("id,employee_id,leave_type_id,calculated_days,start_date,end_date,status,request_snapshot,employees!inner(employment_status)")
      .gte("end_date", `${year}-01-01`).lte("start_date", `${year}-12-31`)
      .in("employees.employment_status", includeInactive ? [...balanceEmployeeStatuses,"terminated"] : balanceEmployeeStatuses)
      .order("id").range(from, to),
    "Không thể tính số dư phép.")
  ]);

  const historicalTypeIds = new Set(ledger.map(row => required(row, "leave_type_id")));
  const catalogById = new Map(catalogTypes.map(type => [required(type, "id"), type]));
  for (const row of requests) if(Boolean(catalogById.get(required(row,"leave_type_id"))?.deducts_balance)||Boolean(((row.request_snapshot??{}) as Row).leaveTypeSnapshot&&(((row.request_snapshot as Row).leaveTypeSnapshot as Row).deductsBalance))) historicalTypeIds.add(required(row,"leave_type_id"));
  const types = catalogTypes.filter(type => Boolean(type.active) && Boolean(type.deducts_balance) || historicalTypeIds.has(required(type,"id")));

  const employeeIds = new Set(employees.map((employee) => required(employee, "id")));
  const typeNames = new Map(types.map((type) => [required(type, "id"), required(type, "name")]));
  const departmentNames = new Map(departments.map((department) => [required(department, "id"), department.name as string | null]));
  const entriesByBalance = new Map<string, LeaveLedgerEntry[]>();
  const pendingByBalance = new Map<string, number>();
  const balanceKey = (employeeId: string, leaveTypeId: string) => `${employeeId}:${leaveTypeId}`;

  for (const row of ledger) {
    const employeeId = required(row, "employee_id");
    const leaveTypeId = required(row, "leave_type_id");
    const typeName = typeNames.get(leaveTypeId);
    if (!employeeIds.has(employeeId) || !typeName) continue;
    const key = balanceKey(employeeId, leaveTypeId);
    const entries = entriesByBalance.get(key) ?? [];
    entries.push(mapLedger(row, typeName));
    entriesByBalance.set(key, entries);
  }
  for (const row of requests) {
    if(!["submitted","pending_approval"].includes(String(row.status))||!String(row.start_date).startsWith(`${year}-`))continue;
    const snapshot=(row.request_snapshot??{}) as Row;const typeSnapshot=(snapshot.leaveTypeSnapshot??{}) as Row;
    if(!(typeof typeSnapshot.deductsBalance==="boolean"?typeSnapshot.deductsBalance:Boolean(catalogById.get(required(row,"leave_type_id"))?.deducts_balance)))continue;
    const employeeId = required(row, "employee_id");
    const leaveTypeId = required(row, "leave_type_id");
    if (!employeeIds.has(employeeId) || !typeNames.has(leaveTypeId)) continue;
    const key = balanceKey(employeeId, leaveTypeId);
    pendingByBalance.set(key, (pendingByBalance.get(key) ?? 0) + Number(row.calculated_days));
  }

  return employees.flatMap((employee) => types.map((type) => {
    const employeeId = required(employee, "id");
    const leaveTypeId = required(type, "id");
    const key = balanceKey(employeeId, leaveTypeId);
    return withPending({
      employeeId,
      employeeCode: employee.employee_code as string,
      employeeName: employee.full_name as string,
      departmentName: departmentNames.get(String(employee.department_id)) ?? "—",
      year,
      leaveTypeId,
      leaveTypeName: required(type, "name"),
      leaveTypeCode: text(type, "code"),
      ...summarizeLedger(entriesByBalance.get(key) ?? [])
    }, pendingByBalance.get(key) ?? 0);
  })).sort((first, second) => first.employeeCode.localeCompare(second.employeeCode));
}

export async function listAllLeaveBalances(user:AuthenticatedUser,year:number,includeInactive=false):Promise<LeaveBalance[]>{if(!can(user.permissions,"leave.balance.view_all"))throw new AppError("PERMISSION_DENIED");return readAllEmployeeLeaveBalances(year,includeInactive);}

export async function getEmployeeLeaveBalances(user:AuthenticatedUser,employeeId:string,year:number):Promise<LeaveBalance[]>{if(!can(user.permissions,"leave.balance.view_all"))throw new AppError("PERMISSION_DENIED");leaveYearSchema.parse(year);const types=await eligibleEmployeeBalanceTypes(db(),employeeId,year);return Promise.all(types.map(type=>getEmployeeLeaveBalance(employeeId,year,type.id)));}

export async function getEmployeeLeaveLedger(user:AuthenticatedUser,employeeId:string,year:number):Promise<LeaveLedgerEntry[]>{if(!can(user.permissions,"leave.balance.view_all"))throw new AppError("PERMISSION_DENIED");leaveYearSchema.parse(year);const client=db();const [types,rows]=await Promise.all([listLeaveTypes(),readAllBalanceRows((from,to)=>client.from("leave_ledger").select("*").eq("employee_id",employeeId).eq("leave_year",year).order("effective_date",{ascending:false}).order("id").range(from,to),"Không thể đọc sổ phép.")]);const names=new Map(types.map(type=>[type.id,type.name]));return rows.map(row=>mapLedger(row,names.get(required(row,"leave_type_id"))??"—"));}

async function assertTypeWorkflow(client:SupabaseClient,workflowId:string,active:boolean){
  const {data:shared,error:sharedError}=await client.from("approval_workflows").select("id,active,domain_type").eq("id",workflowId).maybeSingle();if(sharedError)throw new AppError("SERVER_ERROR","Không thể đọc quy trình duyệt.");
  if(shared){if(shared.domain_type!=="LEAVE"||active&&!shared.active)throw new AppError("VALIDATION_ERROR","Chọn quy trình duyệt nghỉ đang hoạt động.");return;}
  const {data:legacy,error:legacyError}=await client.from("leave_workflows").select("id,active").eq("id",workflowId).maybeSingle();if(legacyError)throw new AppError("SERVER_ERROR","Không thể đọc quy trình duyệt.");
  if(!legacy||active&&!legacy.active)throw new AppError("VALIDATION_ERROR","Chọn quy trình duyệt nghỉ đang hoạt động.");
}

export async function createLeaveType(user:AuthenticatedUser,input:z.infer<typeof leaveTypeInputSchema>):Promise<LeaveType>{if(!can(user.permissions,"leave.type.manage"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=managementActor(user);await assertTypeWorkflow(client,input.workflowId,input.active);const {data,error}=await client.from("leave_types").insert({code:input.code,name:input.name,tone:input.tone,deducts_balance:input.deductsBalance,requires_reason:input.requiresReason,requires_attachment:input.requiresAttachment,allows_half_day:input.allowsHalfDay,allows_multi_day:input.allowsMultiDay,workflow_id:input.workflowId,active:input.active,created_by:actor.accountId}).select("*").single();if(error||!data)throw new AppError(error?.code==="23505"?"CONFLICT":"SERVER_ERROR",error?.code==="23505"?"Mã loại nghỉ đã tồn tại.":"Không thể tạo loại nghỉ.");await recordAuditLog({actorId:actor.accountId,action:"leave.type_created",entityType:"leave_type",entityId:data.id});return mapType(data as Row);}

export async function getApprovedLeaveForEmployeeDate(employeeId:string,date:string){const {data,error}=await db().from("leave_requests").select("id,request_number,leave_type_id,start_date,end_date,start_day_part,end_day_part,calculated_days,leave_types(name)").eq("employee_id",employeeId).eq("status","approved").lte("start_date",date).gte("end_date",date).maybeSingle();if(error)throw new AppError("SERVER_ERROR","Không thể kiểm tra nghỉ phép.");return data?{requestId:data.id,requestNumber:data.request_number,leaveTypeId:data.leave_type_id,leaveTypeName:required(nested(data as Row,"leave_types")!,"name"),dayPart:data.start_date===data.end_date?data.start_day_part:data.start_date===date?data.start_day_part:data.end_date===date?data.end_day_part:"full_day"}:undefined;}

export async function getApprovedLeaveForEmployeesDate(employeeIds:string[],date:string){if(!employeeIds.length)return new Map<string,{requestId:string;requestNumber:string;leaveTypeName:string;dayPart:string}>();const {data,error}=await db().from("leave_requests").select("id,employee_id,request_number,start_date,end_date,start_day_part,end_day_part,leave_types(name)").in("employee_id",employeeIds).eq("status","approved").lte("start_date",date).gte("end_date",date);if(error)throw new AppError("SERVER_ERROR","Không thể kiểm tra nghỉ phép.");return new Map((data??[]).map(row=>[row.employee_id,{requestId:row.id,requestNumber:row.request_number,leaveTypeName:required(nested(row as Row,"leave_types")!,"name"),dayPart:row.start_date===row.end_date?row.start_day_part:row.start_date===date?row.start_day_part:row.end_date===date?row.end_day_part:"full_day"}]));}

export async function updateLeaveType(user:AuthenticatedUser,id:string,input:z.infer<typeof leaveTypeInputSchema>):Promise<LeaveType>{if(!can(user.permissions,"leave.type.manage"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=managementActor(user);await assertTypeWorkflow(client,input.workflowId,input.active);const {data,error}=await client.from("leave_types").update({code:input.code,name:input.name,tone:input.tone,deducts_balance:input.deductsBalance,requires_reason:input.requiresReason,requires_attachment:input.requiresAttachment,allows_half_day:input.allowsHalfDay,allows_multi_day:input.allowsMultiDay,workflow_id:input.workflowId,active:input.active}).eq("id",id).select("*").maybeSingle();if(error||!data)throw new AppError(error?.code==="23505"?"CONFLICT":"NOT_FOUND",error?.code==="23505"?"Mã loại nghỉ đã tồn tại.":"Không tìm thấy loại nghỉ.");await recordAuditLog({actorId:actor.accountId,action:"leave.type_updated",entityType:"leave_type",entityId:id,after:input});return mapType(data as Row);}

export async function listLeaveWorkflows(user:AuthenticatedUser){
  if(!can(user.permissions,"leave.workflow.manage")&&!can(user.permissions,"leave.type.manage")&&!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");
  const client=db();const rows=await readAllBalanceRows((from,to)=>client.from("leave_workflows").select("id,code,name,active,leave_workflow_steps(id,step_order,approver_source,specific_account_id,specific_role_code,required,approval_mode,account:app_accounts!leave_workflow_steps_specific_account_id_fkey(display_name))").order("name").order("id").range(from,to),"Không thể đọc quy trình nghỉ.");
  const [roles,shared,options]=await Promise.all([
    readAllBalanceRows((from,to)=>client.from("roles").select("code,name").order("code").range(from,to),"Không thể đọc vai trò người duyệt."),
    readAllBalanceRows((from,to)=>client.from("approval_workflows").select("id,code,name,active,published_version,approval_workflow_versions(version,status,approval_workflow_steps(id,step_order,approver_source,resolver_config))").eq("domain_type","LEAVE").order("id").range(from,to),"Không thể đọc quy trình duyệt được phát hành."),
    loadApproverOptions(client)
  ]);
  const roleNames=new Map(roles.map(role=>[required(role,"code"),required(role,"name")]));const sharedById=new Map(shared.map(item=>[required(item,"id"),item]));const accountNames=new Map(options.accounts.map(account=>[account.id,account.name]));
  return rows.map(item=>{
    const published=sharedById.get(required(item,"id"));const version=published?Number(published.published_version):undefined;
    const currentVersion=((published?.approval_workflow_versions??[]) as Row[]).find(row=>Number(row.version)===version&&row.status==="published");
    const definitions=published?((currentVersion?.approval_workflow_steps??[]) as Row[]):((item.leave_workflow_steps??[]) as Row[]);
    return{id:required(item,"id"),code:required(published??item,"code"),name:required(published??item,"name"),active:Boolean((published??item).active),version,steps:definitions.sort((a,b)=>Number(a.step_order)-Number(b.step_order)).map(step=>{
      const resolver=(step.resolver_config??{}) as Row;const accountId=text(step,"specific_account_id")??text(resolver,"accountId");const roleCode=text(step,"specific_role_code")??text(resolver,"roleCode");const source=required(step,"approver_source");
      return{id:required(step,"id"),stepOrder:Number(step.step_order),approverSource:source==="hr_resolver"?"hr_role":source,specificAccountId:accountId,specificAccountName:text(nested(step,"account")??{},"display_name")??(accountId?accountNames.get(accountId):undefined),specificRoleCode:roleCode,specificRoleName:roleCode?roleNames.get(roleCode):undefined};
    })};
  });
}

async function saveLeaveWorkflow(user:AuthenticatedUser,input:z.infer<typeof leaveWorkflowInputSchema>,id?:string){
  if(!can(user.permissions,"leave.workflow.manage"))throw new AppError("PERMISSION_DENIED");const client=db();const actor=managementActor(user);const options=await loadApproverOptions(client);
  for(const step of input.steps){
    if(step.approverSource==="specific_user"&&!options.accounts.some(account=>account.id===step.specificAccountId))throw new AppError("VALIDATION_ERROR","Người duyệt không hoạt động hoặc chưa có quyền duyệt nghỉ.");
    if(step.approverSource==="specific_role"&&!options.roles.some(role=>role.code===step.specificRoleCode))throw new AppError("VALIDATION_ERROR","Vai trò chưa có quyền duyệt nghỉ.");
  }
  const {data,error}=await client.rpc("save_leave_workflow_command",{p_workflow_id:id??null,p_code:input.code,p_name:input.name,p_active:input.active,p_steps:input.steps,p_actor_id:actor.accountId,p_expected_version:input.version??null});
  if(error)throw leaveCommandError(error,"Không thể lưu quy trình nghỉ.");if(typeof data!=="string")throw new AppError("SERVER_ERROR","Kết quả lưu quy trình không hợp lệ.");
  await recordAuditLog({actorId:actor.accountId,action:id?"leave.workflow_updated":"leave.workflow_created",entityType:"leave_workflow",entityId:data,after:{code:input.code,name:input.name,active:input.active,stepCount:input.steps.length}});
  return(await listLeaveWorkflows(user)).find(item=>item.id===data)!;
}

export async function createLeaveWorkflow(user:AuthenticatedUser,input:z.infer<typeof leaveWorkflowInputSchema>){return saveLeaveWorkflow(user,input);}
export async function updateLeaveWorkflow(user:AuthenticatedUser,id:string,input:z.infer<typeof leaveWorkflowInputSchema>){return saveLeaveWorkflow(user,input,id);}

export async function updateLeavePolicy(user:AuthenticatedUser,input:z.infer<typeof leavePolicyInputSchema>):Promise<LeavePolicy>{
  if(!can(user.permissions,"leave.policy.manage"))throw new AppError("PERMISSION_DENIED");
  const client=db();const actor=managementActor(user);
  const {data:current,error:currentError}=await client.from("leave_policies").select("id").eq("active",true).maybeSingle();if(currentError)throw new AppError("SERVER_ERROR","Không thể đọc chính sách nghỉ.");
  if(!current)throw new AppError("NOT_FOUND","Chưa có chính sách nghỉ đang áp dụng.");
  const {error}=await client.from("leave_policies").update({weekend_days:input.weekendDays,allow_negative_balance:input.allowNegativeBalance,allow_withdraw_pending:input.allowWithdrawPending,cancellation_requires_approval:input.cancellationRequiresApproval,carryover_enabled:false,carryover_max_days:0,updated_by:actor.accountId}).eq("id",current.id);
  if(error)throw new AppError("SERVER_ERROR","Không thể lưu chính sách nghỉ.");
  await recordAuditLog({actorId:actor.accountId,action:"leave.policy_updated",entityType:"leave_policy",entityId:current.id,after:input});
  return getLeavePolicy();
}

function attachmentExtension(mime:string){return mime==="application/pdf"?"pdf":mime==="image/png"?"png":"jpg";}
async function validateLeaveAttachment(file:File){
  if(!["application/pdf","image/png","image/jpeg"].includes(file.type)||file.size<=0||file.size>5*1024*1024)throw new AppError("VALIDATION_ERROR","Chỉ nhận PDF, PNG, JPG tối đa 5 MB.");
  const bytes=new Uint8Array(await file.arrayBuffer());
  const valid=file.type==="application/pdf"?new TextDecoder().decode(bytes.slice(0,5))==="%PDF-":file.type==="image/png"?bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47:bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(!valid)throw new AppError("VALIDATION_ERROR","Nội dung tệp không đúng định dạng.");return bytes;
}

export async function uploadLeaveAttachment(user:AuthenticatedUser,requestId:string,file:File){
  if(!can(user.permissions,"leave.self.create"))throw new AppError("PERMISSION_DENIED");
  const client=db();const actor=await identity(client,user);const request=await getLeaveRequest(user,requestId);
  if(request.employeeId!==actor.employeeId||request.status!=="draft")throw new AppError("CONFLICT","Chỉ có thể đính kèm vào đơn nháp của bạn.");
  const bytes=await validateLeaveAttachment(file);const assetId=crypto.randomUUID();const path=`${new Date().getFullYear()}/${requestId}/${assetId}.${attachmentExtension(file.type)}`;
  const {error:uploadError}=await client.storage.from("leave-attachments").upload(path,bytes,{contentType:file.type,upsert:false});if(uploadError)throw new AppError("SERVER_ERROR","Không thể tải tệp lên.");
  const safeName=file.name.replace(/[\\/:*?"<>|]/g,"_").slice(0,180)||`tai-lieu.${attachmentExtension(file.type)}`;
  const {error:assetError}=await client.from("file_assets").insert({id:assetId,bucket:"leave-attachments",object_path:path,owner_entity_type:"leave_request",owner_entity_id:requestId,mime_type:file.type,byte_size:file.size,created_by:actor.accountId});
  if(assetError){await client.storage.from("leave-attachments").remove([path]);throw new AppError("SERVER_ERROR","Không thể lưu tệp đính kèm.");}
  const {data,error}=await client.from("leave_request_attachments").insert({request_id:requestId,file_id:assetId,file_name:safeName}).select("id,created_at").single();
  if(error||!data){await client.storage.from("leave-attachments").remove([path]);throw new AppError("SERVER_ERROR","Không thể liên kết tệp đính kèm.");}
  await client.from("leave_requests").update({updated_at:new Date().toISOString()}).eq("id",requestId);
  await recordAuditLog({actorId:actor.accountId,action:"leave.attachment_uploaded",entityType:"leave_request",entityId:requestId,after:{fileName:safeName,mimeType:file.type,byteSize:file.size}});
  return{id:data.id,fileName:safeName,createdAt:data.created_at};
}

export async function getLeaveAttachmentAsset(user:AuthenticatedUser,requestId:string,attachmentId:string){
  await getLeaveRequest(user,requestId);const {data,error}=await db().from("leave_request_attachments").select("file_name,file_assets!leave_request_attachments_file_id_fkey(bucket,object_path,mime_type)").eq("id",attachmentId).eq("request_id",requestId).maybeSingle();
  if(error||!data)throw new AppError("NOT_FOUND","Không tìm thấy tệp đính kèm.");const asset=nested(data as Row,"file_assets");if(!asset)throw new AppError("NOT_FOUND");return{fileName:data.file_name,bucket:required(asset,"bucket"),path:required(asset,"object_path"),mimeType:required(asset,"mime_type")};
}
