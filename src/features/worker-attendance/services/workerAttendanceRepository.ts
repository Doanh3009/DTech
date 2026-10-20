import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getProject, getProjectRoster } from "@/features/projects/services/projectRepository";
import type {
  createWorkerSessionSchema,
  closeWorkerDaySchema,
  existingWorkerSchema,
  temporaryWorkerSchema,
  workerAdjustmentSchema,
  workerSessionDraftSchema
} from "@/features/worker-attendance/schemas/workerAttendanceSchemas";
import { countWorkerAttendance, validateSessionForSubmit } from "@/features/worker-attendance/services/workerAttendanceRules";
import type {
  WorkerAttendanceAdjustment,
  WorkerAttendanceChecklistItem,
  WorkerAttendanceChecklistResponse,
  WorkerAttendanceEntry,
  WorkerAttendancePhoto,
  WorkerAttendancePolicy,
  WorkerAttendanceSession,
  WorkerAttendanceTask
} from "@/features/worker-attendance/types/workerAttendanceTypes";
import { recordAuditLog } from "@/services/audit/auditLog";
import { publishNotificationEvent } from "@/features/shared-platforms/services/notificationRepository";

type Row = Record<string, unknown>;

function deterministicPhotoAssetId(photoId: string, derivative: "full" | "thumbnail"): string {
  const value = createHash("sha256").update(`${photoId}:${derivative}`).digest("hex").slice(0, 32).split("");
  value[12] = "4";
  value[16] = ((Number.parseInt(value[16] ?? "0", 16) & 3) | 8).toString(16);
  const hex = value.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface Identity {
  accountId: string;
  employeeId: string;
  employeeName: string;
}

function db(): SupabaseClient {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return client;
}

function required(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) throw new AppError("SERVER_ERROR", "Dữ liệu thiếu " + key + ".");
  return value;
}

function optional(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value ? value : undefined;
}

function nested(row: Row, key: string): Row | undefined {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as Row | undefined;
  return value && typeof value === "object" ? value as Row : undefined;
}

const sessionSelect = "*,worksites(address,latitude,longitude,radius_meters),worker_attendance_entries(*),worker_attendance_photos(id,session_id,captured_at,sort_order),worker_attendance_adjustments(id,entry_id,reason,before_data,after_data,created_at)";

function mapEntry(row: Row): WorkerAttendanceEntry {
  return {
    id: required(row, "id"), sessionId: required(row, "session_id"), workerId: required(row, "worker_id"),
    employeeCode: required(row, "employee_code_snapshot"), workerName: required(row, "worker_name_snapshot"),
    assignmentRole: required(row, "assignment_role_snapshot"), status: required(row, "status") as WorkerAttendanceEntry["status"],
    exceptionReason: optional(row, "exception_reason") as WorkerAttendanceEntry["exceptionReason"],
    dayException: required(row, "day_exception") as WorkerAttendanceEntry["dayException"], exceptionTime: optional(row, "exception_time")?.slice(0, 5),
    isUnplanned: Boolean(row.is_unplanned), unplannedReason: optional(row, "unplanned_reason"), note: optional(row, "note")
  };
}

function mapPhoto(row: Row): WorkerAttendancePhoto {
  return { id: required(row, "id"), sessionId: required(row, "session_id"), capturedAt: required(row, "captured_at"), sortOrder: Number(row.sort_order) };
}

function mapAdjustment(row: Row): WorkerAttendanceAdjustment {
  return {
    id: required(row, "id"), entryId: optional(row, "entry_id"), reason: required(row, "reason"),
    before: (row.before_data ?? {}) as Record<string, unknown>, after: (row.after_data ?? {}) as Record<string, unknown>, createdAt: required(row, "created_at")
  };
}

function mapChecklist(value: unknown): WorkerAttendanceChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Row;
    if (typeof row.id !== "string" || typeof row.content !== "string") return [];
    return [{ id: row.id, group: typeof row.group === "string" ? row.group : "Khác", content: row.content, required: row.required !== false, sortOrder: Number(row.sortOrder ?? 0) }];
  }).sort((first, second) => first.sortOrder - second.sortOrder);
}

function mapChecklistResponses(value: unknown): WorkerAttendanceChecklistResponse[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Row;
    if (typeof row.itemId !== "string" || typeof row.checked !== "boolean") return [];
    return [{ itemId: row.itemId, checked: row.checked, note: typeof row.note === "string" && row.note ? row.note : undefined }];
  });
}

async function activeChecklist(client: SupabaseClient): Promise<WorkerAttendanceChecklistItem[]> {
  const { data, error } = await client.from("worker_attendance_checklist_items").select("id,group_name,content,required,sort_order").eq("active", true).order("sort_order").order("created_at");
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải checklist điểm danh.");
  return (data ?? []).map((row) => ({ id: String(row.id), group: String(row.group_name), content: String(row.content), required: Boolean(row.required), sortOrder: Number(row.sort_order) }));
}

