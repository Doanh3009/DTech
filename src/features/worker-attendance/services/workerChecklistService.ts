import "server-only";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";

export interface WorkerChecklistConfigItem {
  id: string;
  group: string;
  content: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  rowVersion: number;
}

function requireAdmin(user: AuthenticatedUser) {
  if (!can(user.permissions, "system_admin.access")) throw new AppError("PERMISSION_DENIED");
}

function client() {
  const value = getSupabaseServiceClient();
  if (!value) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return value;
}

function map(row: Record<string, unknown>): WorkerChecklistConfigItem {
  return { id: String(row.id), group: String(row.group_name), content: String(row.content), required: Boolean(row.required), active: Boolean(row.active), sortOrder: Number(row.sort_order), rowVersion: Number(row.row_version) };
}

export async function listWorkerChecklist(user: AuthenticatedUser): Promise<WorkerChecklistConfigItem[]> {
  requireAdmin(user);
  const { data, error } = await client().from("worker_attendance_checklist_items").select("*").order("sort_order").order("created_at");
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải checklist điểm danh.");
  return (data ?? []).map(map);
}

export async function createWorkerChecklistItem(user: AuthenticatedUser, input: Omit<WorkerChecklistConfigItem, "id" | "rowVersion">) {
  requireAdmin(user);
  const database = client();
  const { data, error } = await database.from("worker_attendance_checklist_items").insert({ group_name: input.group, content: input.content, required: input.required, active: input.active, sort_order: input.sortOrder, created_by: user.id, updated_by: user.id }).select("*").single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể thêm mục checklist.");
  await recordAuditLog({ actorId: user.id, action: "worker_attendance.checklist_created", entityType: "worker_attendance_checklist_item", entityId: String(data.id), after: input });
  return map(data);
}

export async function updateWorkerChecklistItem(user: AuthenticatedUser, id: string, input: Omit<WorkerChecklistConfigItem, "id">) {
  requireAdmin(user);
  const database = client();
  const { data: before } = await database.from("worker_attendance_checklist_items").select("*").eq("id", id).maybeSingle();
  if (!before) throw new AppError("NOT_FOUND", "Không tìm thấy mục checklist.");
  const { data, error } = await database.from("worker_attendance_checklist_items").update({ group_name: input.group, content: input.content, required: input.required, active: input.active, sort_order: input.sortOrder, updated_by: user.id, row_version: input.rowVersion + 1 }).eq("id", id).eq("row_version", input.rowVersion).select("*").maybeSingle();
  if (error || !data) throw new AppError("CONFLICT", "Checklist vừa được cập nhật. Vui lòng tải lại.");
  await recordAuditLog({ actorId: user.id, action: "worker_attendance.checklist_updated", entityType: "worker_attendance_checklist_item", entityId: id, before, after: input });
  return map(data);
}

export async function deleteWorkerChecklistItem(user: AuthenticatedUser, id: string) {
  requireAdmin(user);
  const database = client();
  const { data, error } = await database.from("worker_attendance_checklist_items").delete().eq("id", id).select("*").maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy mục checklist.");
  await recordAuditLog({ actorId: user.id, action: "worker_attendance.checklist_deleted", entityType: "worker_attendance_checklist_item", entityId: id, before: data });
  return { id };
}
