import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { issueReopenSchema, issueResolutionSchema, projectHealthInputSchema, projectUpdateInputSchema, projectUpdatePatchSchema, projectUpdateQuerySchema } from "@/features/projects/schemas/projectSchemas";
import type { ProjectHealthEntry, ProjectIssue, ProjectMonitoringSummary, ProjectUpdate, ProjectUpdateAttachment } from "@/features/projects/types/projectTypes";
import { listProjects } from "@/features/projects/services/projectRepository";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";
import { createProjectUpdateTitle, isProjectStale, sortIssuesByPriority } from "@/features/projects/services/projectUpdateRules";
import { safeUploadName, validateUploadedFile } from "@/lib/security/filePolicy";

type Row = Record<string, unknown>;

function db(): SupabaseClient {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return client;
}

function text(row: Row, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

function optional(row: Row, key: string): string | undefined {
  const value = text(row, key);
  return value || undefined;
}

function nested(row: Row, key: string): Row | undefined {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as Row | undefined;
  return value && typeof value === "object" ? value as Row : undefined;
}

async function actor(client: SupabaseClient, user: AuthenticatedUser) {
  let query = client.from("app_accounts").select("id,employee_id").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể xác định tài khoản vận hành.");
  return { accountId: data?.id ? String(data.id) : undefined, employeeId: data?.employee_id ? String(data.employee_id) : undefined };
}

async function assertProjectAccess(client: SupabaseClient, user: AuthenticatedUser, projectId: string, write = false) {
  const broad = can(user.permissions, "project_update.view_all") || can(user.permissions, "project_monitoring.view_all");
  if (broad) return actor(client, user);
  if (!write && !can(user.permissions, "project_update.view_project") && !can(user.permissions, "project_monitoring.view") && !can(user.permissions, "project_issue.view")) throw new AppError("PERMISSION_DENIED");
  const identity = await actor(client, user);
  if (!identity.employeeId) throw new AppError("PERMISSION_DENIED");
  const { data, error } = await client.from("project_assignments").select("id").eq("project_id", projectId).eq("employee_id", identity.employeeId).eq("status", "active").limit(1).maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể xác định phạm vi dự án.");
  if (!data) throw new AppError("PERMISSION_DENIED", "Bạn không thuộc phạm vi dự án này.");
  return identity;
}

async function scopedProjectIds(client: SupabaseClient, user: AuthenticatedUser) {
  if (can(user.permissions, "project_update.view_all") || can(user.permissions, "project_monitoring.view_all")) return undefined;
  const identity = await actor(client, user);
  if (!identity.employeeId) return [];
  const { data, error } = await client.from("project_assignments").select("project_id").eq("employee_id", identity.employeeId).eq("status", "active");
  if (error) throw new AppError("SERVER_ERROR", "Không thể xác định phạm vi dự án.");
  return [...new Set((data ?? []).map((item) => String(item.project_id)))];
}

const attachmentSelect = "*,file_assets(mime_type,byte_size,object_path,metadata)";
const issueSelect = "*,projects(name),worksites(name),owner:employees!project_issues_owner_employee_id_fkey(full_name),resolver:app_accounts!project_issues_resolved_by_fkey(display_name)";

function mapAttachment(row: Row): ProjectUpdateAttachment {
  const file = nested(row, "file_assets") ?? {};
  const metadata = file.metadata && typeof file.metadata === "object" ? file.metadata as Row : {};
  const mime = text(file, "mime_type");
  return {
    id: text(row, "id"), fileId: text(row, "file_id"), attachmentType: text(row, "attachment_type") as ProjectUpdateAttachment["attachmentType"],
    fileName: text(metadata, "originalName", text(file, "object_path").split("/").at(-1) ?? "Tệp đính kèm"), mimeType: mime,
    sizeBytes: Number(file.byte_size ?? 0), caption: optional(row, "caption"), sortOrder: Number(row.sort_order ?? 0),
    sourceAttendancePhotoId: optional(row, "source_attendance_photo_id"), uploadedAt: text(row, "uploaded_at")
  };
}

function mapIssue(row: Row): ProjectIssue {
  return {
    id: text(row, "id"), projectId: text(row, "project_id"), projectName: text(nested(row, "projects") ?? {}, "name", text(row, "project_name", "—")),
    worksiteId: optional(row, "worksite_id"), worksiteName: optional(nested(row, "worksites") ?? {}, "name"), sourceUpdateId: text(row, "source_update_id"),
    title: text(row, "title"), severity: text(row, "severity") as ProjectIssue["severity"], status: text(row, "status") as ProjectIssue["status"],
    ownerEmployeeId: optional(row, "owner_employee_id"), ownerName: optional(nested(row, "owner") ?? {}, "full_name"), resolutionNote: optional(row, "resolution_note"),
    resolvedByName: optional(nested(row, "resolver") ?? {}, "display_name"), resolvedAt: optional(row, "resolved_at"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at")
  };
}

async function loadRelations(client: SupabaseClient, rows: Row[]) {
  const ids = rows.map((row) => text(row, "id"));
  if (!ids.length) return { attachments: new Map<string, ProjectUpdateAttachment[]>(), issues: new Map<string, ProjectIssue>() };
  const [{ data: attachments, error: attachmentError }, { data: issues, error: issueError }] = await Promise.all([
    client.from("project_update_attachments").select(attachmentSelect).in("update_id", ids).order("sort_order"),
    client.from("project_issues").select(issueSelect).in("source_update_id", ids)
  ]);
  if (attachmentError || issueError) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu liên quan của cập nhật dự án.");
  const attachmentMap = new Map<string, ProjectUpdateAttachment[]>();
  for (const item of attachments ?? []) {
    const updateId = String(item.update_id); attachmentMap.set(updateId, [...(attachmentMap.get(updateId) ?? []), mapAttachment(item as Row)]);
  }
  return { attachments: attachmentMap, issues: new Map((issues ?? []).map((item) => [String(item.source_update_id), mapIssue(item as Row)])) };
}

function mapUpdate(row: Row, relations: Awaited<ReturnType<typeof loadRelations>>): ProjectUpdate {
  return {
    id: text(row, "id"), clientUpdateId: optional(row, "client_update_id"), projectId: text(row, "project_id"), projectName: text(row, "project_name_snapshot"),
    worksiteId: optional(row, "worksite_id"), worksiteName: optional(row, "worksite_name_snapshot"), authorEmployeeId: optional(row, "author_employee_id"),
    authorName: text(row, "author_name_snapshot"), authorProjectRole: text(row, "author_project_role_snapshot"), updateType: text(row, "update_type") as ProjectUpdate["updateType"],
    title: text(row, "title"), content: text(row, "content"), status: text(row, "status") as ProjectUpdate["status"], publishStatus: text(row, "publish_status") as ProjectUpdate["publishStatus"],
    issue: relations.issues.get(text(row, "id")), pinned: Boolean(row.pinned), relatedAttendanceSessionId: optional(row, "related_attendance_session_id"),
    syncStatus: text(row, "sync_status") as ProjectUpdate["syncStatus"], capturedAtClient: optional(row, "captured_at_client"), createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"), version: Number(row.row_version ?? 1), attachments: relations.attachments.get(text(row, "id")) ?? []
  };
}

export async function listProjectUpdates(user: AuthenticatedUser, projectId: string, filters: z.infer<typeof projectUpdateQuerySchema>) {
  const client = db();
  await assertProjectAccess(client, user, projectId);
  let query = client.from("project_updates").select("*").eq("project_id", projectId).neq("publish_status", "archived").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(filters.limit + 1);
  if (filters.type) query = query.eq("update_type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.worksiteId) query = query.eq("worksite_id", filters.worksiteId);
  if (filters.authorEmployeeId) query = query.eq("author_employee_id", filters.authorEmployeeId);
  if (filters.pinned) query = query.eq("pinned", filters.pinned === "true");
  if (filters.search) query = query.or(`title.ilike.%${filters.search.replace(/[%,]/g, "")}%,content.ilike.%${filters.search.replace(/[%,]/g, "")}%`);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+07:00`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59+07:00`);
  if (filters.cursor) query = query.lt("created_at", filters.cursor);
  const { data, error } = await query;
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc cập nhật dự án.");
  let rows = (data ?? []) as Row[];
  const hasMore = rows.length > filters.limit; rows = rows.slice(0, filters.limit);
  const relations = await loadRelations(client, rows);
  let items = rows.map((row) => mapUpdate(row, relations));
  if (filters.issueOnly === "true") items = items.filter((item) => item.issue);
  if (filters.severity) items = items.filter((item) => item.issue?.severity === filters.severity);
  return { items, nextCursor: hasMore ? items.at(-1)?.createdAt : undefined };
}

export async function getProjectUpdate(user: AuthenticatedUser, updateId: string): Promise<ProjectUpdate> {
  const client = db();
  const { data, error } = await client.from("project_updates").select("*").eq("id", updateId).maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy cập nhật dự án.");
  await assertProjectAccess(client, user, String(data.project_id));
  const relations = await loadRelations(client, [data as Row]);
  return mapUpdate(data as Row, relations);
}

export async function createProjectUpdate(user: AuthenticatedUser, projectId: string, input: z.infer<typeof projectUpdateInputSchema>): Promise<ProjectUpdate> {
  if (!can(user.permissions, "project_update.create")) throw new AppError("PERMISSION_DENIED");
  const client = db(); const identity = await assertProjectAccess(client, user, projectId, true);
  const [{ data: project }, { data: worksite }, { data: attendance }] = await Promise.all([
    client.from("projects").select("name,status").eq("id", projectId).maybeSingle(),
    input.worksiteId ? client.from("worksites").select("name").eq("id", input.worksiteId).eq("project_id", projectId).maybeSingle() : Promise.resolve({ data: null }),
    input.relatedAttendanceSessionId ? client.from("worker_attendance_sessions").select("id,project_id,worksite_id").eq("id", input.relatedAttendanceSessionId).maybeSingle() : Promise.resolve({ data: null })
  ]);
  if (!project) throw new AppError("NOT_FOUND", "Không tìm thấy dự án.");
  if (project.status === "closed") throw new AppError("CONFLICT", "Dự án đã đóng, không thể đăng cập nhật.");
  if (input.worksiteId && !worksite) throw new AppError("VALIDATION_ERROR", "Công trường không thuộc dự án.");
  if (attendance && (attendance.project_id !== projectId || (input.worksiteId && attendance.worksite_id !== input.worksiteId))) throw new AppError("VALIDATION_ERROR", "Phiên điểm danh không cùng phạm vi dự án.");
  const title = createProjectUpdateTitle(input.title, input.content);
  const { data, error } = await client.from("project_updates").insert({
    client_update_id: input.clientUpdateId ?? null, project_id: projectId, project_name_snapshot: project.name, worksite_id: input.worksiteId ?? null,
    worksite_name_snapshot: worksite?.name ?? null, author_employee_id: identity.employeeId ?? null, author_name_snapshot: user.displayName,
    author_project_role_snapshot: "Thành viên dự án", update_type: input.updateType, title, content: input.content, status: input.status,
    publish_status: input.publishStatus, related_attendance_session_id: input.relatedAttendanceSessionId ?? null, sync_status: "synced", captured_at_client: input.capturedAtClient ?? null,
    created_by: identity.accountId ?? null
  }).select("*").single();
  if (error || !data) {
    if (error?.code === "23505" && input.clientUpdateId) {
      const { data: existing } = await client.from("project_updates").select("id").eq("client_update_id", input.clientUpdateId).maybeSingle();
      if (existing) {
        const existingId = String(existing.id);
        if (input.issueFlag && input.issueSeverity) {
          const { data: existingIssue, error: issueReadError } = await client.from("project_issues").select("id").eq("source_update_id", existingId).maybeSingle();
          if (issueReadError) throw new AppError("SERVER_ERROR", "Không thể kiểm tra vấn đề đã đồng bộ.");
          if (!existingIssue) {
            const { data: issue, error: issueError } = await client.from("project_issues").insert({ project_id: projectId, worksite_id: input.worksiteId ?? null, source_update_id: existingId, title, severity: input.issueSeverity, owner_employee_id: input.issueOwnerEmployeeId ?? null }).select("id").single();
            if (issueError && issueError.code !== "23505") throw new AppError("SERVER_ERROR", "Cập nhật đã lưu nhưng không thể tạo vấn đề.");
            if (issue) await client.from("project_domain_events").insert([
              { event_type: "project.issue.created", project_id: projectId, aggregate_id: issue.id, payload: { severity: input.issueSeverity, recoveredFromRetry: true } },
              ...((input.issueSeverity === "high" || input.issueSeverity === "critical") ? [{ event_type: "project.issue.high", project_id: projectId, aggregate_id: issue.id, payload: { severity: input.issueSeverity, recoveredFromRetry: true } }] : [])
            ]);
          }
        }
        return getProjectUpdate(user, existingId);
      }
    }
    throw new AppError("SERVER_ERROR", "Không thể lưu cập nhật dự án.");
  }
  if (input.issueFlag && input.issueSeverity) {
    const { data: issue, error: issueError } = await client.from("project_issues").insert({ project_id: projectId, worksite_id: input.worksiteId ?? null, source_update_id: data.id, title, severity: input.issueSeverity, owner_employee_id: input.issueOwnerEmployeeId ?? null }).select("id").single();
    if (issueError) throw new AppError("SERVER_ERROR", "Cập nhật đã lưu nhưng không thể tạo vấn đề.");
    await client.from("project_domain_events").insert([{ event_type: "project.issue.created", project_id: projectId, aggregate_id: issue.id, payload: { severity: input.issueSeverity } }, ...(input.issueSeverity === "high" || input.issueSeverity === "critical" ? [{ event_type: "project.issue.high", project_id: projectId, aggregate_id: issue.id, payload: { severity: input.issueSeverity } }] : [])]);
  }
  if (input.publishStatus === "published") await client.from("project_domain_events").insert({ event_type: "project.update.created", project_id: projectId, aggregate_id: data.id, payload: { type: input.updateType } });
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: "project.update.created", entityType: "project_update", entityId: String(data.id), after: { projectId, updateType: input.updateType, publishStatus: input.publishStatus } });
  return getProjectUpdate(user, String(data.id));
}

