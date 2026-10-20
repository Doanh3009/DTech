import type { AttendanceAdminTodayRow } from "@/features/attendance/types/attendanceTypes";

export type AttendancePhotoReviewState = "reviewed" | "flagged";

export function attendanceReviewReasons(row: AttendanceAdminTodayRow): string[] {
  const reasons = new Set<string>();
  if (row.status === "missing_check") reasons.add("Thiếu lượt chấm");
  if (row.lateMinutes > 0) reasons.add(`Đi muộn ${row.lateMinutes} phút`);
  if (row.earlyLeaveMinutes > 0) reasons.add(`Về sớm ${row.earlyLeaveMinutes} phút`);

  const events = row.events ?? [];
  const checkInCount = events.filter((event) => event.eventType === "check_in").length;
  const checkOutCount = events.filter((event) => event.eventType === "check_out").length;
  if (checkInCount > 1 || checkOutCount > 1) reasons.add("Nhiều lượt chấm cùng loại");

  for (const event of events) {
    const flags = new Set(event.anomalyFlags);
    if (event.attendanceStatus === "rejected") reasons.add("Lượt chấm bị từ chối");
    else if (
      event.attendanceStatus === "needs_review" &&
      !["gps_accuracy_low", "device_clock_skew", "delayed_sync_over_24h"].some((flag) => flags.has(flag))
    ) reasons.add("Lượt chấm cần xác minh");

    if (event.geofenceStatus === "outside") reasons.add("Ngoài vùng chấm công");
    else if (event.geofenceStatus === "accuracy_low") reasons.add("GPS chưa đủ chính xác");
    else if (event.geofenceStatus === "unavailable") reasons.add("Thiếu vị trí GPS");

    if (flags.has("device_clock_skew")) reasons.add("Giờ thiết bị lệch");
    if (flags.has("delayed_sync_over_24h")) reasons.add("Đồng bộ trễ trên 24 giờ");
    if (event.syncStatus === "sync_failed") reasons.add("Chưa đồng bộ dữ liệu");
    if (["pending_upload", "uploading", "upload_failed"].includes(event.photoStatus)) {
      reasons.add("Ảnh minh chứng chưa đồng bộ");
    }
  }

  return [...reasons];
}

export function hasReviewablePhotos(row: AttendanceAdminTodayRow): boolean {
  return (row.events ?? []).some((event) => Boolean(event.photoId) && event.photoStatus === "uploaded");
}

/** Changes to attendance evidence reopen inspection without persisting names or GPS coordinates. */
export function attendanceEvidenceFingerprint(row: AttendanceAdminTodayRow): string {
  const events = (row.events ?? []).map((event) => JSON.stringify([
    event.id,
    event.photoId ?? "",
    event.eventType,
    event.effectiveAt,
    event.attendanceStatus,
    event.photoStatus,
    event.syncStatus,
    event.geofenceStatus,
    [...event.anomalyFlags].sort()
  ])).sort();

  const evidence = JSON.stringify([
    row.status,
    row.checkIn ?? "",
    row.checkOut ?? "",
    row.lateMinutes,
    row.earlyLeaveMinutes,
    row.totalMinutes,
    events
  ]);

  // Two independent 32-bit hashes keep the saved record small. This is an identity check, not a security hash.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < evidence.length; index += 1) {
    const character = evidence.charCodeAt(index);
    first = Math.imul(first ^ character, 0x01000193);
    second = Math.imul(second ^ character, 0x85ebca6b);
  }

  return `ev1:${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}