function mapSession(row: Row): WorkerAttendanceSession {
  const site = nested(row, "worksites");
  const radius = Number(site?.radius_meters);
  const coordinates = [row.latitude, row.longitude, site?.latitude, site?.longitude];
  const verifiedWorksiteAddress = site && coordinates.every((value) => typeof value === "number" && Number.isFinite(value)) && radius > 0 && Number.isFinite(radius)
    && distanceMeters(row.latitude as number, row.longitude as number, site.latitude as number, site.longitude as number) <= radius ? optional(site, "address")?.trim() : undefined;
  return {
    id: required(row, "id"), clientSessionId: required(row, "client_session_id"), projectId: required(row, "project_id"),
    projectName: required(row, "project_name_snapshot"), worksiteId: required(row, "worksite_id"), worksiteName: required(row, "worksite_name_snapshot"),
    worksiteAddress: verifiedWorksiteAddress || undefined,
    date: required(row, "attendance_date"), shiftCode: required(row, "shift_code"), shiftName: required(row, "shift_name_snapshot"),
    sessionType: required(row, "session_type") as WorkerAttendanceSession["sessionType"], supervisorEmployeeId: required(row, "supervisor_employee_id"),
    supervisorName: required(row, "supervisor_name_snapshot"), startedAt: required(row, "started_at"), submittedAt: optional(row, "submitted_at"),
    dayClosedAt: optional(row, "day_closed_at"),
    capturedAtClient: required(row, "captured_at_client"), geofenceStatus: required(row, "geofence_status") as WorkerAttendanceSession["geofenceStatus"],
    latitude: typeof row.latitude === "number" ? row.latitude : undefined,
    longitude: typeof row.longitude === "number" ? row.longitude : undefined,
    distanceMeters: typeof row.distance_meters === "number" ? row.distance_meters : undefined,
    accuracyMeters: typeof row.accuracy_meters === "number" ? row.accuracy_meters : undefined,
    workNote: optional(row, "work_note"), note: optional(row, "note"), status: required(row, "status") as WorkerAttendanceSession["status"],
    syncStatus: required(row, "sync_status") as WorkerAttendanceSession["syncStatus"], photoStatus: required(row, "photo_status") as WorkerAttendanceSession["photoStatus"],
    version: Number(row.version), entries: ((row.worker_attendance_entries ?? []) as Row[]).map(mapEntry).sort((first, second) => first.employeeCode.localeCompare(second.employeeCode, "vi", { numeric: true }) || first.id.localeCompare(second.id)),
    photos: ((row.worker_attendance_photos ?? []) as Row[]).map(mapPhoto).sort((a, b) => a.sortOrder - b.sortOrder),
    adjustments: ((row.worker_attendance_adjustments ?? []) as Row[]).map(mapAdjustment),
    checklist: mapChecklist(row.checklist_snapshot), checklistResponses: mapChecklistResponses(row.checklist_responses)
  };
}

async function identity(client: SupabaseClient, user: AuthenticatedUser): Promise<Identity> {
  let query = client.from("app_accounts").select("id,employee_id,status,employees!app_accounts_employee_fk(full_name)").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email);
  const { data, error } = await query.maybeSingle();
  if (error || !data?.employee_id) throw new AppError("PERMISSION_DENIED", "Tài khoản chưa liên kết hồ sơ nhân viên.");
  if (data.status !== "active") throw new AppError("PERMISSION_DENIED", "Tài khoản không hoạt động.");
  return { accountId: String(data.id), employeeId: String(data.employee_id), employeeName: required(data.employees as unknown as Row, "full_name") };
}

async function policy(client: SupabaseClient): Promise<WorkerAttendancePolicy> {
  const { data, error } = await client.from("worker_attendance_policies").select("*").eq("active", true).maybeSingle();
  if (error || !data) throw new AppError("SERVER_ERROR", "Chưa có chính sách điểm danh công nhân.");
  return { minimumPhotos: data.minimum_photos, workNoteRequired: data.work_note_required, endOfDayRequired: data.end_of_day_required, offlineEnabled: data.offline_enabled, editWindowMinutes: data.edit_window_minutes };
}

