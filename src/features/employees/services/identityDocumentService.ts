import "server-only";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";

export type IdentityDocumentSide = "front" | "back";
const columnBySide = { front: "national_id_front_file_id", back: "national_id_back_file_id" } as const;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"] as const;

type IdentityDocumentLinks = {
  national_id_front_file_id: string | null;
  national_id_back_file_id: string | null;
};

function database() {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Kho file private chưa được cấu hình.");
  return client;
}

function requireIdentityPermission(user: AuthenticatedUser, action: "view" | "edit") {
  const permission = `employee.identity_document.${action}` as const;
  if (!can(user.permissions, permission)) throw new AppError("PERMISSION_DENIED");
}

async function findAsset(user: AuthenticatedUser, employeeId: string, side: IdentityDocumentSide) {
  requireIdentityPermission(user, "view");
  const client = database();
  const column = columnBySide[side];
  const { data: profile, error } = await client.from("employee_sensitive_profiles").select("national_id_front_file_id,national_id_back_file_id").eq("employee_id", employeeId).maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc giấy tờ định danh.");
  const assetId = (profile as IdentityDocumentLinks | null)?.[column];
  if (!assetId) throw new AppError("NOT_FOUND", "Chưa có ảnh giấy tờ.");
  const { data: asset } = await client.from("file_assets").select("id,bucket,object_path").eq("id", assetId).maybeSingle();
  if (!asset) throw new AppError("NOT_FOUND", "Không tìm thấy ảnh giấy tờ.");
  return { client, asset };
}

export async function createIdentityDocumentUrl(user: AuthenticatedUser, employeeId: string, side: IdentityDocumentSide) {
  const { client, asset } = await findAsset(user, employeeId, side);
  const { data, error } = await client.storage.from(asset.bucket).createSignedUrl(asset.object_path, 300);
  if (error || !data?.signedUrl) throw new AppError("SERVER_ERROR", "Không thể tạo quyền xem ảnh giấy tờ.");
  await recordAuditLog({ actorId: user.id, action: "employee.identity_document.viewed", entityType: "employee", entityId: employeeId, metadata: { side, assetId: asset.id } });
  return data.signedUrl;
}

export async function replaceIdentityDocument(user: AuthenticatedUser, employeeId: string, side: IdentityDocumentSide, file: File) {
  requireIdentityPermission(user, "edit");
  const client = database();
  const { data: employee } = await client.from("employees").select("id").eq("id", employeeId).maybeSingle();
  if (!employee) throw new AppError("NOT_FOUND", "Không tìm thấy nhân viên.");
  const bytes = await validateUploadedFile(file, { allowedMimeTypes: allowedTypes, maxBytes: 8 * 1024 * 1024 });
  const column = columnBySide[side];
  const { data: current } = await client.from("employee_sensitive_profiles").select("national_id_front_file_id,national_id_back_file_id").eq("employee_id", employeeId).maybeSingle();
  const oldAssetId = (current as IdentityDocumentLinks | null)?.[column];
  const assetId = crypto.randomUUID();
  const objectPath = `${employeeId}/identity/${side}/${assetId}-${safeUploadName(file.name, `${side}.jpg`)}`;
  const { error: uploadError } = await client.storage.from("employee-private").upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new AppError("SERVER_ERROR", "Không thể tải ảnh giấy tờ.");
  const { error: assetError } = await client.from("file_assets").insert({ id: assetId, bucket: "employee-private", object_path: objectPath, owner_entity_type: "employee_identity_document", owner_entity_id: employeeId, mime_type: file.type, byte_size: file.size, visibility: "private", created_by: user.id, metadata: { originalName: file.name, side } });
  if (assetError) {
    await client.storage.from("employee-private").remove([objectPath]);
    throw new AppError("SERVER_ERROR", "Không thể lưu thông tin ảnh giấy tờ.");
  }
  const { error: linkError } = await client.from("employee_sensitive_profiles").upsert({ employee_id: employeeId, [column]: assetId, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "employee_id" });
  if (linkError) {
    await client.from("file_assets").delete().eq("id", assetId);
    await client.storage.from("employee-private").remove([objectPath]);
    throw new AppError("SERVER_ERROR", "Không thể gắn ảnh giấy tờ vào hồ sơ.");
  }
  if (oldAssetId) {
    const { data: old } = await client.from("file_assets").select("bucket,object_path").eq("id", oldAssetId).maybeSingle();
    if (old) await client.storage.from(old.bucket).remove([old.object_path]);
    await client.from("file_assets").delete().eq("id", oldAssetId);
  }
  await recordAuditLog({ actorId: user.id, action: oldAssetId ? "employee.identity_document.replaced" : "employee.identity_document.uploaded", entityType: "employee", entityId: employeeId, metadata: { side, assetId } });
  return { assetId, side };
}

export async function deleteIdentityDocument(user: AuthenticatedUser, employeeId: string, side: IdentityDocumentSide) {
  requireIdentityPermission(user, "edit");
  const client = database();
  const column = columnBySide[side];
  const { data: profile } = await client.from("employee_sensitive_profiles").select("national_id_front_file_id,national_id_back_file_id").eq("employee_id", employeeId).maybeSingle();
  const assetId = (profile as IdentityDocumentLinks | null)?.[column];
  if (!assetId) return { deleted: false };
  const { data: asset } = await client.from("file_assets").select("bucket,object_path").eq("id", assetId).maybeSingle();
  const { error } = await client.from("employee_sensitive_profiles").update({ [column]: null, updated_by: user.id, updated_at: new Date().toISOString() }).eq("employee_id", employeeId);
  if (error) throw new AppError("SERVER_ERROR", "Không thể xóa ảnh giấy tờ.");
  if (asset) await client.storage.from(asset.bucket).remove([asset.object_path]);
  await client.from("file_assets").delete().eq("id", assetId);
  await recordAuditLog({ actorId: user.id, action: "employee.identity_document.deleted", entityType: "employee", entityId: employeeId, metadata: { side, assetId } });
  return { deleted: true };
}