export async function editProjectUpdate(user: AuthenticatedUser, updateId: string, input: z.infer<typeof projectUpdatePatchSchema>) {
  const client = db(); const current = await getProjectUpdate(user, updateId); const identity = await actor(client, user);
  const own = identity.employeeId && identity.employeeId === current.authorEmployeeId;
  if (!(can(user.permissions, "project_update.edit_all") || (own && can(user.permissions, "project_update.edit_own")))) throw new AppError("PERMISSION_DENIED");
  const patch: Row = {};
  if (input.title !== undefined) patch.title = createProjectUpdateTitle(input.title, current.content);
  if (input.content !== undefined) patch.content = input.content;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await client.from("project_updates").update(patch).eq("id", updateId).eq("row_version", input.rowVersion).select("*").maybeSingle();
  if (error || !data) throw new AppError("CONFLICT", "Cập nhật đã được người khác chỉnh sửa. Vui lòng tải lại.");
  await client.from("project_update_versions").insert({ update_id: updateId, version: input.rowVersion + 1, before_data: { title: current.title, content: current.content, status: current.status }, after_data: patch, edited_by: identity.accountId ?? null, reason: input.reason ?? null });
  if (current.issue && (input.issueSeverity || input.issueOwnerEmployeeId)) await client.from("project_issues").update({ severity: input.issueSeverity ?? current.issue.severity, owner_employee_id: input.issueOwnerEmployeeId ?? current.issue.ownerEmployeeId ?? null }).eq("id", current.issue.id);
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: "project.update.edited", entityType: "project_update", entityId: updateId, reason: input.reason, before: { version: current.version }, after: { version: input.rowVersion + 1 } });
  return getProjectUpdate(user, updateId);
}