function distanceMeters(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number): number {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(targetLatitude - latitude);
  const lng = radians(targetLongitude - longitude);
  const value = Math.sin(lat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(targetLatitude)) * Math.sin(lng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function workerCommandError(error: { message: string; code?: string }, fallback: string): AppError {
  if (error.message.includes("ACTOR_DENIED")) return new AppError("PERMISSION_DENIED");
  if (error.message.includes("NOT_FOUND")) return new AppError("NOT_FOUND", "Không tìm thấy phiên điểm danh.");
  if (error.message.includes("VERSION_CONFLICT")) return new AppError("CONFLICT", "Dữ liệu đã được cập nhật từ thiết bị khác.");
  if (error.message.includes("CLOSED_REPLAY_CONFLICT")) return new AppError("CONFLICT", "Ngày đã chốt với dữ liệu khác. Vui lòng tải lại.");
  if (error.message.includes("NOT_SUBMITTED")) return new AppError("CONFLICT", "Cần gửi điểm danh buổi sáng trước khi chốt ngày.");
  if (error.message.includes("NOT_EDITABLE")) return new AppError("CONFLICT", "Phiên đã gửi, không thể sửa bản nháp.");
  if (error.message.includes("ENTRY_INVALID")) return new AppError("VALIDATION_ERROR", "Danh sách công nhân không thuộc phiên này hoặc bị trùng.");
  if (error.message.includes("CHECKLIST_INVALID")) return new AppError("VALIDATION_ERROR", "Checklist không thuộc phiên điểm danh này.");
  if (error.message.includes("INPUT_INVALID") || error.code?.startsWith("22")) return new AppError("VALIDATION_ERROR", "Dữ liệu điểm danh hoặc giờ ngoại lệ không hợp lệ.");
  return new AppError("SERVER_ERROR", fallback);
}

async function assertProjectScope(client: SupabaseClient, user: AuthenticatedUser, employeeId: string, projectId: string, worksiteId: string, date: string) {
  if (can(user.permissions, "worker_attendance.view_all")) return;
  const { data, error } = await client.from("project_assignments").select("id").eq("project_id", projectId).eq("worksite_id", worksiteId).eq("employee_id", employeeId).in("assignment_role", ["supervisor_main", "supervisor_replacement", "project_manager"]).eq("status", "active").lte("start_date", date).or("end_date.is.null,end_date.gte." + date).limit(1);
  if (error) throw new AppError("SERVER_ERROR", "Không thể xác định phạm vi điểm danh công trường.");
  if (!data?.length) throw new AppError("PERMISSION_DENIED", "Bạn không được phân công điểm danh công trường này trong ngày đã chọn.");
}

export async function listTodayTasks(user: AuthenticatedUser, date: string): Promise<{ accountId: string; tasks: WorkerAttendanceTask[]; policy: WorkerAttendancePolicy }> {
  const client = db();
  const actor = await identity(client, user);
  let query = client.from("project_assignments").select("project_id,worksite_id,shift_code,shift_name,projects(name,status),worksites(name,status,gps_required,allowed_accuracy_threshold_meters)").eq("status", "active").in("assignment_role", ["supervisor_main", "supervisor_replacement", "project_manager"]).lte("start_date", date).or("end_date.is.null,end_date.gte." + date);
  if (!can(user.permissions, "worker_attendance.view_all")) query = query.eq("employee_id", actor.employeeId);
  const [{ data, error }, workerPolicy, checklist] = await Promise.all([query, policy(client), activeChecklist(client)]);
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải lịch điểm danh hôm nay.");
  const tasks: WorkerAttendanceTask[] = [];
  const seenTasks = new Set<string>();
  for (const row of data ?? []) {
    const project = nested(row as Row, "projects");
    const worksite = nested(row as Row, "worksites");
    if (!row.worksite_id || !project || !worksite || project.status === "closed" || worksite.status !== "active") continue;
    const taskKey = `${row.project_id}:${row.worksite_id}:${row.shift_code}`;
    if (seenTasks.has(taskKey)) continue;
    seenTasks.add(taskKey);
    const roster = await getProjectRoster(String(row.project_id), date, String(row.worksite_id));
    const { data: session, error: sessionError } = await client.from("worker_attendance_sessions").select("id,status").eq("project_id", row.project_id).eq("worksite_id", row.worksite_id).eq("attendance_date", date).eq("shift_code", row.shift_code).eq("session_type", "morning").maybeSingle();
    if (sessionError) throw new AppError("SERVER_ERROR", "Không thể đọc phiên điểm danh hiện có.");
    const workers = roster.filter((item) => item.assignmentRole === "worker" && item.shiftCode === row.shift_code);
    tasks.push({ projectId: String(row.project_id), projectName: required(project, "name"), worksiteId: String(row.worksite_id), worksiteName: required(worksite, "name"), date, shiftCode: String(row.shift_code), shiftName: String(row.shift_name), expectedWorkers: workers.length, gpsRequired: Boolean(worksite.gps_required), allowedAccuracyThresholdMeters: Number(worksite.allowed_accuracy_threshold_meters), existingSessionId: session?.id, existingStatus: session?.status, checklist, roster: workers.map((worker) => ({ workerId: worker.employeeId, employeeCode: worker.employeeCode, workerName: worker.employeeName, assignmentRole: worker.assignmentRole, approvedLeave: worker.approvedLeave })) });
  }
  return { accountId: actor.accountId, tasks, policy: workerPolicy };
}

export async function listWorkerSessions(user: AuthenticatedUser, filters: { from?: string; to?: string; projectId?: string; status?: string } = {}): Promise<WorkerAttendanceSession[]> {
  const client = db();
  const canViewAll = can(user.permissions, "worker_attendance.view_all");
  const actor = canViewAll ? undefined : await identity(client, user);
  let query = client.from("worker_attendance_sessions").select(sessionSelect).order("attendance_date", { ascending: false }).limit(200);
  if (actor) query = query.eq("supervisor_employee_id", actor.employeeId);
  if (filters.from) query = query.gte("attendance_date", filters.from);
  if (filters.to) query = query.lte("attendance_date", filters.to);
  if (filters.projectId) query = query.eq("project_id", filters.projectId);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách phiên điểm danh.");
  return (data ?? []).map((row) => mapSession(row as Row));
}

export async function getWorkerSession(user: AuthenticatedUser, sessionId: string): Promise<WorkerAttendanceSession> {
  const client = db();
  const actor = can(user.permissions, "worker_attendance.view_all") ? undefined : await identity(client, user);
  const { data, error } = await client.from("worker_attendance_sessions").select(sessionSelect).eq("id", sessionId).maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy phiên điểm danh.");
  await assertProjectScope(client, user, actor?.employeeId ?? "", data.project_id, data.worksite_id, data.attendance_date);
  return mapSession(data as Row);
}

export async function createWorkerSession(user: AuthenticatedUser, input: z.infer<typeof createWorkerSessionSchema>): Promise<{ session: WorkerAttendanceSession; idempotentReplay: boolean }> {
  if (!can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const { data: replay } = await client.from("worker_attendance_sessions").select(sessionSelect).eq("client_session_id", input.clientSessionId).maybeSingle();
  if (replay) return { session: mapSession(replay as Row), idempotentReplay: true };
  await assertProjectScope(client, user, actor.employeeId, input.projectId, input.worksiteId, input.date);
  const project = await getProject(input.projectId);
  if (project.status === "closed") throw new AppError("CONFLICT", "Dự án đã đóng.");
  const worksite = project.worksites.find((item) => item.id === input.worksiteId && item.status === "active");
  if (!worksite) throw new AppError("VALIDATION_ERROR", "Công trường không hoạt động.");
  const roster = (await getProjectRoster(input.projectId, input.date, input.worksiteId)).filter((item) => item.assignmentRole === "worker" && item.shiftCode === input.shiftCode);
  const checklist = await activeChecklist(client);
  let geofenceStatus: WorkerAttendanceSession["geofenceStatus"] = worksite.gpsRequired ? "unavailable" : "not_required";
  let distance: number | undefined;
  if (input.location) {
    const { data: siteRow } = await client.from("worksites").select("latitude,longitude").eq("id", input.worksiteId).single();
    geofenceStatus = input.location.accuracy > worksite.allowedAccuracyThresholdMeters ? "accuracy_low" : "valid";
    if (siteRow?.latitude != null && siteRow?.longitude != null) distance = distanceMeters(input.location.latitude, input.location.longitude, siteRow.latitude, siteRow.longitude);
  }
  const { data, error } = await client.from("worker_attendance_sessions").insert({
    client_session_id: input.clientSessionId, project_id: project.id, project_name_snapshot: project.name,
    worksite_id: worksite.id, worksite_name_snapshot: worksite.name, attendance_date: input.date,
    shift_code: input.shiftCode, shift_name_snapshot: roster[0]?.shiftName ?? "Ca ngày", session_type: input.sessionType,
    supervisor_employee_id: actor.employeeId, supervisor_name_snapshot: actor.employeeName,
    captured_at_client: input.capturedAtClient, latitude: input.location?.latitude ?? null, longitude: input.location?.longitude ?? null,
    accuracy_meters: input.location?.accuracy ?? null, distance_meters: distance ?? null, geofence_status: geofenceStatus,
    status: "in_progress", sync_status: "syncing", checklist_snapshot: checklist, checklist_responses: [], created_by: actor.accountId
  }).select("id").single();
  if (error || !data) {
    const { data: existing } = await client.from("worker_attendance_sessions").select(sessionSelect).eq("project_id", input.projectId).eq("worksite_id", input.worksiteId).eq("attendance_date", input.date).eq("shift_code", input.shiftCode).eq("session_type", input.sessionType).maybeSingle();
    if (existing) return { session: mapSession(existing as Row), idempotentReplay: true };
    throw new AppError("SERVER_ERROR", "Không thể tạo phiên điểm danh.");
  }
  if (roster.length) {
    const { error: entryError } = await client.from("worker_attendance_entries").insert(roster.map((worker) => ({ session_id: data.id, worker_id: worker.employeeId, employee_code_snapshot: worker.employeeCode, worker_name_snapshot: worker.employeeName, assignment_role_snapshot: worker.assignmentRole, status: worker.approvedLeave ? "leave" : "unconfirmed", exception_reason: worker.approvedLeave ? "approved_leave" : null })));
    if (entryError) { await client.from("worker_attendance_sessions").delete().eq("id", data.id); throw new AppError("SERVER_ERROR", "Không thể tạo snapshot roster."); }
  }
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.session_created", entityType: "worker_attendance_session", entityId: data.id, metadata: { projectId: project.id, worksiteId: worksite.id, rosterCount: roster.length } });
  return { session: await getWorkerSession(user, data.id), idempotentReplay: false };
}

export async function saveWorkerSessionDraft(user: AuthenticatedUser, sessionId: string, input: z.infer<typeof workerSessionDraftSchema>): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const session = await getWorkerSession(user, sessionId);
  if (session.status === "submitted" || session.status === "locked") throw new AppError("CONFLICT", "Phiên đã gửi, không thể sửa bản nháp.");
  if (session.version !== input.version) throw new AppError("CONFLICT", "Dữ liệu đã được cập nhật từ thiết bị khác.");
  const knownIds = new Set(session.entries.map((entry) => entry.id));
  if (input.entries.some((entry) => !knownIds.has(entry.id))) throw new AppError("VALIDATION_ERROR", "Danh sách công nhân không thuộc phiên này.");
  const checklistIds = new Set(session.checklist.map((item) => item.id));
  if (input.checklistResponses.some((response) => !checklistIds.has(response.itemId))) throw new AppError("VALIDATION_ERROR", "Checklist không thuộc phiên điểm danh này.");
  let gpsPatch: Row = {};
  if (input.location) {
    const { data: worksite, error: worksiteError } = await client.from("worksites").select("latitude,longitude,allowed_accuracy_threshold_meters").eq("id", session.worksiteId).single();
    if (worksiteError || !worksite) throw new AppError("SERVER_ERROR", "Không thể đọc cấu hình GPS công trường.");
    gpsPatch = {
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      accuracy_meters: input.location.accuracy,
      geofence_status: input.location.accuracy > Number(worksite.allowed_accuracy_threshold_meters) ? "accuracy_low" : "valid",
      distance_meters: worksite.latitude != null && worksite.longitude != null ? distanceMeters(input.location.latitude, input.location.longitude, worksite.latitude, worksite.longitude) : null
    };
  }
  const { data, error } = await client.rpc("save_worker_session_draft_command", { p_session_id: sessionId, p_expected_version: input.version, p_actor_id: actor.accountId, p_header: { work_note: input.workNote ?? null, note: input.note ?? null, checklist_responses: input.checklistResponses, ...gpsPatch }, p_entries: input.entries });
  if (error) throw workerCommandError(error, "Không thể lưu bản nháp điểm danh.");
  if (!data) throw new AppError("SERVER_ERROR", "Không thể xác nhận bản nháp điểm danh đã lưu.");
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.draft_saved", entityType: "worker_attendance_session", entityId: sessionId });
  return getWorkerSession(user, sessionId);
}

function isJpeg(bytes: Uint8Array) { return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; }
async function validatePhoto(file: File) {
  if (!file.size || file.size > 2 * 1024 * 1024) throw new AppError("PHOTO_UPLOAD", "Ảnh phải nhỏ hơn 2 MB.");
  if (file.type !== "image/jpeg" || !isJpeg(new Uint8Array(await file.slice(0, 4).arrayBuffer()))) throw new AppError("PHOTO_UPLOAD", "Ảnh phải là JPEG hợp lệ.");
}

export async function uploadWorkerPhoto(user: AuthenticatedUser, sessionId: string, input: { photoId: string; photo: File; thumbnail: File; width: number; height: number; capturedAt: string }): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const session = await getWorkerSession(user, sessionId);
  if (session.status === "locked") throw new AppError("CONFLICT", "Phiên đã khóa.");
  const { data: existingPhoto, error: existingPhotoError } = await client.from("worker_attendance_photos").select("id,session_id").eq("id", input.photoId).maybeSingle();
  if (existingPhotoError) throw new AppError("PHOTO_UPLOAD", "Không thể kiểm tra thao tác tải ảnh.");
  if (existingPhoto) {
    if (existingPhoto.session_id !== sessionId) throw new AppError("CONFLICT", "Mã thao tác ảnh đã được sử dụng.");
    return session;
  }
  await Promise.all([validatePhoto(input.photo), validatePhoto(input.thumbnail)]);
  const photoId = input.photoId;
  const prefix = `${session.date.slice(0, 7).replace("-", "/")}/${session.projectId}/${sessionId}/${photoId}`;
  const paths = [`${prefix}.jpg`, `${prefix}-thumb.jpg`];
  try {
    for (const [index, file] of [input.photo, input.thumbnail].entries()) {
      const { error } = await client.storage.from("worker-attendance-photos").upload(paths[index], file, { contentType: "image/jpeg", upsert: true });
      if (error) throw new AppError("PHOTO_UPLOAD", "Ảnh chưa thể đồng bộ.");
    }
    const fullId = deterministicPhotoAssetId(photoId, "full"); const thumbId = deterministicPhotoAssetId(photoId, "thumbnail");
    const { error: assetError } = await client.from("file_assets").upsert([
      { id: fullId, bucket: "worker-attendance-photos", object_path: paths[0], owner_entity_type: "worker_attendance_session", owner_entity_id: sessionId, mime_type: "image/jpeg", byte_size: input.photo.size, visibility: "private", created_by: actor.accountId, metadata: { derivative: "full" } },
      { id: thumbId, bucket: "worker-attendance-photos", object_path: paths[1], owner_entity_type: "worker_attendance_session", owner_entity_id: sessionId, mime_type: "image/jpeg", byte_size: input.thumbnail.size, visibility: "private", created_by: actor.accountId, metadata: { derivative: "thumbnail" } }
    ], { onConflict: "bucket,object_path" });
    if (assetError) throw new AppError("PHOTO_UPLOAD", "Không thể lưu thông tin ảnh.");
    const { error: photoError } = await client.from("worker_attendance_photos").upsert({ id: photoId, session_id: sessionId, file_id: fullId, thumbnail_file_id: thumbId, captured_at: input.capturedAt, sort_order: session.photos.length, width: input.width, height: input.height, metadata: { normalizedOrientation: true } }, { onConflict: "id" });
    if (photoError) throw new AppError("PHOTO_UPLOAD", "Không thể liên kết ảnh với phiên.");
    await client.from("worker_attendance_sessions").update({ photo_status: "uploaded" }).eq("id", sessionId);
    await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.photo_linked", entityType: "worker_attendance_session", entityId: sessionId, metadata: { photoId } });
    return getWorkerSession(user, sessionId);
  } catch (error) {
    // Retain deterministic objects so the same client operation can safely resume after a lost response.
    await client.from("worker_attendance_sessions").update({ photo_status: "upload_failed", sync_status: "sync_failed" }).eq("id", sessionId);
    throw error;
  }
}

export async function submitWorkerSession(user: AuthenticatedUser, sessionId: string, version: number): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const client = db(); const actor = await identity(client, user); const session = await getWorkerSession(user, sessionId);
  if (session.status === "submitted" || session.status === "locked") return session;
  if (session.version !== version) throw new AppError("CONFLICT", "Dữ liệu đã được cập nhật từ thiết bị khác.");
  const errors = validateSessionForSubmit({ entries: session.entries, photoCount: session.photos.length, workNote: session.workNote, geofenceStatus: session.geofenceStatus, latitude: session.latitude, longitude: session.longitude, checklist: session.checklist, checklistResponses: session.checklistResponses }, await policy(client));
  if (errors.length) throw new AppError("VALIDATION_ERROR", errors.join(" "));
  const { data, error } = await client.from("worker_attendance_sessions").update({ status: "submitted", submitted_at: new Date().toISOString(), sync_status: "synced" }).eq("id", sessionId).eq("version", version).select("id").maybeSingle();
  if (error || !data) throw new AppError("CONFLICT", "Phiên vừa được cập nhật từ thiết bị khác.");
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.submitted", entityType: "worker_attendance_session", entityId: sessionId, after: { ...countWorkerAttendance(session.entries) } });
  return getWorkerSession(user, sessionId);
}

