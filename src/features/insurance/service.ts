import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";
import type { insuranceContributionInputSchema, insuranceInputSchema } from "./schema";
import type { InsuranceContribution, InsurancePaymentStatus, InsuranceRecord } from "./sharedtypes";

type Row = Record<string, unknown>;
function db() { const client = getSupabaseServiceClient(); if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình."); return client; }
function requirePermission(user: AuthenticatedUser, permission: "insurance.view" | "insurance.edit" | "insurance.history.view" | "insurance.document.upload") { if (!can(user.permissions, permission)) throw new AppError("PERMISSION_DENIED"); }
async function accountId(client: SupabaseClient, user: AuthenticatedUser) { let query = client.from("app_accounts").select("id").limit(1); query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email); const { data, error } = await query.maybeSingle(); if (error) throw new AppError("SERVER_ERROR", "Không thể xác định tài khoản."); if (!data?.id) throw new AppError("PERMISSION_DENIED"); return String(data.id); }
function nested(value: unknown): Row | undefined { return (Array.isArray(value) ? value[0] : value) as Row | undefined; }
async function allRows(query: (start: number, end: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>, message: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await query(start, start + 499);
    if (error) throw new AppError("SERVER_ERROR", message);
    result.push(...(data ?? []) as Row[]);
    if (!data || data.length < 500) return result;
  }
}

export async function listInsurance(user: AuthenticatedUser, employeeId?: string) {
  requirePermission(user, "insurance.view");
  const client = db();
  const canViewHistory = can(user.permissions, "insurance.history.view"), canViewDocument = can(user.permissions, "insurance.document.view");
  const [profiles, employees, events, contributionRows] = await Promise.all([
    allRows((start, end) => { let query = client.from("employee_insurance_profiles").select("*,employees(employee_code,full_name)"); if (employeeId) query = query.eq("employee_id", employeeId); return query.order("updated_at", { ascending: false }).order("employee_id").range(start, end); }, "Không thể đọc hồ sơ bảo hiểm."),
    employeeId ? Promise.resolve([]) : allRows((start, end) => client.from("employees").select("id,employee_code,full_name").in("employment_status", ["active", "probation", "pending_onboarding", "on_leave"]).order("employee_code").order("id").range(start, end), "Không thể đọc nhân viên."),
    canViewHistory ? allRows((start, end) => { let query = client.from("employee_insurance_events").select("*,app_accounts(display_name),file_assets(id,metadata)"); if (employeeId) query = query.eq("employee_id", employeeId); return query.order("effective_date", { ascending: false }).order("changed_at", { ascending: false }).order("id").range(start, end); }, "Không thể đọc lịch sử bảo hiểm.") : Promise.resolve([]),
    allRows((start, end) => { let query = client.from("employee_insurance_contributions").select("*"); if (employeeId) query = query.eq("employee_id", employeeId); return query.order("contribution_month", { ascending: false }).order("employee_id").range(start, end); }, "Không thể đọc quá trình đóng bảo hiểm.")
  ]);
  const contributions = contributionRows.map(mapContribution);
  const history = events.map((event) => { const actor = nested(event.app_accounts), file = nested(event.file_assets), metadata = (file?.metadata ?? {}) as Row; return { id: String(event.id), employeeId: String(event.employee_id), changeType: String(event.change_type), effectiveDate: String(event.effective_date), reason: String(event.reason), changedAt: String(event.changed_at), changedByName: String(actor?.display_name ?? "Tài khoản hệ thống"), snapshot: event.snapshot as Row, fileId: canViewDocument && file?.id ? String(file.id) : undefined, fileName: canViewDocument && file?.id ? String(metadata.originalName ?? "Tài liệu bảo hiểm") : undefined }; });
  return {
    canViewHistory,
    records: (profiles ?? []).map((profile): InsuranceRecord => { const person = nested(profile.employees); return { employeeId: String(profile.employee_id), employeeCode: String(person?.employee_code ?? "—"), employeeName: String(person?.full_name ?? "—"), socialInsuranceNumber: String(profile.social_insurance_number), participationStatus: String(profile.participation_status) as InsuranceRecord["participationStatus"], startDate: profile.start_date ? String(profile.start_date) : undefined, contributionBase: profile.contribution_base == null ? undefined : Number(profile.contribution_base), contributionRatePercent: profile.contribution_rate_percent == null ? undefined : Number(profile.contribution_rate_percent), contributionMonth: profile.contribution_month ? String(profile.contribution_month).slice(0, 7) : undefined, paymentStatus: String(profile.payment_status ?? "pending") as InsurancePaymentStatus, socialInsuranceEnabled: Boolean(profile.social_insurance_enabled), healthInsuranceEnabled: Boolean(profile.health_insurance_enabled), unemploymentInsuranceEnabled: Boolean(profile.unemployment_insurance_enabled), updatedAt: String(profile.updated_at), history: history.filter((event) => event.employeeId === profile.employee_id), contributions: contributions.filter((entry) => entry.employeeId === profile.employee_id) }; }),
    employees: (employees ?? []).map((employee) => ({ id: String(employee.id), code: String(employee.employee_code), name: String(employee.full_name) }))
  };
}

