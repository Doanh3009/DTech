import "server-only";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";

const avatarTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export async function getEmployeeAvatarAsset(user: AuthenticatedUser, employeeId: string) {
  if (!can(user.permissions, "employee.view")) throw new AppError("PERMISSION_DENIED");
  const database = getSupabaseServiceClient();
  if (!database) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  const { data: employee } = await database.from("employees").select("avatar_file_id").eq("id", employeeId).maybeSingle();
  if (!employee?.avatar_file_id) throw new AppError("NOT_FOUND", "Nhân viên chưa có ảnh.");
  const { data: asset, error } = await database.from("file_assets").select("bucket,object_path").eq("id", employee.avatar_file_id).maybeSingle();
  if (error || !asset) throw new AppError("NOT_FOUND", "Không tìm thấy ảnh nhân viên.");
  return { bucket: String(asset.bucket), path: String(asset.object_path) };
}

export async function replaceEmployeeAvatar(user: AuthenticatedUser, employeeId: string, file: File) {
  if (!can(user.permissions, "employee.create") && !can(user.permissions, "employee.edit")) throw new AppError("PERMISSION_DENIED");
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  const { data: employee, error: employeeError } = await client.from("employees").select("id,avatar_file_id").eq("id", employeeId).maybeSingle();
  if (employeeError || !employee) throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
  const bytes = await validateUploadedFile(file, { allowedMimeTypes: avatarTypes, maxBytes: 5 * 1024 * 1024 });
  const assetId = crypto.randomUUID();
  const path = `avatars/${employeeId}/${assetId}-${safeUploadName(file.name, "avatar")}`;
  const { error: uploadError } = await client.storage.from("employee-private").upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new AppError("SERVER_ERROR", "Không thể tải ảnh nhân viên.");
  const { error: assetError } = await client.from("file_assets").insert({ id: assetId, bucket: "employee-private", object_path: path, owner_entity_type: "employee_avatar", owner_entity_id: employeeId, mime_type: file.type, byte_size: file.size, visibility: "private", created_by: user.id, metadata: { originalName: file.name } });
  if (assetError) { await client.storage.from("employee-private").remove([path]); throw new AppError("SERVER_ERROR", "Không thể lưu ảnh nhân viên."); }
  const { error: linkError } = await client.from("employees").update({ avatar_file_id: assetId }).eq("id", employeeId);
  if (linkError) { await client.from("file_assets").delete().eq("id", assetId); await client.storage.from("employee-private").remove([path]); throw new AppError("SERVER_ERROR", "Không thể gắn ảnh vào hồ sơ nhân viên."); }
  if (employee.avatar_file_id) {
    const { data: old } = await client.from("file_assets").select("bucket,object_path").eq("id", employee.avatar_file_id).maybeSingle();
    if (old) await client.storage.from(old.bucket).remove([old.object_path]);
    await client.from("file_assets").delete().eq("id", employee.avatar_file_id);
  }
  await recordAuditLog({ actorId: user.id, action: "employee.avatar_replaced", entityType: "employee", entityId: employeeId, metadata: { fileId: assetId } });
  return { assetId };
}
