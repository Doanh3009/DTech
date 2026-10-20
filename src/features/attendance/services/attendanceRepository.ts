import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { matchAttendanceLocation, getNextAttendanceAction } from "@/features/attendance/services/attendanceRules";
import type {
  AttendanceDashboard,
  AttendanceAdminToday,
  AttendanceEvent,
  AttendanceEventAdjustment,
  AttendanceHistoryDay,
  AttendanceLocation,
  AttendancePolicy,
  AttendanceRecordInput,
  AttendanceRecordResult
} from "@/features/attendance/types/attendanceTypes";
import { recordAuditLog } from "@/services/audit/auditLog";
import type { z } from "zod";
import type { attendanceAdjustmentSchema } from "@/features/attendance/schemas/attendanceSchemas";

type Row = Record<string, unknown>;

function canViewAttendancePhotos(user: AuthenticatedUser): boolean {
  return can(user.permissions, "attendance.view_photo") || can(user.permissions, "attendance.photo.view");
}

function deterministicUuid(operationId: string, derivative: "full" | "thumbnail"): string {
  const value = createHash("sha256").update(`${operationId}:${derivative}`).digest("hex").slice(0, 32).split("");
  value[12] = "4";
  value[16] = ((Number.parseInt(value[16] ?? "0", 16) & 3) | 8).toString(16);
  const hex = value.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface AttendanceIdentity {
  accountId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
}

function clientOrThrow(): SupabaseClient {
  const client = getSupabaseServiceClient();
  if (!client) {
    throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình cho chấm công.");
  }
  return client;
}

function requiredString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value) throw new AppError("SERVER_ERROR", `Dữ liệu thiếu ${key}.`);
  return value;
}

function optionalString(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value ? value : undefined;
}

function numberValue(row: Row, key: string): number | undefined {
  const value = row[key];
  return typeof value === "number" ? value : undefined;
}

function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function mapPolicy(row: Row): AttendancePolicy {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    attendanceEnabled: Boolean(row.attendance_enabled),
    photoRequired: Boolean(row.photo_required),
    gpsRequired: Boolean(row.gps_required),
    offlineEnabled: Boolean(row.offline_enabled),
    allowedAccuracyThresholdMeters: Number(row.allowed_accuracy_threshold_meters),
    earlyCheckinWindowMinutes: Number(row.early_checkin_window_minutes),
    lateThresholdMinutes: Number(row.late_threshold_minutes),
    shiftName: requiredString(row, "shift_name"),
    shiftStart: requiredString(row, "shift_start").slice(0, 5),
    shiftEnd: requiredString(row, "shift_end").slice(0, 5),
    timezone: requiredString(row, "timezone")
  };
}

function mapLocation(row: Row): AttendanceLocation {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    active: Boolean(row.active)
  };
}

function mapEvent(row: Row): AttendanceEvent {
  const location = row.attendance_locations as Row | null | undefined;
  const employee = row.employees as Row | null | undefined;
  const photos = row.attendance_photos as Row[] | Row | null | undefined;
  const photo = Array.isArray(photos) ? photos[0] : photos;
  return {
    id: requiredString(row, "id"),
    clientEventId: requiredString(row, "client_event_id"),
    employeeId: requiredString(row, "employee_id"),
    employeeName: employee ? optionalString(employee, "full_name") : undefined,
    employeeCode: employee ? optionalString(employee, "employee_code") : undefined,
    eventType: requiredString(row, "event_type") as AttendanceEvent["eventType"],
    attendanceDate: requiredString(row, "attendance_date"),
    effectiveAt: requiredString(row, "effective_at"),
    capturedAtClient: requiredString(row, "captured_at_client"),
    receivedAtServer: requiredString(row, "received_at_server"),
    locationId: optionalString(row, "location_id"),
    locationName: location ? optionalString(location, "name") : undefined,
    latitude: numberValue(row, "latitude"),
    longitude: numberValue(row, "longitude"),
    accuracyMeters: numberValue(row, "accuracy_meters"),
    distanceMeters: numberValue(row, "distance_meters"),
    geofenceStatus: requiredString(row, "geofence_status") as AttendanceEvent["geofenceStatus"],
    attendanceStatus: requiredString(row, "attendance_status") as AttendanceEvent["attendanceStatus"],
    photoStatus: requiredString(row, "photo_status") as AttendanceEvent["photoStatus"],
    syncStatus: requiredString(row, "sync_status") as AttendanceEvent["syncStatus"],
    photoId: photo ? optionalString(photo, "id") : undefined,
    anomalyFlags: Array.isArray(row.anomaly_flags) ? row.anomaly_flags.filter((item): item is string => typeof item === "string") : []
  };
}

const eventSelect = "*,attendance_locations(name),employees(full_name,employee_code),attendance_photos(id)";