export async function getInsuranceDetail(user: AuthenticatedUser, employeeId: string) {
  const result = await listInsurance(user, employeeId);
  const record = result.records.find((entry) => entry.employeeId === employeeId);
  if (!record) throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ bảo hiểm.");
  return record;
}

function mapContribution(row: Row): InsuranceContribution {
  return {
    id: String(row.id), employeeId: String(row.employee_id), contributionMonth: String(row.contribution_month).slice(0, 7),
    contributionBase: row.contribution_base == null ? undefined : Number(row.contribution_base),
    contributionRatePercent: row.contribution_rate_percent == null ? undefined : Number(row.contribution_rate_percent),
    expectedAmount: row.expected_amount == null ? undefined : Number(row.expected_amount),
    paidAmount: row.paid_amount == null ? undefined : Number(row.paid_amount),
    paymentStatus: String(row.payment_status) as InsurancePaymentStatus,
    paidDate: row.paid_date ? String(row.paid_date) : undefined, note: row.note ? String(row.note) : undefined,
    updatedAt: String(row.updated_at), source: row.source === "legacy_profile" ? "legacy_profile" : "recorded"
  };
}

export async function saveInsuranceContribution(user: AuthenticatedUser, input: z.infer<typeof insuranceContributionInputSchema>) {
  requirePermission(user, "insurance.edit");
  const client = db(), actorId = await accountId(client, user), commandId = crypto.randomUUID();
  const { data, error } = await client.rpc("save_insurance_contribution_command", {
    p_command_id: commandId, p_employee_id: input.employeeId, p_actor_id: actorId,
    p_values: input, p_expected_updated_at: input.expectedUpdatedAt ?? null
  });
  if (error) {
    // The command and audit commit together. A lost transport response must not
    // invite a second write after an already successful save.
    const { data: committed } = await client.from("employee_insurance_contribution_commands").select("contribution_id").eq("id", commandId).eq("actor_id", actorId).maybeSingle();
    if (committed?.contribution_id) return { contributionId: String(committed.contribution_id) };
    if (error.message.includes("VERSION_CONFLICT")) throw new AppError("CONFLICT", "Kỳ đóng bảo hiểm đã thay đổi. Vui lòng tải lại.");
    if (error.message.includes("ACTOR_DENIED")) throw new AppError("PERMISSION_DENIED");
    if (error.message.includes("PROFILE_NOT_FOUND")) throw new AppError("NOT_FOUND", "Chưa có hồ sơ bảo hiểm của nhân viên.");
    if (error.message.includes("INPUT_INVALID") || error.code === "22007" || error.code === "22008" || error.code === "23514") throw new AppError("VALIDATION_ERROR");
    throw new AppError("SERVER_ERROR", "Không thể xác nhận đã lưu kỳ đóng bảo hiểm. Vui lòng tải lại.");
  }
  return { contributionId: String(data) };
}