export async function addTemporaryWorker(user: AuthenticatedUser, sessionId: string, input: z.infer<typeof temporaryWorkerSchema>): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const client = db(); const actor = await identity(client, user); const session = await getWorkerSession(user, sessionId);
  if (session.status === "submitted" || session.status === "locked") throw new AppError("CONFLICT", "Phiên đã gửi.");
  if (input.phone) {
    const normalized = input.phone.replace(/\D/g, "").replace(/^0/, "84");
    const { data: similar } = await client.from("employees").select("id,full_name,employee_code").or(`normalized_phone.eq.${normalized},full_name.ilike.%${input.fullName.replace(/[%_,]/g, "")}%`).limit(5);
    if (similar?.length) throw new AppError("CONFLICT", "Có thể người này đã tồn tại. Hãy chọn hồ sơ hiện có.", { candidates: similar });
  }
  const [{ data: department }, { data: position }, { data: employmentType }] = await Promise.all([
    client.from("departments").select("id").eq("code", "construction").single(), client.from("positions").select("id").eq("code", "worker").single(), client.from("employment_types").select("id").eq("code", "worker").single()
  ]);
  const employeeCode = "TMP-" + Date.now().toString(36).toUpperCase();
  const { data: worker, error } = await client.from("employees").insert({ employee_code: employeeCode, full_name: input.fullName, display_name: input.fullName, personal_phone: input.phone || "Chưa cập nhật", normalized_phone: input.phone?.replace(/\D/g, "").replace(/^0/, "84") || employeeCode, department_id: department!.id, position_id: position!.id, employment_type_id: employmentType!.id, contractor_name: input.contractorName || null, join_date: session.date, employment_status: "pending_onboarding", profile_status: "pending_hr_completion", profile_completeness: 20, note: input.note || "Tạo từ điểm danh công nhân", created_by: actor.accountId }).select("id").single();
  if (error || !worker) throw new AppError("SERVER_ERROR", "Không thể tạo hồ sơ công nhân tạm.");
  const { error: entryError } = await client.from("worker_attendance_entries").insert({ session_id: sessionId, worker_id: worker.id, employee_code_snapshot: employeeCode, worker_name_snapshot: input.fullName, assignment_role_snapshot: "worker", status: "unconfirmed", is_unplanned: true, unplanned_reason: input.unplannedReason });
  if (entryError) throw new AppError("SERVER_ERROR", "Không thể thêm công nhân vào phiên.");
  await client.from("worker_attendance_sessions").update({ sync_status: "synced" }).eq("id", sessionId);
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.temporary_worker_added", entityType: "worker_attendance_session", entityId: sessionId, metadata: { workerId: worker.id } });
  return getWorkerSession(user, sessionId);
}

