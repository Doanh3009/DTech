import "server-only";

import type { z } from "zod";

import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";
import { resolvePlatformIdentity } from "@/features/shared-platforms/services/platformIdentity";
import type { todoCreateSchema, todoPatchSchema, uiPreferencesSchema } from "./personalWorkspaceSchemas";

type Row = Record<string, unknown>;

function clientOrThrow() {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Database chưa được cấu hình.");
  return client;
}

function mapTodo(row: Row) {
  return {
    id: String(row.id),
    title: String(row.title),
    dueDate: row.due_date ? String(row.due_date) : undefined,
    priority: String(row.priority) as "low" | "medium" | "high",
    completed: Boolean(row.completed),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function getPersonalNote(user: AuthenticatedUser) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  const { data, error } = await client.from("user_dashboard_notes").select("content,updated_at").eq("account_id", identity.accountId).maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải ghi chú cá nhân.");
  return { content: data?.content ? String(data.content) : "", updatedAt: data?.updated_at ? String(data.updated_at) : undefined };
}

export async function savePersonalNote(user: AuthenticatedUser, content: string) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  const { data, error } = await client.from("user_dashboard_notes").upsert({ account_id: identity.accountId, content }, { onConflict: "account_id" }).select("content,updated_at").single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể lưu ghi chú cá nhân.");
  return { content: String(data.content), updatedAt: String(data.updated_at) };
}

export async function listPersonalTodos(user: AuthenticatedUser) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  const { data, error } = await client.from("user_todos").select("*").eq("user_id", identity.accountId).order("completed").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(100);
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải việc cá nhân.");
  return (data ?? []).map((row) => mapTodo(row as Row));
}

export async function createPersonalTodo(user: AuthenticatedUser, input: z.infer<typeof todoCreateSchema>) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  const { data, error } = await client.from("user_todos").insert({ user_id: identity.accountId, title: input.title, due_date: input.dueDate ?? null, priority: input.priority }).select("*").single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể tạo việc cá nhân.");
  return mapTodo(data as Row);
}

export async function updatePersonalTodo(user: AuthenticatedUser, todoId: string, input: z.infer<typeof todoPatchSchema>) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  const patch: Row = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.completed !== undefined) {
    patch.completed = input.completed;
    patch.completed_at = input.completed ? new Date().toISOString() : null;
  }
  const { data, error } = await client.from("user_todos").update(patch).eq("id", todoId).eq("user_id", identity.accountId).select("*").maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể cập nhật việc cá nhân.");
  if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy việc cá nhân.");
  return mapTodo(data as Row);
}

export async function deletePersonalTodo(user: AuthenticatedUser, todoId: string) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  const { data, error } = await client.from("user_todos").delete().eq("id", todoId).eq("user_id", identity.accountId).select("id").maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể xóa việc cá nhân.");
  if (!data) throw new AppError("NOT_FOUND", "Không tìm thấy việc cá nhân.");
  return { id: todoId };
}

export async function getUiPreferences(user: AuthenticatedUser) {
  const client = clientOrThrow();
  const { data, error } = await client.from("user_ui_preferences").select("*").eq("account_id", user.id).maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải tùy chọn giao diện.");
  return {
    density: (data?.density ?? "default") as "compact" | "default" | "comfortable",
    sidebarCollapsed: Boolean(data?.sidebar_collapsed),
    pinnedModules: (data?.pinned_modules ?? []) as string[],
    dashboardWidgetVisibility: (data?.dashboard_widget_visibility ?? {}) as Record<string, boolean>,
    dashboardWidgetOrder: (data?.dashboard_widget_order ?? []) as string[],
    themePreference: (data?.theme_preference ?? "system") as "system" | "light"
  };
}

export async function saveUiPreferences(user: AuthenticatedUser, input: z.infer<typeof uiPreferencesSchema>) {
  const client = clientOrThrow();
  const { error } = await client.from("user_ui_preferences").upsert({ account_id: user.id, density: input.density, sidebar_collapsed: input.sidebarCollapsed, pinned_modules: input.pinnedModules, dashboard_widget_visibility: input.dashboardWidgetVisibility, dashboard_widget_order: input.dashboardWidgetOrder, theme_preference: input.themePreference }, { onConflict: "account_id" });
  if (error) throw new AppError("SERVER_ERROR", "Không thể lưu tùy chọn giao diện.");
  return input;
}