export async function saveInsurance(user: AuthenticatedUser, input: z.infer<typeof insuranceInputSchema>, file?: File) {
  requirePermission(user, "insurance.edit");
  if (file) requirePermission(user, "insurance.document.upload");
  const client = db(), actorId = await accountId(client, user), eventId = crypto.randomUUID();
  const { data: before, error: beforeError } = await client.from("employee_insurance_profiles").select("*").eq("employee_id", input.employeeId).maybeSingle();
  if (beforeError) throw new AppError("SERVER_ERROR", "Không thể đọc hồ sơ bảo hiểm hiện tại.");
  if (before && (!input.expectedUpdatedAt || String(before.updated_at) !== input.expectedUpdatedAt)) throw new AppError("CONFLICT", "Hồ sơ bảo hiểm đã thay đổi. Vui lòng tải lại.");
  let asset: { id: string; path: string } | undefined;
  if (file && file.size > 0) {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
    const bytes = await validateUploadedFile(file, { allowedMimeTypes: allowed, maxBytes: 10 * 1024 * 1024 });
    const id = crypto.randomUUID(), path = `${input.employeeId}/${eventId}/${id}-${safeUploadName(file.name, "insurance-document")}`;
    const { error: uploadError } = await client.storage.from("insurance-private").upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new AppError("SERVER_ERROR", "Không thể tải tài liệu bảo hiểm.");
    const { error: assetError } = await client.from("file_assets").insert({ id, bucket: "insurance-private", object_path: path, owner_entity_type: "insurance_event", owner_entity_id: eventId, mime_type: file.type, byte_size: file.size, visibility: "private", created_by: actorId, metadata: { originalName: file.name } });
    if (assetError) { await client.storage.from("insurance-private").remove([path]); throw new AppError("SERVER_ERROR", "Không thể lưu tài liệu bảo hiểm."); }
    asset = { id, path };
  }
  const snapshot = { socialInsuranceNumber: input.socialInsuranceNumber, participationStatus: input.participationStatus, startDate: input.startDate, contributionBase: input.contributionBase, contributionRatePercent: input.contributionRatePercent, contributionMonth: input.recordContribution === false ? (before?.contribution_month ? String(before.contribution_month).slice(0, 7) : undefined) : input.contributionMonth, paymentStatus: input.recordContribution === false ? String(before?.payment_status ?? "pending") : input.paymentStatus, socialInsuranceEnabled: input.socialInsuranceEnabled, healthInsuranceEnabled: input.healthInsuranceEnabled, unemploymentInsuranceEnabled: input.unemploymentInsuranceEnabled };
  const { error } = await client.rpc("save_insurance_profile_command", { p_employee_id: input.employeeId, p_event_id: eventId, p_actor_id: actorId, p_values: input, p_document_file_id: asset?.id ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null });
  if (error) {
    // A transport failure can arrive after commit. Retain a referenced object
    // and accept the recorded event rather than deleting a successful upload.
    const { data: committed, error: verifyError } = await client.from("employee_insurance_events").select("id").eq("id", eventId).maybeSingle();
    if (!committed) {
      if (asset && !verifyError) { await client.from("file_assets").delete().eq("id", asset.id); await client.storage.from("insurance-private").remove([asset.path]); }
      if (error.message.includes("VERSION_CONFLICT")) throw new AppError("CONFLICT", "Hồ sơ bảo hiểm đã thay đổi. Vui lòng tải lại.");
      if (error.message.includes("PAYMENT_RECORD_CONFLICT")) throw new AppError("CONFLICT", "Kỳ này đã có thông tin thanh toán. Vui lòng cập nhật trong Quá trình đóng.");
      if (error.message.includes("ACTOR_DENIED") || error.message.includes("FILE_DENIED")) throw new AppError("PERMISSION_DENIED");
      if (error.code === "23505") throw new AppError("CONFLICT", "Mã số BHXH đã được sử dụng.");
      throw new AppError("SERVER_ERROR", "Không thể xác nhận đã lưu hồ sơ và lịch sử bảo hiểm. Vui lòng tải lại.");
    }
  }
  await recordAuditLog({ actorId, action: "insurance.changed", entityType: "employee", entityId: input.employeeId, before: before ?? undefined, after: snapshot, reason: input.reason, metadata: { eventId, fileId: asset?.id } });
  return { eventId };
}