export async function setProjectUpdatePinned(user: AuthenticatedUser, updateId: string, pinned: boolean) {
  if (!can(user.permissions, "project_update.pin")) throw new AppError("PERMISSION_DENIED");
  const current = await getProjectUpdate(user, updateId); const client = db(); const identity = await actor(client, user);
  const { error } = await client.from("project_updates").update({ pinned }).eq("id", updateId);
  if (error) throw new AppError("SERVER_ERROR", "Không thể cập nhật trạng thái ghim.");
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: pinned ? "project.update.pinned" : "project.update.unpinned", entityType: "project_update", entityId: updateId, before: { pinned: current.pinned }, after: { pinned } });
  return getProjectUpdate(user, updateId);
}

export async function archiveProjectUpdate(user: AuthenticatedUser, updateId: string, reason: string) {
  if (!can(user.permissions, "project_update.archive")) throw new AppError("PERMISSION_DENIED");
  const current = await getProjectUpdate(user, updateId); const client = db(); const identity = await actor(client, user);
  const { error } = await client.from("project_updates").update({ publish_status: "archived", archived_at: new Date().toISOString(), archived_by: identity.accountId ?? null }).eq("id", updateId);
  if (error) throw new AppError("SERVER_ERROR", "Không thể lưu trữ cập nhật.");
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: "project.update.archived", entityType: "project_update", entityId: updateId, reason, before: { publishStatus: current.publishStatus }, after: { publishStatus: "archived" } });
}