async function resolveIdentity(client: SupabaseClient, user: AuthenticatedUser): Promise<AttendanceIdentity> {
  let query = client
    .from("app_accounts")
    .select("id,employee_id,status,employees!app_accounts_employee_fk(full_name,employee_code)")
    .limit(1);
  query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email);
  const { data, error } = await query.maybeSingle();
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc tài khoản chấm công.");
  if (!data?.employee_id) {
    throw new AppError("PERMISSION_DENIED", "Tài khoản chưa liên kết với hồ sơ nhân viên.");
  }
  if (data.status !== "active") throw new AppError("PERMISSION_DENIED", "Tài khoản không hoạt động.");
  const employee = data.employees as unknown as Row | null;
  return {
    accountId: String(data.id),
    employeeId: String(data.employee_id),
    employeeName: employee ? requiredString(employee, "full_name") : user.displayName,
    employeeCode: employee ? requiredString(employee, "employee_code") : ""
  };
}

async function resolveAccountId(client: SupabaseClient, user: AuthenticatedUser): Promise<string> {
  let query = client.from("app_accounts").select("id,status").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(user.id) ? query.eq("id", user.id) : query.eq("primary_email", user.email);
  const { data } = await query.maybeSingle();
  if (!data?.id || data.status !== "active") throw new AppError("PERMISSION_DENIED");
  return String(data.id);
}

async function scopedAttendanceEmployeeIds(client: SupabaseClient, user: AuthenticatedUser): Promise<string[] | undefined> {
  if (
    can(user.permissions, "attendance.view_all") ||
    can(user.permissions, "attendance.manage") ||
    can(user.permissions, "attendance.log.view")
  ) {
    return undefined;
  }

  const identity = await resolveIdentity(client, user);
  if (!can(user.permissions, "attendance.view_team")) return [identity.employeeId];

  const { data, error } = await client
    .from("employees")
    .select("id")
    .eq("manager_employee_id", identity.employeeId);
  if (error) throw new AppError("SERVER_ERROR", "Không thể xác định phạm vi chấm công đội nhóm.");
  return [identity.employeeId, ...(data ?? []).map((employee) => String(employee.id))];
}

async function readPolicy(client: SupabaseClient): Promise<AttendancePolicy> {
  const { data, error } = await client.from("attendance_policies").select("*").eq("active", true).maybeSingle();
  if (error || !data) throw new AppError("SERVER_ERROR", "Chưa có chính sách chấm công đang hoạt động.");
  return mapPolicy(data as Row);
}

async function readLocations(client: SupabaseClient, employeeId?: string): Promise<AttendanceLocation[]> {
  if (employeeId) {
    const { data: assignments, error } = await client
      .from("employee_attendance_locations")
      .select("attendance_locations(*)")
      .eq("employee_id", employeeId);
    if (error) throw new AppError("SERVER_ERROR", "Không thể đọc địa điểm được phép.");
    const assigned = (assignments ?? [])
      .map((item) => item.attendance_locations as unknown as Row | null)
      .filter((item): item is Row => Boolean(item))
      .map(mapLocation)
      .filter((item) => item.active);
    if (assigned.length > 0) return assigned;
  }
  const { data, error } = await client.from("attendance_locations").select("*").eq("active", true).order("name");
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc địa điểm chấm công.");
  return (data ?? []).map((row) => mapLocation(row as Row));
}

async function readEvents(
  client: SupabaseClient,
  filters: { employeeId?: string; date?: string; from?: string; to?: string; limit?: number } = {}
): Promise<AttendanceEvent[]> {
  let query = client.from("attendance_events").select(eventSelect).order("effective_at", { ascending: false });
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  if (filters.date) query = query.eq("attendance_date", filters.date);
  if (filters.from) query = query.gte("attendance_date", filters.from);
  if (filters.to) query = query.lte("attendance_date", filters.to);
  if (filters.limit) {
    const { data, error } = await query.limit(filters.limit);
    if (error) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu chấm công.");
    return (data ?? []).map((row) => mapEvent(row as Row));
  }
  const events: AttendanceEvent[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await query.range(offset, offset + 999);
    if (error) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu chấm công.");
    events.push(...(data ?? []).map((row) => mapEvent(row as Row)));
    if ((data ?? []).length < 1000) break;
  }
  return events;
}

export async function getAttendanceDashboard(user: AuthenticatedUser): Promise<AttendanceDashboard> {
  const client = clientOrThrow();
  const [identity, policy] = await Promise.all([
    resolveIdentity(client, user),
    readPolicy(client)
  ]);
  const today = localDate(new Date(), policy.timezone);
  const [locations, recentEvents] = await Promise.all([
    readLocations(client, identity.employeeId),
    readEvents(client, { employeeId: identity.employeeId, limit: 20 })
  ]);
  const todayEvents = recentEvents.filter((event) => event.attendanceDate === today);
  const days = new Map<string, AttendanceEvent[]>();
  for (const event of recentEvents) days.set(event.attendanceDate, [...(days.get(event.attendanceDate) ?? []), event]);
  const incompletePreviousDate = [...days.entries()]
    .find(([date, events]) => date !== today && getNextAttendanceAction(events) === "check_out")?.[0];
  return {
    ...identity,
    policy,
    locations,
    todayEvents: [...todayEvents].reverse(),
    lastEvent: recentEvents[0],
    nextAction: getNextAttendanceAction(todayEvents),
    incompletePreviousDate
  };
}