export async function addExistingWorker(user: AuthenticatedUser, sessionId: string, input: z.infer<typeof existingWorkerSchema>): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const session = await getWorkerSession(user, sessionId);
  if (session.status === "submitted" || session.status === "locked") throw new AppError("CONFLICT", "Phiên đã gửi.");
  if (session.entries.some((entry) => entry.workerId === input.workerId)) throw new AppError("CONFLICT", "Công nhân đã có trong danh sách.");
  const { data: worker, error } = await client.from("employees").select("id,employee_code,full_name,employment_status").eq("id", input.workerId).maybeSingle();
  if (error || !worker) throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ công nhân.");
  if (!["active", "probation", "pending_onboarding"].includes(worker.employment_status)) throw new AppError("CONFLICT", "Hồ sơ công nhân không còn hoạt động.");
  const { error: entryError } = await client.from("worker_attendance_entries").insert({ session_id: sessionId, worker_id: worker.id, employee_code_snapshot: worker.employee_code, worker_name_snapshot: worker.full_name, assignment_role_snapshot: "worker", status: "unconfirmed", is_unplanned: true, unplanned_reason: input.unplannedReason });
  if (entryError) throw new AppError(entryError.code === "23505" ? "CONFLICT" : "SERVER_ERROR", entryError.code === "23505" ? "Công nhân đã có trong danh sách." : "Không thể thêm công nhân.");
  await client.from("worker_attendance_sessions").update({ sync_status: "synced" }).eq("id", sessionId);
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.existing_worker_added", entityType: "worker_attendance_session", entityId: sessionId, metadata: { workerId: worker.id, unplannedReason: input.unplannedReason } });
  return getWorkerSession(user, sessionId);
}