export async function getOwnAvatarAsset(user: AuthenticatedUser) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  if (!identity.employeeId) throw new AppError("NOT_FOUND", "Tài khoản chưa liên kết hồ sơ nhân viên.");
  const { data: employee } = await client.from("employees").select("avatar_file_id").eq("id", identity.employeeId).maybeSingle();
  if (!employee?.avatar_file_id) throw new AppError("NOT_FOUND", "Chưa có ảnh đại diện.");
  const { data: asset, error } = await client.from("file_assets").select("id,bucket,object_path").eq("id", employee.avatar_file_id).maybeSingle();
  if (error || !asset) throw new AppError("NOT_FOUND", "Không tìm thấy ảnh đại diện.");
  return { id: String(asset.id), bucket: String(asset.bucket), path: String(asset.object_path) };
}

export async function uploadOwnAvatar(user: AuthenticatedUser, file: File) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  if (!identity.employeeId) throw new AppError("VALIDATION_ERROR", "Tài khoản chưa liên kết hồ sơ nhân viên.");
  const bytes = await validateUploadedFile(file, { allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 5 * 1024 * 1024 });
  const assetId = crypto.randomUUID(), path = `avatars/${identity.accountId}/${assetId}-${safeUploadName(file.name, "avatar")}`;
  const { data: employee } = await client.from("employees").select("avatar_file_id").eq("id", identity.employeeId).single();
  const oldAssetId = employee?.avatar_file_id ? String(employee.avatar_file_id) : undefined;
  const { error: uploadError } = await client.storage.from("employee-private").upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new AppError("SERVER_ERROR", "Không thể tải ảnh đại diện.");
  const { error: assetError } = await client.from("file_assets").insert({ id: assetId, bucket: "employee-private", object_path: path, owner_entity_type: "employee_avatar", owner_entity_id: identity.employeeId, mime_type: file.type, byte_size: file.size, visibility: "private", created_by: identity.accountId, metadata: { originalName: file.name } });
  if (assetError) { await client.storage.from("employee-private").remove([path]); throw new AppError("SERVER_ERROR", "Không thể lưu ảnh đại diện."); }
  const { error: updateError } = await client.from("employees").update({ avatar_file_id: assetId }).eq("id", identity.employeeId);
  if (updateError) { await client.from("file_assets").delete().eq("id", assetId); await client.storage.from("employee-private").remove([path]); throw new AppError("SERVER_ERROR", "Không thể cập nhật ảnh đại diện."); }
  if (oldAssetId) {
    const { data: old } = await client.from("file_assets").select("bucket,object_path").eq("id", oldAssetId).maybeSingle();
    if (old) await client.storage.from(String(old.bucket)).remove([String(old.object_path)]);
    await client.from("file_assets").delete().eq("id", oldAssetId);
  }
  return { id: assetId };
}

export async function removeOwnAvatar(user: AuthenticatedUser) {
  const client = clientOrThrow(), identity = await resolvePlatformIdentity(client, user);
  if (!identity.employeeId) throw new AppError("NOT_FOUND", "Tài khoản chưa liên kết hồ sơ nhân viên.");
  const { data: employee } = await client.from("employees").select("avatar_file_id").eq("id", identity.employeeId).single();
  const assetId = employee?.avatar_file_id ? String(employee.avatar_file_id) : undefined;
  if (!assetId) return { removed: false };
  await client.from("employees").update({ avatar_file_id: null }).eq("id", identity.employeeId);
  const { data: asset } = await client.from("file_assets").select("bucket,object_path").eq("id", assetId).maybeSingle();
  if (asset) await client.storage.from(String(asset.bucket)).remove([String(asset.object_path)]);
  await client.from("file_assets").delete().eq("id", assetId);
  return { removed: true };
}