const allowedAttachments: Record<string, ProjectUpdateAttachment["attachmentType"]> = {
  "image/jpeg": "image", "image/png": "image", "image/webp": "image", "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document"
};

export async function uploadProjectUpdateAttachment(user: AuthenticatedUser, updateId: string, file: File, caption?: string, clientAttachmentId?: string) {
  if (!can(user.permissions, "project_update.create") && !can(user.permissions, "project_update.edit_all")) throw new AppError("PERMISSION_DENIED");
  const current = await getProjectUpdate(user, updateId);
  if (clientAttachmentId) {
    const { data: existing, error: existingError } = await db().from("project_update_attachments").select(attachmentSelect).eq("update_id", updateId).eq("client_attachment_id", clientAttachmentId).maybeSingle();
    if (existingError) throw new AppError("SERVER_ERROR", "Không thể kiểm tra tệp đã tải.");
    if (existing) return mapAttachment(existing as Row);
  }
  if (current.publishStatus === "archived") throw new AppError("CONFLICT", "Cập nhật đã lưu trữ.");
  const attachmentType = allowedAttachments[file.type];
  if (!attachmentType) throw new AppError("VALIDATION_ERROR", "Tệp không đúng định dạng.");
  const bytes = await validateUploadedFile(file, { allowedMimeTypes: Object.keys(allowedAttachments), maxBytes: 10 * 1024 * 1024 });
  const client = db(); const identity = await actor(client, user); const assetId = crypto.randomUUID();
  const safeName = safeUploadName(file.name, "attachment");
  const objectPath = `${current.projectId}/${updateId}/${assetId}-${safeName}`;
  const { error: uploadError } = await client.storage.from("project-update-files").upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) throw new AppError("PHOTO_UPLOAD", "Không thể tải tệp lên. Nội dung cập nhật vẫn được giữ.");
  const { error: assetError } = await client.from("file_assets").insert({ id: assetId, bucket: "project-update-files", object_path: objectPath, owner_entity_type: "project_update", owner_entity_id: updateId, mime_type: file.type, byte_size: file.size, visibility: "private", created_by: identity.accountId ?? null, metadata: { originalName: file.name } });
  if (assetError) { await client.storage.from("project-update-files").remove([objectPath]); throw new AppError("SERVER_ERROR", "Không thể lưu thông tin tệp."); }
  const { data, error } = await client.from("project_update_attachments").insert({ update_id: updateId, file_id: assetId, attachment_type: attachmentType, caption: caption?.trim() || null, uploaded_by: identity.accountId ?? null, client_attachment_id: clientAttachmentId ?? null }).select(attachmentSelect).single();
  if (error || !data) {
    await client.from("file_assets").delete().eq("id", assetId);
    await client.storage.from("project-update-files").remove([objectPath]);
    if (error?.code === "23505" && clientAttachmentId) {
      const { data: existing } = await client.from("project_update_attachments").select(attachmentSelect).eq("update_id", updateId).eq("client_attachment_id", clientAttachmentId).maybeSingle();
      if (existing) return mapAttachment(existing as Row);
    }
    throw new AppError("SERVER_ERROR", "Không thể gắn tệp vào cập nhật.");
  }
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: "project.update.attachment_added", entityType: "project_update", entityId: updateId, metadata: { fileId: assetId, mimeType: file.type } });
  return mapAttachment(data as Row);
}