export async function closeWorkerSessionDay(user: AuthenticatedUser, sessionId: string, input: z.infer<typeof closeWorkerDaySchema>): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.create") && !can(user.permissions, "worker_attendance.adjust")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const session = await getWorkerSession(user, sessionId);
  if (!session.submittedAt) throw new AppError("CONFLICT", "Cần gửi điểm danh buổi sáng trước khi chốt ngày.");
  if (!session.dayClosedAt && session.version !== input.version) throw new AppError("CONFLICT", "Dữ liệu đã được cập nhật từ thiết bị khác.");
  const knownEntries = new Map(session.entries.map((entry) => [entry.id, entry]));
  if (input.entries.some((entry) => !knownEntries.has(entry.id))) throw new AppError("VALIDATION_ERROR", "Danh sách công nhân không thuộc phiên này.");
  const exceptionCount = input.entries.filter(change => { const before = knownEntries.get(change.id)!; return before.dayException !== change.dayException || (before.exceptionTime ?? null) !== (change.exceptionTime ?? null); }).length;
  const { data, error } = await client.rpc("close_worker_session_day_command", { p_session_id: sessionId, p_expected_version: input.version, p_actor_id: actor.accountId, p_entries: input.entries, p_reason: input.reason });
  if (error) throw workerCommandError(error, "Không thể chốt ngày điểm danh.");
  if (!data) throw new AppError("SERVER_ERROR", "Không thể xác nhận ngày điểm danh đã chốt.");
  if (!session.dayClosedAt) await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.day_closed", entityType: "worker_attendance_session", entityId: sessionId, reason: input.reason, metadata: { exceptionCount } });
  return getWorkerSession(user, sessionId);
}

