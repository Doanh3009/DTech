import "server-only";
import type {AccountRolesPatchInput,AccountStatusPatchInput,CreateEmployeeInput,PatchEmployeeInput,SensitiveProfilePatchInput,ArchiveEmployeeInput} from "@/features/employees/schemas/employeeSchemas";
import {normalizePhone} from "@/features/employees/services/employeeService";import {AppError} from "@/lib/api/errors";import {getSupabaseServiceClient} from "@/lib/supabase/server";
import {getBusinessDateKey} from "@/lib/time/timezone";
import {executeEmployeeSensitiveCommand,executeArchiveEmployeeCommand} from "@/features/employees/services/employeeAuxiliaryCommands";
import {executeEmployeeProfileCommand} from "@/features/employees/services/employeeProfileCommand";
import {accountLifecycleCommandError} from "@/features/employees/services/accountLifecycleCommandError";
function db(){const client=getSupabaseServiceClient();if(!client)throw new AppError("SERVER_ERROR","Supabase chưa được cấu hình.");return client;}
function optional(value:string|undefined){return value?.trim()||null;}
function databaseError(error:{code?:string;message?:string}|null,message="Không thể lưu dữ liệu."){if(error?.code==="23505")return new AppError("CONFLICT","Mã/email/số định danh đã tồn tại.");if(error?.code==="23503")return new AppError("VALIDATION_ERROR","Dữ liệu tham chiếu không tồn tại.");return new AppError("SERVER_ERROR",message);}

export async function createEmployee(input:CreateEmployeeInput,actorId:string){const joinDate=input.joinDate??input.probationStartDate??input.officialDate??getBusinessDateKey();const employee={employee_code:input.employeeCode.trim(),full_name:input.fullName.trim(),display_name:optional(input.displayName)||input.fullName.trim(),date_of_birth:input.dateOfBirth||"",gender:input.gender||"",personal_phone:optional(input.personalPhone)||"",normalized_phone:input.personalPhone?normalizePhone(input.personalPhone):"",personal_email:optional(input.personalEmail)||"",company_email:optional(input.companyEmail)||"",current_address:optional(input.currentAddress)||"",permanent_address:optional(input.permanentAddress)||"",province:optional(input.province)||"",country:"Việt Nam",department_id:input.departmentId,position_id:input.positionId,employment_type_id:input.employmentTypeId,manager_employee_id:input.managerEmployeeId||"",contractor_name:"",join_date:joinDate,probation_start_date:input.probationStartDate||"",probation_end_date:input.probationEndDate||"",official_date:input.officialDate||"",employment_status:input.employmentStatus,marital_status:optional(input.maritalStatus)||"",note:optional(input.note)||""};const sensitive=input.nationalIdNumber||input.nationalIdIssuedDate||input.nationalIdIssuedPlace||input.personalTaxCode?{national_id_number:optional(input.nationalIdNumber)||"",national_id_issued_date:input.nationalIdIssuedDate||"",national_id_issued_place:optional(input.nationalIdIssuedPlace)||"",personal_tax_code:optional(input.personalTaxCode)||""}:{};const emergency=input.emergencyContactName||input.emergencyContactPhone||input.emergencyContactRelation?{full_name:optional(input.emergencyContactName)||"",relation:optional(input.emergencyContactRelation)||"",phone:optional(input.emergencyContactPhone)||""}:{};const{data,error}=await db().rpc("create_employee_profile",{p_employee:employee,p_sensitive:sensitive,p_emergency:emergency,p_actor_id:actorId});if(error||!data)throw databaseError(error);return String(data);}

export async function patchEmployee(id: string, input: PatchEmployeeInput, actorId: string) {
  return executeEmployeeProfileCommand(db(), id, input, actorId);
}

export async function updateSensitiveProfile(id:string,input:SensitiveProfilePatchInput,actorId:string){return executeEmployeeSensitiveCommand(db(),id,input,actorId);}

export async function archiveEmployee(id:string,input:ArchiveEmployeeInput,actorId:string){return executeArchiveEmployeeCommand(db(),id,input,actorId);}

export { provisionAccountLifecycle as provisionAccount, deleteAccountLifecycle as deleteAccount } from "@/features/employees/services/accountLifecycleService";

export async function setAccountStatus(accountId:string,input:AccountStatusPatchInput,actorId:string){const client=db();const{data,error}=await client.rpc("set_app_account_status",{p_account_id:accountId,p_status:input.status,p_actor_id:actorId,p_reason:input.reason||null});if(error)throw accountLifecycleCommandError(error);return data;}
export async function replaceAccountRoles(accountId:string,input:AccountRolesPatchInput,actorId:string){const{error}=await db().rpc("replace_app_account_roles",{p_account_id:accountId,p_role_ids:[...new Set(input.roleIds)],p_actor_id:actorId});if(error)throw accountLifecycleCommandError(error);}