export async function listProjectIssues(user: AuthenticatedUser, filters: { projectId?: string; status?: string; severity?: string; ownerId?: string } = {}): Promise<ProjectIssue[]> {
  if (!can(user.permissions, "project_issue.view")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  if (filters.projectId) await assertProjectAccess(client, user, filters.projectId);
  const scope = filters.projectId ? undefined : await scopedProjectIds(client, user);
  if (scope && !scope.length) return [];
  const rows: Row[] = [];
  for (let offset = 0; offset < 100_000; offset += 500) {
    let query = client.from("project_issues").select(issueSelect).order("id").range(offset, offset + 499);
    if (scope) query = query.in("project_id", scope);
    if (filters.projectId) query = query.eq("project_id", filters.projectId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.severity) query = query.eq("severity", filters.severity);
    if (filters.ownerId) query = query.eq("owner_employee_id", filters.ownerId);
    const { data, error } = await query;
    if (error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách vấn đề.");
    rows.push(...(data ?? []) as Row[]);
    if ((data?.length ?? 0) < 500) return sortIssuesByPriority(rows.map(mapIssue));
  }
  throw new AppError("SERVER_ERROR", "Danh sách vấn đề vượt giới hạn tải. Hãy lọc theo dự án.");
}

async function transitionIssue(user: AuthenticatedUser, issueId: string, status: "resolved" | "open", note: string) {
  if (!can(user.permissions, "project_issue.resolve")) throw new AppError("PERMISSION_DENIED");
  const client = db(); const { data: row, error: readError } = await client.from("project_issues").select(issueSelect).eq("id", issueId).maybeSingle();
  if (readError) throw new AppError("SERVER_ERROR", "Không thể đọc vấn đề dự án.");
  if (!row) throw new AppError("NOT_FOUND", "Không tìm thấy vấn đề.");
  const current = mapIssue(row as Row); await assertProjectAccess(client, user, current.projectId, true); const identity = await actor(client, user);
  if (current.status === status) return current;
  const patch = status === "resolved" ? { status, resolution_note: note, resolved_by: identity.accountId ?? null, resolved_at: new Date().toISOString() } : { status, resolution_note: null, resolved_by: null, resolved_at: null };
  const { error } = await client.from("project_issues").update(patch).eq("id", issueId);
  if (error) throw new AppError("SERVER_ERROR", "Không thể cập nhật vấn đề.");
  const { error: historyError } = await client.from("project_issue_history").insert({ issue_id: issueId, from_status: current.status, to_status: status, from_severity: current.severity, to_severity: current.severity, note, changed_by: identity.accountId ?? null });
  if (historyError) throw new AppError("SERVER_ERROR", "Không thể lưu lịch sử vấn đề dự án.");
  if (status === "resolved") {
    const { error: eventError } = await client.from("project_domain_events").insert({ event_type: "project.issue.resolved", project_id: current.projectId, aggregate_id: issueId, payload: {} });
    if (eventError) throw new AppError("SERVER_ERROR", "Không thể phát sự kiện vấn đề dự án.");
  }
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: status === "resolved" ? "project.issue.resolved" : "project.issue.reopened", entityType: "project_issue", entityId: issueId, reason: note, before: { status: current.status }, after: { status } });
  const { data: updated } = await client.from("project_issues").select(issueSelect).eq("id", issueId).single();
  return mapIssue(updated as Row);
}