export async function adjustWorkerEntry(user: AuthenticatedUser, sessionId: string, input: z.infer<typeof workerAdjustmentSchema>): Promise<WorkerAttendanceSession> {
  if (!can(user.permissions, "worker_attendance.adjust")) throw new AppError("PERMISSION_DENIED");
  const client = db(); const actor = await identity(client, user); const session = await getWorkerSession(user, sessionId);
  if (session.version !== input.version) throw new AppError("CONFLICT", "Dữ liệu đã được cập nhật từ thiết bị khác.");
  const entry = session.entries.find((item) => item.id === input.entryId);
  if (!entry) throw new AppError("NOT_FOUND", "Không tìm thấy công nhân trong phiên.");
  const before = { status: entry.status }; const after = { status: input.status };
  const { data, error } = await client.rpc("adjust_worker_entry_command", { p_session_id: sessionId, p_expected_version: input.version, p_actor_id: actor.accountId, p_entry_id: entry.id, p_status: input.status, p_reason: input.reason });
  if (error) throw workerCommandError(error, "Không thể điều chỉnh điểm danh công nhân.");
  if (!data) throw new AppError("SERVER_ERROR", "Không thể xác nhận điều chỉnh điểm danh.");
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.adjusted", entityType: "worker_attendance_session", entityId: sessionId, before, after, reason: input.reason });
  return getWorkerSession(user, sessionId);
}