export async function getAttendanceAdminToday(user: AuthenticatedUser, selectedDate?: string): Promise<AttendanceAdminToday> {
  if (!can(user.permissions, "attendance.view_all") && !can(user.permissions, "attendance.manage")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow(), policy = await readPolicy(client), today = selectedDate ?? localDate(new Date(), policy.timezone);
  const [{ data: employees, error: employeeError }, events, { data: leaves, error: leaveError }, { data: departments, error: departmentError }, { data: shifts, error: shiftError }, { data: assignments, error: assignmentError }] = await Promise.all([
    client.from("employees").select("id,employee_code,full_name,department_id").in("employment_status", ["active", "probation", "pending_onboarding"]).order("employee_code").range(0, 999),
    readEvents(client, { date: today }),
    client.from("leave_requests").select("employee_id").eq("status", "approved").lte("start_date", today).gte("end_date", today),
    client.from("departments").select("id,name"),
    client.from("shifts").select("id,name,start_time,end_time,late_grace_minutes,early_leave_grace_minutes").eq("active", true),
    client.from("shift_assignments").select("shift_id,scope_type,scope_id,effective_from,effective_to,weekdays").eq("active", true).lte("effective_from", today).or(`effective_to.is.null,effective_to.gte.${today}`)
  ]);
  if (employeeError || leaveError || departmentError || shiftError || assignmentError) throw new AppError("SERVER_ERROR", "Không thể đọc dữ liệu chấm công nhân viên.");
  const employeeRows = [...(employees ?? [])];
  if (employeeRows.length === 1000) {
    for (let offset = 1000; ; offset += 1000) {
      const { data, error } = await client.from("employees").select("id,employee_code,full_name,department_id").in("employment_status", ["active", "probation", "pending_onboarding"]).order("employee_code").range(offset, offset + 999);
      if (error) throw new AppError("SERVER_ERROR", "Không thể đọc nhân viên chấm công.");
      employeeRows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
  }
  const departmentNames = new Map((departments ?? []).map((item) => [String(item.id), String(item.name)]));
  const shiftById = new Map((shifts ?? []).map((item) => [String(item.id), item]));
  const weekday = new Date(`${today}T12:00:00`).getDay() || 7;
  const activeAssignments = (assignments ?? []).filter((item) => Array.isArray(item.weekdays) && item.weekdays.includes(weekday));
  const leaveIds = new Set((leaves ?? []).map((row) => String(row.employee_id)));
  const byEmployee = new Map<string, AttendanceEvent[]>();
  for (const event of events) byEmployee.set(event.employeeId, [...(byEmployee.get(event.employeeId) ?? []), event]);
  const minute = (value:string) => { const date = new Date(value); return Number(new Intl.DateTimeFormat("en-GB",{timeZone:policy.timezone,hour:"2-digit",minute:"2-digit",hour12:false}).format(date).slice(0,2))*60+Number(new Intl.DateTimeFormat("en-GB",{timeZone:policy.timezone,minute:"2-digit"}).format(date)); };
  const rows = employeeRows.map((employee) => {
    const assignment = activeAssignments
      .filter((item) => item.scope_type === "company" || item.scope_type === "department" && item.scope_id === employee.department_id || item.scope_type === "employee" && item.scope_id === employee.id)
      .sort((a, b) => ({ employee: 3, department: 2, company: 1 }[String(b.scope_type) as "employee" | "department" | "company"] ?? 0) - ({ employee: 3, department: 2, company: 1 }[String(a.scope_type) as "employee" | "department" | "company"] ?? 0) || String(b.effective_from).localeCompare(String(a.effective_from)))[0];
    const shift = assignment ? shiftById.get(String(assignment.shift_id)) : undefined;
    const start = String(shift?.start_time ?? policy.shiftStart).slice(0, 5);
    const end = String(shift?.end_time ?? policy.shiftEnd).slice(0, 5);
    const shiftStartMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
    const shiftEndMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
    const daily = (byEmployee.get(String(employee.id)) ?? []).sort((a,b)=>a.effectiveAt.localeCompare(b.effectiveAt));
    const accepted = daily.filter((event) => event.attendanceStatus !== "rejected");
    const checkIn = accepted.find((event)=>event.eventType==="check_in"), checkOut = [...accepted].reverse().find((event)=>event.eventType==="check_out");
    const lateMinutes = checkIn ? Math.max(0, minute(checkIn.effectiveAt)-shiftStartMinutes-Number(shift?.late_grace_minutes ?? policy.lateThresholdMinutes)) : 0;
    const earlyLeaveMinutes = checkOut ? Math.max(0, shiftEndMinutes-minute(checkOut.effectiveAt)-Number(shift?.early_leave_grace_minutes ?? 0)) : 0;
    const totalMinutes = checkIn&&checkOut ? Math.max(0,Math.round((new Date(checkOut.effectiveAt).getTime()-new Date(checkIn.effectiveAt).getTime())/60000)) : 0;
    const shiftHasEnded = today < localDate(new Date(), policy.timezone) || today === localDate(new Date(), policy.timezone) && minute(new Date().toISOString()) > shiftEndMinutes;
    const status = leaveIds.has(String(employee.id)) ? "leave" : checkIn&&!checkOut&&shiftHasEnded ? "missing_check" : lateMinutes>0 ? "late" : checkIn ? "present" : "not_checked";
    return { employeeId:String(employee.id),employeeCode:String(employee.employee_code),employeeName:String(employee.full_name),departmentId:employee.department_id ? String(employee.department_id) : undefined,departmentName:departmentNames.get(String(employee.department_id)) ?? "Chưa phân phòng",shiftId:shift ? String(shift.id) : undefined,shiftName:String(shift?.name ?? policy.shiftName),checkIn:checkIn?.effectiveAt,checkOut:checkOut?.effectiveAt,lateMinutes,earlyLeaveMinutes,totalMinutes,status,events:daily } as const;
  });
  return { date:today,canViewPhotos:canViewAttendancePhotos(user),totalEmployees:rows.length,present:rows.filter((row)=>row.status==="present"||row.status==="late"||row.status==="missing_check").length,late:rows.filter((row)=>row.status==="late").length,leave:rows.filter((row)=>row.status==="leave").length,notChecked:rows.filter((row)=>row.status==="not_checked").length,missingCheck:rows.filter((row)=>row.status==="missing_check").length,rows };
}

export async function recordAttendance(
  user: AuthenticatedUser,
  input: AttendanceRecordInput
): Promise<AttendanceRecordResult> {
  const client = clientOrThrow();
  const identity = await resolveIdentity(client, user);
  const { data: replay } = await client
    .from("attendance_events")
    .select(eventSelect)
    .eq("client_event_id", input.clientEventId)
    .eq("employee_id", identity.employeeId)
    .maybeSingle();
  if (replay) return { event: mapEvent(replay as Row), idempotentReplay: true };

  const [policy, locations] = await Promise.all([readPolicy(client), readLocations(client, identity.employeeId)]);
  if (!policy.attendanceEnabled) throw new AppError("PERMISSION_DENIED", "Chức năng chấm công đang tạm khóa.");
  if (input.capturedOffline && !policy.offlineEnabled) {
    throw new AppError("NETWORK_ERROR", "Chính sách hiện tại không cho phép chấm công khi ngoại tuyến.");
  }

  const serverNow = new Date();
  const capturedAt = new Date(input.capturedAtClient);
  const ageMilliseconds = serverNow.getTime() - capturedAt.getTime();
  if (!Number.isFinite(ageMilliseconds) || ageMilliseconds > 48 * 60 * 60 * 1000 || ageMilliseconds < -5 * 60 * 1000) {
    throw new AppError("VALIDATION_ERROR", "Thời gian ghi nhận trên thiết bị không hợp lệ.");
  }

  const location = input.location && Math.abs(Date.parse(input.location.capturedAt) - capturedAt.getTime()) <= 60_000 ? input.location : undefined;
  const match = matchAttendanceLocation(location, locations, policy);

  // The camera timestamp is the attendance time; GPS acquisition and mobile
  // network latency must not turn an on-time capture into a late check-in.
  const effectiveAt = capturedAt;
  const attendanceDate = localDate(effectiveAt, policy.timezone);
  const existing = await readEvents(client, { employeeId: identity.employeeId, date: attendanceDate });
  const eventType = getNextAttendanceAction(existing);
  if (eventType === "completed") {
    throw new AppError("DUPLICATE", "Bạn đã hoàn tất chấm vào và chấm ra trong ngày này.");
  }
  if (input.intendedType && input.intendedType !== eventType) {
    throw new AppError("DUPLICATE", "Lượt chấm này đã được ghi nhận. Vui lòng tải lại trạng thái hôm nay.");
  }

  const anomalyFlags: string[] = [];
  if (match.status === "accuracy_low") anomalyFlags.push("gps_accuracy_low");
  if (match.status === "unavailable") anomalyFlags.push("gps_unavailable");
  if (!input.capturedOffline && Math.abs(ageMilliseconds) > 15 * 60 * 1000) anomalyFlags.push("device_clock_skew");
  if (input.capturedOffline && ageMilliseconds > 24 * 60 * 60 * 1000) anomalyFlags.push("delayed_sync_over_24h");
  const attendanceStatus = anomalyFlags.length ? "needs_review" : "recorded";
  const photoStatus = policy.photoRequired ? "pending_upload" : "not_required";
  const syncStatus = policy.photoRequired ? "syncing" : "synced";
  const insert = {
    client_event_id: input.clientEventId,
    employee_id: identity.employeeId,
    account_id: identity.accountId,
    event_type: eventType,
    attendance_date: attendanceDate,
    effective_at: effectiveAt.toISOString(),
    captured_at_client: capturedAt.toISOString(),
    received_at_server: serverNow.toISOString(),
    synced_at: policy.photoRequired ? null : serverNow.toISOString(),
    location_id: match.location?.id ?? null,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    accuracy_meters: location?.accuracy ?? null,
    distance_meters: match.distanceMeters ?? null,
    geofence_status: match.status,
    attendance_status: attendanceStatus,
    photo_status: photoStatus,
    sync_status: syncStatus,
    captured_offline: input.capturedOffline,
    device_metadata: { ...input.deviceMetadata, gpsCapturedAt: location?.capturedAt ?? null },
    anomaly_flags: anomalyFlags
  };
  const { data, error } = await client.from("attendance_events").insert(insert).select(eventSelect).single();
  if (error) {
    const { data: concurrentReplay } = await client
      .from("attendance_events").select(eventSelect).eq("client_event_id", input.clientEventId).eq("employee_id", identity.employeeId).maybeSingle();
    if (concurrentReplay) return { event: mapEvent(concurrentReplay as Row), idempotentReplay: true };
    if (error.code === "23505") throw new AppError("DUPLICATE", "Lượt chấm công tương ứng đã tồn tại.");
    throw new AppError("SERVER_ERROR", "Không thể ghi nhận lượt chấm công.");
  }
  const event = mapEvent(data as Row);
  await Promise.all([
    client.from("attendance_sync_events").insert({ attendance_event_id: event.id, state: syncStatus, retry_count: 0 }),
    recordAuditLog({
      actorId: identity.accountId,
      action: "attendance.created",
      entityType: "attendance_event",
      entityId: event.id,
      after: { eventType, attendanceStatus, photoStatus, syncStatus },
      metadata: { source: "SELF_MOBILE_WEB", capturedOffline: input.capturedOffline }
    })
  ]);
  return { event, idempotentReplay: false };
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length > 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
}

async function validatePhoto(file: File): Promise<"jpg" | "webp"> {
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) throw new AppError("PHOTO_UPLOAD", "Ảnh phải nhỏ hơn 2 MB.");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg" && isJpeg(bytes)) return "jpg";
  if (file.type === "image/webp" && isWebp(bytes)) return "webp";
  throw new AppError("PHOTO_UPLOAD", "Ảnh phải là JPEG hoặc WebP hợp lệ.");
}

export async function uploadAttendancePhoto(
  user: AuthenticatedUser,
  eventId: string,
  input: { photo: File; thumbnail: File; width: number; height: number; capturedAt: string }
): Promise<AttendanceRecordResult> {
  const client = clientOrThrow();
  const identity = await resolveIdentity(client, user);
  const { data: eventRow, error: eventError } = await client
    .from("attendance_events").select(eventSelect).eq("id", eventId).eq("employee_id", identity.employeeId).maybeSingle();
  if (eventError || !eventRow) throw new AppError("NOT_FOUND", "Không tìm thấy lượt chấm công.");
  const { data: existingPhoto } = await client.from("attendance_photos").select("id").eq("attendance_event_id", eventId).maybeSingle();
  if (existingPhoto) return { event: mapEvent(eventRow as Row), idempotentReplay: true };

  const [extension] = await Promise.all([validatePhoto(input.photo), validatePhoto(input.thumbnail)]);
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1 || input.width > 10000 || input.height > 10000) {
    throw new AppError("PHOTO_UPLOAD", "Kích thước ảnh không hợp lệ.");
  }
  const photoId = String((eventRow as Row).client_event_id);
  const date = new Date(input.capturedAt);
  const prefix = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${identity.employeeId}/${photoId}`;
  const photoPath = `${prefix}.${extension}`;
  const thumbnailPath = `${prefix}-thumb.${extension}`;
  await client.from("attendance_events").update({ photo_status: "uploading" }).eq("id", eventId);

  try {
    for (const [path, file] of [[photoPath, input.photo], [thumbnailPath, input.thumbnail]] as const) {
      const { error } = await client.storage.from("attendance-photos").upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw new AppError("PHOTO_UPLOAD", "Chưa thể tải ảnh lên. Dữ liệu vẫn được giữ trên thiết bị.");
    }
    const fullAssetId = deterministicUuid(photoId, "full");
    const thumbnailAssetId = deterministicUuid(photoId, "thumbnail");
    const { data: assets, error: assetError } = await client.from("file_assets").upsert([
      { id: fullAssetId, bucket: "attendance-photos", object_path: photoPath, owner_entity_type: "attendance_event", owner_entity_id: eventId, mime_type: input.photo.type, byte_size: input.photo.size, visibility: "private", created_by: identity.accountId, metadata: { derivative: "full" } },
      { id: thumbnailAssetId, bucket: "attendance-photos", object_path: thumbnailPath, owner_entity_type: "attendance_event", owner_entity_id: eventId, mime_type: input.thumbnail.type, byte_size: input.thumbnail.size, visibility: "private", created_by: identity.accountId, metadata: { derivative: "thumbnail" } }
    ], { onConflict: "bucket,object_path" }).select("id,object_path");
    if (assetError || !assets) throw new AppError("PHOTO_UPLOAD", "Không thể lưu thông tin ảnh.");
    const resolvedFullId = String(assets.find((asset) => asset.object_path === photoPath)?.id ?? fullAssetId);
    const resolvedThumbnailId = String(assets.find((asset) => asset.object_path === thumbnailPath)?.id ?? thumbnailAssetId);
    const { error: photoError } = await client.from("attendance_photos").upsert({
      id: photoId,
      attendance_event_id: eventId,
      file_id: resolvedFullId,
      thumbnail_file_id: resolvedThumbnailId,
      captured_at: input.capturedAt,
      width: input.width,
      height: input.height,
      metadata: { normalizedOrientation: true, source: "camera" }
    }, { onConflict: "attendance_event_id" });
    if (photoError) throw new AppError("PHOTO_UPLOAD", "Không thể liên kết ảnh chấm công.");
    const { data: completed, error: updateError } = await client
      .from("attendance_events")
      .update({ photo_status: "uploaded", sync_status: "synced", synced_at: new Date().toISOString() })
      .eq("id", eventId).select(eventSelect).single();
    if (updateError || !completed) throw new AppError("PHOTO_UPLOAD", "Không thể hoàn tất đồng bộ ảnh.");
    await Promise.all([
      client.from("attendance_sync_events").insert({ attendance_event_id: eventId, state: "synced", category: "photo_uploaded" }),
      recordAuditLog({ actorId: identity.accountId, action: "attendance.photo_linked", entityType: "attendance_event", entityId: eventId, metadata: { photoId } })
    ]);
    return { event: mapEvent(completed as Row), idempotentReplay: false };
  } catch (error) {
    await client.from("attendance_events").update({ photo_status: "upload_failed", sync_status: "sync_failed" }).eq("id", eventId);
    await client.from("attendance_sync_events").insert({ attendance_event_id: eventId, state: "sync_failed", category: "photo_upload" });
    // Deterministic paths are retained for a safe retry. The scheduled orphan cleanup may remove
    // objects that still have no file_assets/attendance_photos reference after its grace period.
    await recordAuditLog({ actorId: identity.accountId, action: "attendance.photo_upload_failed", entityType: "attendance_event", entityId: eventId });
    throw error;
  }
}

export async function listAttendanceHistory(user: AuthenticatedUser, from?: string, to?: string): Promise<AttendanceHistoryDay[]> {
  const client = clientOrThrow();
  const identity = await resolveIdentity(client, user);
  const policy = await readPolicy(client);
  const current = localDate(new Date(), policy.timezone);
  const first = from ?? `${current.slice(0, 7)}-01`;
  const last = to ?? current;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || !/^\d{4}-\d{2}-\d{2}$/.test(last) || first > last || (Date.parse(last) - Date.parse(first)) / 86400000 > 62) throw new AppError("VALIDATION_ERROR", "Khoảng ngày không hợp lệ.");
  const [events, leavesResult, calendarResult, tripResult] = await Promise.all([
    readEvents(client, { employeeId: identity.employeeId, from: first, to: last, limit: 180 }),
    client.from("leave_requests").select("start_date,end_date").eq("employee_id", identity.employeeId).eq("status", "approved").lte("start_date", last).gte("end_date", first),
    client.from("work_calendar_days").select("calendar_date,day_type,scope_type,scope_id").eq("active", true).gte("calendar_date", first).lte("calendar_date", last),
    client.from("daily_timesheets").select("work_date").eq("employee_id", identity.employeeId).eq("status", "business_trip").gte("work_date", first).lte("work_date", last)
  ]);
  if (leavesResult.error || calendarResult.error || tripResult.error) throw new AppError("SERVER_ERROR", "Không thể tải lịch công cá nhân.");
  const grouped = new Map<string, AttendanceEvent[]>();
  for (const event of events) grouped.set(event.attendanceDate, [...(grouped.get(event.attendanceDate) ?? []), event]);
  const leaveDates = new Set<string>();
  const cursor = new Date(`${first}T12:00:00Z`), end = new Date(`${last}T12:00:00Z`);
  const dates: string[] = [];
  while (cursor <= end) { dates.push(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  for (const leave of leavesResult.data ?? []) for (const date of dates) if (date >= leave.start_date && date <= leave.end_date) leaveDates.add(date);
  const holidays = new Set((calendarResult.data ?? []).filter((day) => (day.day_type === "holiday" || day.day_type === "company_holiday") && (day.scope_type === "company" || day.scope_type === "employee" && day.scope_id === identity.employeeId)).map((day) => String(day.calendar_date)));
  const trips = new Set((tripResult.data ?? []).map((day) => String(day.work_date)));
  return dates.reverse().flatMap((date): AttendanceHistoryDay[] => {
    const dayEvents = grouped.get(date) ?? [];
    const checkIn = dayEvents.find((event) => event.eventType === "check_in");
    const checkOut = dayEvents.find((event) => event.eventType === "check_out");
    const isPending = dayEvents.some((event) => event.syncStatus !== "synced");
    const start = checkIn ? new Date(checkIn.effectiveAt) : undefined;
    const shiftStart = new Date(`${date}T${policy.shiftStart}:00+07:00`);
    const late = start ? start.getTime() > shiftStart.getTime() + policy.lateThresholdMinutes * 60_000 : false;
    const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
    const shiftEnd = new Date(`${date}T${policy.shiftEnd}:00+07:00`);
    if (shiftEnd <= shiftStart) shiftEnd.setTime(shiftEnd.getTime() + 86_400_000);
    const shiftHasEnded = Date.now() > shiftEnd.getTime();
    const status = dayEvents.length ? isPending ? "pending" : !checkOut ? shiftHasEnded ? "missing_check_out" : late ? "late" : "checked_in" : late ? "late" : "complete"
      : leaveDates.has(date) ? "leave" : trips.has(date) ? "business_trip" : holidays.has(date) ? "holiday" : weekend ? "rest_day" : undefined;
    return status ? [{ date, checkIn, checkOut, status, shiftName: policy.shiftName, shiftStart: policy.shiftStart, shiftEnd: policy.shiftEnd }] : [];
  });
}

export async function listAttendanceRecords(user: AuthenticatedUser, filters: { from?: string; to?: string; employeeId?: string; locationId?: string; status?: string; photo?: string }): Promise<AttendanceEvent[]> {
  if (!can(user.permissions, "attendance.view_all") && !can(user.permissions, "attendance.view_team") && !can(user.permissions, "attendance.manage") && !can(user.permissions, "attendance.log.view")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow();
  const employeeScope = await scopedAttendanceEmployeeIds(client, user);
  if (filters.employeeId && employeeScope && !employeeScope.includes(filters.employeeId)) throw new AppError("PERMISSION_DENIED");
  let query = client.from("attendance_events").select(eventSelect).order("effective_at", { ascending: false }).limit(300);
  if (filters.from) query = query.gte("attendance_date", filters.from);
  if (filters.to) query = query.lte("attendance_date", filters.to);
  if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
  else if (employeeScope) query = query.in("employee_id", employeeScope);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.status) query = query.eq("attendance_status", filters.status);
  if (filters.photo === "missing") query = query.eq("photo_status", "not_required");
  if (filters.photo === "pending") query = query.in("photo_status", ["pending_upload", "uploading", "upload_failed"]);
  if (filters.photo === "uploaded") query = query.eq("photo_status", "uploaded");
  const { data, error } = await query;
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách chấm công.");
  return (data ?? []).map((row) => mapEvent(row as Row));
}

export async function getAttendanceEvent(user: AuthenticatedUser, eventId: string): Promise<AttendanceEvent> {
  const client = clientOrThrow();
  const { data, error } = await client.from("attendance_events").select(eventSelect).eq("id", eventId).maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy lượt chấm công.");
  const event = mapEvent(data as Row);
  const employeeScope = await scopedAttendanceEmployeeIds(client, user);
  if (employeeScope && !employeeScope.includes(event.employeeId)) throw new AppError("PERMISSION_DENIED");
  return event;
}

export async function listAttendanceAdjustments(user: AuthenticatedUser, eventId: string): Promise<AttendanceEventAdjustment[]> {
  if (!can(user.permissions, "attendance.adjust") && !can(user.permissions, "attendance.manage") && !can(user.permissions, "attendance.log.view")) throw new AppError("PERMISSION_DENIED");
  await getAttendanceEvent(user, eventId);
  const { data, error } = await clientOrThrow().from("attendance_event_adjustments").select("*,app_accounts(display_name)").eq("attendance_event_id", eventId).order("changed_at", { ascending: false });
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc lịch sử điều chỉnh.");
  return (data ?? []).map((row) => { const raw = row.app_accounts as Row | Row[] | null, actor = (Array.isArray(raw) ? raw[0] : raw) as Row | null; return { id: String(row.id), oldValue: row.old_value as Row, newValue: row.new_value as Row, reason: String(row.reason), changedByName: actor ? optionalString(actor, "display_name") : undefined, changedAt: String(row.changed_at) }; });
}

export async function adjustAttendanceEvent(user: AuthenticatedUser, eventId: string, input: z.infer<typeof attendanceAdjustmentSchema>): Promise<AttendanceEvent> {
  if (!can(user.permissions, "attendance.adjust") && !can(user.permissions, "attendance.manage")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow(), actorId = await resolveAccountId(client, user), current = await getAttendanceEvent(user, eventId), policy = await readPolicy(client);
  const next = { effectiveAt: input.effectiveAt, attendanceDate: localDate(new Date(input.effectiveAt), policy.timezone), attendanceStatus: input.attendanceStatus };
  const { data, error } = await client.from("attendance_events").update({ effective_at: next.effectiveAt, attendance_date: next.attendanceDate, attendance_status: next.attendanceStatus, updated_at: new Date().toISOString() }).eq("id", eventId).select(eventSelect).single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể điều chỉnh lượt chấm công.");
  const oldValue = { effectiveAt: current.effectiveAt, attendanceDate: current.attendanceDate, attendanceStatus: current.attendanceStatus };
  const { error: historyError } = await client.from("attendance_event_adjustments").insert({ attendance_event_id: eventId, old_value: oldValue, new_value: next, reason: input.reason, changed_by: actorId });
  if (historyError) { await client.from("attendance_events").update({ effective_at: current.effectiveAt, attendance_date: current.attendanceDate, attendance_status: current.attendanceStatus }).eq("id", eventId); throw new AppError("SERVER_ERROR", "Không thể ghi lịch sử điều chỉnh."); }
  await recordAuditLog({ actorId, action: "attendance.event_adjusted", entityType: "attendance_event", entityId: eventId, before: oldValue, after: next, reason: input.reason });
  return mapEvent(data as Row);
}

export async function getAttendancePhotoAsset(user: AuthenticatedUser, photoId: string, thumbnail: boolean): Promise<{ bucket: string; path: string }> {
  if (!canViewAttendancePhotos(user) && !can(user.permissions, "attendance.self.view") && !can(user.permissions, "attendance.self")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow();
  const { data, error } = await client
    .from("attendance_photos")
    .select("id,evidence_status,attendance_events(employee_id),file_assets!attendance_photos_file_id_fkey(bucket,object_path),thumbnail:file_assets!attendance_photos_thumbnail_file_id_fkey(bucket,object_path)")
    .eq("id", photoId).maybeSingle();
  if (error || !data) throw new AppError("NOT_FOUND", "Không tìm thấy ảnh chấm công.");
  if (data.evidence_status === "expired") throw new AppError("NOT_FOUND", "Ảnh chấm công đã hết thời hạn lưu 45 ngày.");
  const event = data.attendance_events as unknown as Row;
  if (!canViewAttendancePhotos(user)) { const identity = await resolveIdentity(client,user); if (String(event.employee_id) !== identity.employeeId) throw new AppError("PERMISSION_DENIED"); }
  const asset = (thumbnail ? data.thumbnail ?? data.file_assets : data.file_assets) as unknown as Row | null;
  if (!asset) throw new AppError("NOT_FOUND", "Ảnh chưa đồng bộ.");
  return { bucket: requiredString(asset, "bucket"), path: requiredString(asset, "object_path") };
}

export async function getAttendanceConfiguration(user: AuthenticatedUser) {
  if (!can(user.permissions, "attendance.config.view") && !can(user.permissions, "attendance.config.manage")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow();
  const [policy, locations] = await Promise.all([readPolicy(client), readLocations(client)]);
  return { policy, locations };
}

export async function updateAttendancePolicy(user: AuthenticatedUser, patch: Omit<AttendancePolicy, "id" | "name" | "timezone">): Promise<AttendancePolicy> {
  if (!can(user.permissions, "attendance.config.manage")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow();
  const identity = await resolveIdentity(client, user);
  const current = await readPolicy(client);
  const { data, error } = await client.from("attendance_policies").update({
    attendance_enabled: patch.attendanceEnabled,
    photo_required: patch.photoRequired,
    gps_required: patch.gpsRequired,
    offline_enabled: patch.offlineEnabled,
    allowed_accuracy_threshold_meters: patch.allowedAccuracyThresholdMeters,
    early_checkin_window_minutes: patch.earlyCheckinWindowMinutes,
    late_threshold_minutes: patch.lateThresholdMinutes,
    shift_name: patch.shiftName,
    shift_start: patch.shiftStart,
    shift_end: patch.shiftEnd,
    updated_by: identity.accountId
  }).eq("id", current.id).select("*").single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể lưu chính sách chấm công.");
  await recordAuditLog({ actorId: identity.accountId, action: "attendance.policy_updated", entityType: "attendance_policy", entityId: current.id });
  return mapPolicy(data as Row);
}

export async function saveAttendanceLocation(user: AuthenticatedUser, input: Omit<AttendanceLocation, "id"> & { id?: string }): Promise<AttendanceLocation> {
  if (!can(user.permissions, "attendance.config.manage")) throw new AppError("PERMISSION_DENIED");
  const client = clientOrThrow();
  const identity = await resolveIdentity(client, user);
  const values = { name: input.name, latitude: input.latitude, longitude: input.longitude, radius_meters: input.radiusMeters, active: input.active };
  const operation = input.id
    ? client.from("attendance_locations").update(values).eq("id", input.id)
    : client.from("attendance_locations").insert({ ...values, created_by: identity.accountId });
  const { data, error } = await operation.select("*").single();
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể lưu địa điểm chấm công.");
  const location = mapLocation(data as Row);
  await recordAuditLog({ actorId: identity.accountId, action: "attendance.location_saved", entityType: "attendance_location", entityId: location.id });
  return location;
}