export function resolveProjectIssue(user: AuthenticatedUser, issueId: string, input: z.infer<typeof issueResolutionSchema>) { return transitionIssue(user, issueId, "resolved", input.resolutionNote); }
export function reopenProjectIssue(user: AuthenticatedUser, issueId: string, input: z.infer<typeof issueReopenSchema>) { return transitionIssue(user, issueId, "open", input.reason); }

export async function updateProjectHealth(user: AuthenticatedUser, projectId: string, input: z.infer<typeof projectHealthInputSchema>) {
  if (!can(user.permissions, "project_health.update")) throw new AppError("PERMISSION_DENIED");
  const client = db(); await assertProjectAccess(client, user, projectId, true); const identity = await actor(client, user);
  const { data: project, error: projectError } = await client.from("projects").select("health").eq("id", projectId).maybeSingle();
  if (projectError) throw new AppError("SERVER_ERROR", "Không thể đọc tình trạng dự án.");
  if (!project) throw new AppError("NOT_FOUND", "Không tìm thấy dự án.");
  const { error } = await client.from("projects").update({ health: input.health }).eq("id", projectId);
  if (error) throw new AppError("SERVER_ERROR", "Không thể cập nhật tình trạng dự án.");
  const { data: history, error: historyError } = await client.from("project_health_history").insert({ project_id: projectId, from_health: project.health, to_health: input.health, reason: input.reason ?? null, changed_by: identity.accountId ?? null, changed_by_name_snapshot: user.displayName }).select("*").single();
  if (historyError || !history) throw new AppError("SERVER_ERROR", "Không thể lưu lịch sử tình trạng dự án.");
  const { error: eventError } = await client.from("project_domain_events").insert({ event_type: "project.health.changed", project_id: projectId, aggregate_id: history.id, payload: { from: project.health, to: input.health } });
  if (eventError) throw new AppError("SERVER_ERROR", "Không thể phát sự kiện tình trạng dự án.");
  await recordAuditLog({ actorId: identity.accountId ?? user.id, action: "project.health.changed", entityType: "project", entityId: projectId, reason: input.reason, before: { health: project.health }, after: { health: input.health } });
  return { projectId, health: input.health };
}

