import "server-only";

import type { z } from "zod";

import type { attendanceAdjustmentRequestSchema, attendanceAdjustmentReviewSchema } from "@/features/attendance/schemas/adjustmentRequestSchemas";
import { publishNotificationEvent } from "@/features/shared-platforms/services/notificationRepository";
import { resolvePlatformIdentity } from "@/features/shared-platforms/services/platformIdentity";
import { recordAuditLog } from "@/services/audit/auditLog";
import { AppError } from "@/lib/api/errors";
import { can, type AuthenticatedUser } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface AttendanceAdjustmentRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  attendanceDate: string;
  requestType: "missing_check_in" | "missing_check_out";
  requestedTime: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
  createdAt: string;
}

type Row = Record<string, unknown>;
function database() {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
  return client;
}
function canReview(user: AuthenticatedUser) {
  return can(user.permissions, "attendance.adjust") || can(user.permissions, "attendance.manage");
}
function mapRequest(row: Row, employee?: Row): AttendanceAdjustmentRequest {
  return {
    id: String(row.id), employeeId: String(row.employee_id),
    employeeName: String(employee?.full_name ?? "—"), employeeCode: String(employee?.employee_code ?? "—"),
    attendanceDate: String(row.attendance_date), requestType: String(row.request_type) as AttendanceAdjustmentRequest["requestType"],
    requestedTime: String(row.requested_time).slice(0, 5), reason: String(row.reason),
    status: String(row.status) as AttendanceAdjustmentRequest["status"],
    reviewNote: row.review_note ? String(row.review_note) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listAdjustmentRequests(user: AuthenticatedUser, scope: "self" | "all" = "self"): Promise<AttendanceAdjustmentRequest[]> {
  const client = database();
  let employeeId: string | undefined;
  if (scope === "self") {
    if (!["attendance.self", "attendance.self_request"].some((permission) => can(user.permissions, permission as "attendance.self" | "attendance.self_request"))) throw new AppError("PERMISSION_DENIED");
    const identity = await resolvePlatformIdentity(client, user);
    if (!identity.employeeId) throw new AppError("PERMISSION_DENIED", "Tài khoản này chưa được liên kết với hồ sơ nhân viên.");
    employeeId = identity.employeeId;
  } else if (!canReview(user) && !can(user.permissions, "attendance.view_all")) throw new AppError("PERMISSION_DENIED");
  let query = client.from("attendance_adjustment_requests").select("*").order("created_at", { ascending: false }).limit(300);
  if (employeeId) query = query.eq("employee_id", employeeId);
  const { data, error } = await query;
  if (error) throw new AppError("SERVER_ERROR", "Không thể tải yêu cầu điều chỉnh công.");
  const employeeIds = [...new Set((data ?? []).map((row) => String(row.employee_id)))];
  const employees = employeeIds.length ? await client.from("employees").select("id,full_name,employee_code").in("id", employeeIds) : { data: [], error: null };
  if (employees.error) throw new AppError("SERVER_ERROR", "Không thể đọc tên nhân viên.");
  const employeeById = new Map((employees.data ?? []).map((row) => [String(row.id), row as Row]));
  return (data ?? []).map((row) => mapRequest(row as Row, employeeById.get(String(row.employee_id))));
}

export async function createAdjustmentRequest(user: AuthenticatedUser, input: z.infer<typeof attendanceAdjustmentRequestSchema>): Promise<AttendanceAdjustmentRequest> {
  if (!can(user.permissions, "attendance.self_request") && !can(user.permissions, "attendance.self")) throw new AppError("PERMISSION_DENIED");
  const client = database();
  const identity = await resolvePlatformIdentity(client, user);
  if (!identity.employeeId) throw new AppError("PERMISSION_DENIED", "Tài khoản này chưa được liên kết với hồ sơ nhân viên.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (input.attendanceDate > today) throw new AppError("VALIDATION_ERROR", "Không thể điều chỉnh công cho ngày tương lai.");
  const counterpartType = input.requestType === "missing_check_in" ? "check_out" : "check_in";
  const requestedType = input.requestType === "missing_check_in" ? "check_in" : "check_out";
  const { data: events, error: eventError } = await client.from("attendance_events").select("event_type,effective_at").eq("employee_id", identity.employeeId).eq("attendance_date", input.attendanceDate);
  if (eventError) throw new AppError("SERVER_ERROR", "Không thể kiểm tra lượt chấm công.");
  if ((events ?? []).some((event) => event.event_type === requestedType)) throw new AppError("CONFLICT", "Ngày này đã có lượt chấm công cần điều chỉnh.");
  const counterpart = (events ?? []).find((event) => event.event_type === counterpartType);
  if (!counterpart) throw new AppError("VALIDATION_ERROR", "Ngày này chưa có lượt chấm công đối ứng.");
  const requestedAt = new Date(`${input.attendanceDate}T${input.requestedTime}:00+07:00`).getTime();
  const counterpartAt = new Date(String(counterpart.effective_at)).getTime();
  if (requestedAt > Date.now()) throw new AppError("VALIDATION_ERROR", "Giờ đề nghị không thể ở tương lai.");
  if (input.requestType === "missing_check_in" ? requestedAt >= counterpartAt : requestedAt <= counterpartAt) {
    throw new AppError("VALIDATION_ERROR", "Giờ đề nghị không khớp thứ tự chấm vào/ra.");
  }
  const { data, error } = await client.from("attendance_adjustment_requests").insert({
    employee_id: identity.employeeId, account_id: identity.accountId, attendance_date: input.attendanceDate,
    request_type: input.requestType, requested_time: input.requestedTime, reason: input.reason
  }).select("*").single();
  if (error || !data) throw new AppError(error?.code === "23505" ? "DUPLICATE" : "SERVER_ERROR", error?.code === "23505" ? "Ngày này đã có yêu cầu chờ duyệt." : "Không thể gửi yêu cầu điều chỉnh công.");
  await recordAuditLog({ actorId: identity.accountId, action: "attendance.adjustment_requested", entityType: "attendance_adjustment_request", entityId: String(data.id), after: input });
  return mapRequest(data as Row, { full_name: identity.displayName });
}

export async function reviewAdjustmentRequest(user: AuthenticatedUser, id: string, input: z.infer<typeof attendanceAdjustmentReviewSchema>): Promise<AttendanceAdjustmentRequest> {
  if (!canReview(user)) throw new AppError("PERMISSION_DENIED");
  const client = database();
  const reviewer = await resolvePlatformIdentity(client, user);
  const { data: before, error: readError } = await client.from("attendance_adjustment_requests").select("*").eq("id", id).maybeSingle();
  if (readError || !before) throw new AppError("NOT_FOUND", "Không tìm thấy yêu cầu điều chỉnh.");
  const { error } = await client.rpc("review_attendance_adjustment_request", { p_request_id: id, p_reviewer_id: reviewer.accountId, p_approve: input.approve, p_note: input.note });
  if (error) {
    if (/REQUEST_ALREADY_REVIEWED|COUNTERPART_MISSING|TIME_ORDER_INVALID|duplicate key/i.test(error.message)) throw new AppError("CONFLICT", "Dữ liệu chấm công đã thay đổi hoặc giờ đề nghị không hợp lệ.");
    throw new AppError("SERVER_ERROR", "Không thể xử lý yêu cầu điều chỉnh.");
  }
  const { data: after, error: afterError } = await client.from("attendance_adjustment_requests").select("*").eq("id", id).single();
  if (afterError || !after) throw new AppError("SERVER_ERROR", "Không thể đọc yêu cầu sau khi xử lý.");
  await recordAuditLog({ actorId: reviewer.accountId, action: input.approve ? "attendance.adjustment_approved" : "attendance.adjustment_rejected", entityType: "attendance_adjustment_request", entityId: id, before: { status: before.status }, after: { status: after.status }, reason: input.note });
  try {
    await publishNotificationEvent({ eventKey: "attendance.adjustment_reviewed", aggregateType: "attendance_adjustment_request", aggregateId: id,
      actorAccountId: reviewer.accountId, idempotencyKey: `attendance-adjustment-reviewed:${id}`,
      recipients: [String(before.account_id)], values: { date: String(before.attendance_date), status: input.approve ? "được duyệt" : "bị từ chối" },
      deepLink: "/attendance/requests", priority: "normal" }, client);
  } catch (notificationError) {
    // Approval has already committed; a notification failure must not invite a duplicate review.
    console.error("attendance.adjustment_notification_failed", notificationError);
  }
  return mapRequest(after as Row);
}
