import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveEmployeeSchema, sensitiveProfilePatchSchema, type ArchiveEmployeeInput, type SensitiveProfilePatchInput } from "@/features/employees/schemas/employeeSchemas";
import { employeeProfileCommandError } from "@/features/employees/services/employeeProfileCommand";
import { AppError } from "@/lib/api/errors";
import { getBusinessDateKey } from "@/lib/time/timezone";

const sensitiveColumns = {
  nationalIdNumber: "national_id_number", nationalIdIssuedDate: "national_id_issued_date",
  nationalIdIssuedPlace: "national_id_issued_place", nationalIdExpiryDate: "national_id_expiry_date",
  bankName: "bank_name", bankAccountNumber: "bank_account_number", bankAccountHolder: "bank_account_holder",
  bankBranch: "bank_branch", personalTaxCode: "personal_tax_code", socialInsuranceCode: "social_insurance_code"
} as const;

function commandError(error: { code?: string; message?: string }) {
  if (error.message === "EMPLOYEE_ALREADY_ARCHIVED") return new AppError("CONFLICT", "Hồ sơ đã được lưu trữ. Vui lòng tải lại.");
  if (error.message === "LAST_ACTIVE_ADMIN") return new AppError("CONFLICT", "Không thể lưu trữ quản trị viên hoạt động cuối cùng.");
  return employeeProfileCommandError(error);
}

async function execute(client: SupabaseClient, name: string, input: { rowVersion: number; reason: string }, params: Record<string, unknown>): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const { data, error } = await client.rpc(name, params).abortSignal(controller.signal);
    if (error) throw commandError(error);
    if (!Number.isInteger(data) || data !== input.rowVersion + 1) throw employeeProfileCommandError({});
    return data as number;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw commandError({});
  } finally {
    clearTimeout(timer);
  }
}

/** One database transaction owns sensitive data, shared version, history and audit. */
export async function executeEmployeeSensitiveCommand(client: SupabaseClient, id: string, input: SensitiveProfilePatchInput, actorId: string): Promise<number> {
  const result = sensitiveProfilePatchSchema.safeParse(input);
  if (!result.success) throw new AppError("VALIDATION_ERROR", "Thông tin nhạy cảm, lý do hoặc phiên bản không hợp lệ.");
  const parsed = result.data;
  const patch: Record<string, string | null> = {};
  for (const [field, column] of Object.entries(sensitiveColumns)) {
    const value = parsed[field as keyof typeof sensitiveColumns];
    if (value !== undefined) patch[column] = value;
  }
  return execute(client, "patch_employee_sensitive_command", parsed, {
    p_employee_id: id, p_expected_row_version: parsed.rowVersion, p_patch: patch,
    p_actor_id: actorId, p_event_date: getBusinessDateKey(), p_reason: parsed.reason
  });
}

/** Standalone archive preserves employment dates while revoking linked access. */
export async function executeArchiveEmployeeCommand(client: SupabaseClient, id: string, input: ArchiveEmployeeInput, actorId: string): Promise<number> {
  const result = archiveEmployeeSchema.safeParse(input);
  if (!result.success) throw new AppError("VALIDATION_ERROR", "Lý do hoặc phiên bản lưu trữ không hợp lệ.");
  const parsed = result.data;
  return execute(client, "archive_employee_command", parsed, {
    p_employee_id: id, p_expected_row_version: parsed.rowVersion,
    p_actor_id: actorId, p_event_date: getBusinessDateKey(), p_reason: parsed.reason
  });
}
