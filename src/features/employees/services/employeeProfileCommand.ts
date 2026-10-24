import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatchEmployeeInput } from "@/features/employees/schemas/employeeSchemas";
import { normalizePhone } from "@/features/employees/services/employeeService";
import { AppError } from "@/lib/api/errors";
import { getBusinessDateKey } from "@/lib/time/timezone";

const profileColumns = {
  employeeCode: "employee_code", fullName: "full_name", displayName: "display_name",
  dateOfBirth: "date_of_birth", gender: "gender", personalPhone: "personal_phone",
  personalEmail: "personal_email", companyEmail: "company_email", departmentId: "department_id",
  positionId: "position_id", employmentTypeId: "employment_type_id", managerEmployeeId: "manager_employee_id",
  joinDate: "join_date", probationStartDate: "probation_start_date", probationEndDate: "probation_end_date",
  officialDate: "official_date", employmentStatus: "employment_status", currentAddress: "current_address",
  permanentAddress: "permanent_address", province: "province", contractorName: "contractor_name",
  maritalStatus: "marital_status", note: "note", terminationDate: "termination_date", terminationReason: "termination_reason"
} as const;

export function employeeProfileCommandError(error: { code?: string; message?: string }): AppError {
  switch (error.message) {
    case "EMPLOYEE_NOT_FOUND": return new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
    case "EMPLOYEE_VERSION_CONFLICT": return new AppError("CONFLICT", "Hồ sơ đã thay đổi. Vui lòng tải lại trước khi lưu.");
    case "LAST_ACTIVE_ADMIN": return new AppError("CONFLICT", "Không thể cho quản trị viên hoạt động cuối cùng nghỉ việc.");
    case "EMPLOYEE_REHIRE_REQUIRED": return new AppError("CONFLICT", "Hồ sơ đã nghỉ việc cần được xử lý theo quy trình tái tuyển dụng.");
    case "EMPLOYEE_ACTOR_FORBIDDEN": return new AppError("PERMISSION_DENIED");
    case "EMPLOYEE_OFFBOARD_DETAILS_REQUIRED": return new AppError("VALIDATION_ERROR", "Cần nhập ngày nghỉ việc và lý do hợp lệ.");
    case "EMPLOYEE_INVALID_DATES": return new AppError("VALIDATION_ERROR", "Các ngày trong hồ sơ nhân sự chưa hợp lệ.");
    case "EMPLOYEE_INVALID_PATCH": return new AppError("VALIDATION_ERROR", "Thay đổi hồ sơ hoặc phiên bản không hợp lệ.");
  }
  if (error.code === "23505") return new AppError("CONFLICT", "Mã hoặc thông tin định danh đã tồn tại.");
  if (error.code === "23503") return new AppError("VALIDATION_ERROR", "Dữ liệu tham chiếu không còn tồn tại.");
  if (error.code === "23514" || error.code === "23502" || error.code?.startsWith("22")) {
    return new AppError("VALIDATION_ERROR", "Dữ liệu hồ sơ nhân sự chưa hợp lệ.");
  }
  return new AppError("NETWORK_ERROR", "Chưa thể xác nhận thay đổi. Vui lòng tải lại hồ sơ để kiểm tra trước khi lưu tiếp.");
}

/** A single database command owns profile, offboarding, sessions, history and audit. */
export async function executeEmployeeProfileCommand(client: SupabaseClient, id: string, input: PatchEmployeeInput, actorId: string): Promise<number> {
  if (!Number.isInteger(input.rowVersion) || input.rowVersion < 1 || input.rowVersion > 2_147_483_646) {
    throw new AppError("VALIDATION_ERROR", "Cần tải phiên bản hồ sơ hợp lệ trước khi lưu.");
  }
  const patch: Record<string, string | null> = {};
  for (const [key, column] of Object.entries(profileColumns)) {
    const value = input[key as keyof typeof profileColumns];
    if (value !== undefined) patch[column] = value === null ? null : value.trim() || null;
  }
  if (input.personalPhone !== undefined) patch.normalized_phone = input.personalPhone ? normalizePhone(input.personalPhone) : null;
  if (Object.keys(patch).length === 0) throw new AppError("VALIDATION_ERROR", "Chưa có thay đổi hồ sơ.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const { data, error } = await client.rpc("patch_employee_profile_command", {
      p_employee_id: id,
      p_expected_row_version: input.rowVersion,
      p_patch: patch,
      p_actor_id: actorId,
      p_event_date: input.terminationDate || getBusinessDateKey(),
      p_reason: input.reason || input.terminationReason || null
    }).abortSignal(controller.signal);
    if (error) throw employeeProfileCommandError(error);
    if (!Number.isInteger(data) || data !== input.rowVersion + 1) {
      throw new AppError("NETWORK_ERROR", "Chưa thể xác nhận thay đổi. Vui lòng tải lại hồ sơ để kiểm tra trước khi lưu tiếp.");
    }
    return data as number;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw employeeProfileCommandError({});
  } finally {
    clearTimeout(timer);
  }
}