export async function remindWorkerAttendanceSupervisor(user: AuthenticatedUser, input: { projectId: string; date: string }) {
  if (!can(user.permissions, "worker_attendance.adjust")) throw new AppError("PERMISSION_DENIED");
  const client = db();
  const actor = await identity(client, user);
  const project = await getProject(input.projectId, user);
  const { data: assignments, error: assignmentError } = await client.from("project_assignments")
    .select("employee_id")
    .eq("project_id", input.projectId)
    .eq("status", "active")
    .in("assignment_role", ["supervisor_main", "supervisor_replacement", "project_manager"])
    .lte("start_date", input.date)
    .or(`end_date.is.null,end_date.gte.${input.date}`);
  if (assignmentError) throw new AppError("SERVER_ERROR", "Không thể tìm kỹ sư phụ trách.");
  const employeeIds = [...new Set((assignments ?? []).map((item) => String(item.employee_id)))];
  if (!employeeIds.length) throw new AppError("NOT_FOUND", "Chưa phân công kỹ sư phụ trách.");
  const { data: accounts, error: accountError } = await client.from("app_accounts").select("id").in("employee_id", employeeIds).eq("status", "active");
  if (accountError) throw new AppError("SERVER_ERROR", "Không thể tìm tài khoản kỹ sư.");
  const recipients = (accounts ?? []).map((item) => String(item.id));
  if (!recipients.length) throw new AppError("NOT_FOUND", "Kỹ sư phụ trách chưa có tài khoản hoạt động.");
  const result = await publishNotificationEvent({
    eventKey: "worker_attendance.reminder",
    aggregateType: "project",
    aggregateId: input.projectId,
    actorAccountId: actor.accountId,
    idempotencyKey: `worker-attendance:${input.projectId}:${input.date}:reminder`,
    recipients,
    values: { project_name: project.name, attendance_date: input.date },
    deepLink: `/projects/${input.projectId}/team`,
    priority: "important"
  }, client);
  await recordAuditLog({ actorId: actor.accountId, action: "worker_attendance.reminder_sent", entityType: "project", entityId: input.projectId, metadata: { date: input.date, recipients: recipients.length } });
  return { ...result, recipients: recipients.length };
}

export async function getWorkerPhotoAsset(user: AuthenticatedUser, photoId: string, thumbnail: boolean) {
  const client = db(); const actor = await identity(client, user);
  const { data, error } = await client.from("worker_attendance_photos").select("session_id,evidence_status,worker_attendance_sessions(project_id,worksite_id,attendance_date),file_assets!worker_attendance_photos_file_id_fkey(bucket,object_path),thumbnail:file_assets!worker_attendance_photos_thumbnail_file_id_fkey(bucket,object_path)").eq("id", photoId).maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy ảnh điểm danh.");
  if (data.evidence_status === "expired") throw new AppError("NOT_FOUND", "Ảnh điểm danh đã hết thời hạn lưu 45 ngày.");
  const session = data.worker_attendance_sessions as unknown as Row;
  await assertProjectScope(client, user, actor.employeeId, required(session, "project_id"), required(session, "worksite_id"), required(session, "attendance_date"));
  if (!can(user.permissions, "worker_attendance.view_photo") && !can(user.permissions, "worker_attendance.create")) throw new AppError("PERMISSION_DENIED");
  const asset = (thumbnail ? data.thumbnail : data.file_assets) as unknown as Row | undefined;
  if (!asset) throw new AppError("NOT_FOUND", "Ảnh chưa đồng bộ.");
  return { bucket: required(asset, "bucket"), path: required(asset, "object_path") };
}