export async function listProjectHealthHistory(user: AuthenticatedUser, projectId: string): Promise<ProjectHealthEntry[]> {
  const client = db(); await assertProjectAccess(client, user, projectId);
  const { data, error } = await client.from("project_health_history").select("*").eq("project_id", projectId).order("changed_at", { ascending: false });
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc lịch sử tình trạng.");
  return (data ?? []).map((row) => ({ id: String(row.id), projectId: String(row.project_id), fromHealth: row.from_health ?? undefined, toHealth: row.to_health, reason: row.reason ?? undefined, changedByName: row.changed_by_name_snapshot, changedAt: row.changed_at }));
}

export async function getProjectMonitoring(user: AuthenticatedUser): Promise<ProjectMonitoringSummary> {
  if (!can(user.permissions, "project_monitoring.view") && !can(user.permissions, "project_monitoring.view_all")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  // listProjects already applies the user's project scope.
  const projects = (await listProjects(user)).filter((project) => project.status !== "closed");
  const projectIds = projects.map((project) => project.id);
  if (!projectIds.length) return { active: 0, averageCompletion: 0, onTrack: 0, atRisk: 0, delayed: 0, paused: 0, projects: [], attention: [], recentUpdates: [] };
  const [{ data: updateRows, error: updateError }, issues, { data: progressRows, error: progressError }] = await Promise.all([
    client.from("project_updates").select("*").in("project_id", projectIds).eq("publish_status", "published").order("created_at", { ascending: false }).limit(100),
    listProjectIssues(user, {}),
    client.from("project_progress_nodes").select("project_id,completion_percent").in("project_id", projectIds).is("parent_id", null)
  ]);
  if (updateError || progressError) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu theo dõi dự án.");
  const progressByProject = new Map<string, number[]>();
  for (const row of progressRows ?? []) progressByProject.set(String(row.project_id), [...(progressByProject.get(String(row.project_id)) ?? []), Number(row.completion_percent)]);
  const rows = (updateRows ?? []) as Row[]; const relations = await loadRelations(client, rows); const updates = rows.map((row) => mapUpdate(row, relations));
  const now = Date.now();
  const enriched = projects.map((project) => {
    const latestUpdate = updates.find((update) => update.projectId === project.id);
    const openHighIssues = issues.filter((issue) => issue.projectId === project.id && ["open", "in_progress"].includes(issue.status) && ["high", "critical"].includes(issue.severity)).length;
    const progress = progressByProject.get(project.id) ?? [];
    return { ...project, completionPercent: progress.length ? Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length) : 0, latestUpdate, openHighIssues, stale: isProjectStale(latestUpdate?.createdAt, 3, new Date(now)) };
  });
  return {
    averageCompletion: Math.round(enriched.reduce((sum, project) => sum + project.completionPercent, 0) / enriched.length),
    active: projects.filter((project) => project.status === "active").length, onTrack: projects.filter((project) => project.health === "on_track").length,
    atRisk: projects.filter((project) => project.health === "at_risk").length, delayed: projects.filter((project) => project.health === "delayed").length,
    paused: projects.filter((project) => project.health === "paused" || project.status === "paused").length, projects: enriched,
    attention: issues.filter((issue) => ["open", "in_progress"].includes(issue.status)).slice(0, 12), recentUpdates: updates.slice(0, 12)
  };
}

export const projectReportData = { listUpdates: listProjectUpdates, listIssues: listProjectIssues, listHealthHistory: listProjectHealthHistory };
