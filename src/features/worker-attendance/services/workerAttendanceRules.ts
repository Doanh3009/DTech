import type { WorkerAttendanceChecklistItem, WorkerAttendanceChecklistResponse, WorkerAttendanceCounts, WorkerAttendanceEntry, WorkerAttendancePolicy } from "@/features/worker-attendance/types/workerAttendanceTypes";

export function countWorkerAttendance(entries: readonly WorkerAttendanceEntry[]): WorkerAttendanceCounts {
  const counts: WorkerAttendanceCounts = { total: entries.length, present: 0, absent: 0, leave: 0, late: 0, transferred: 0, unconfirmed: 0, unplanned: 0 };
  for (const entry of entries) {
    counts[entry.status] += 1;
    if (entry.isUnplanned) counts.unplanned += 1;
  }
  return counts;
}

export function hasWorkerCoordinates(input: { latitude?: number; longitude?: number }): boolean {
  return typeof input.latitude === "number" && Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90 && typeof input.longitude === "number" && Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180;
}

export function workerLocationLabel(input: { latitude?: number; longitude?: number; accuracyMeters?: number; geofenceStatus: string }): string {
  if (!hasWorkerCoordinates(input)) return input.geofenceStatus === "not_required" ? "Không yêu cầu" : "Chưa có GPS";
  return `${input.latitude!.toFixed(5)}, ${input.longitude!.toFixed(5)}${input.accuracyMeters !== undefined ? ` · ±${Math.round(input.accuracyMeters)} m` : ""}${input.geofenceStatus === "accuracy_low" ? " · Cần kiểm tra" : ""}`;
}

export function validateSessionForSubmit(input: { entries: readonly WorkerAttendanceEntry[]; photoCount: number; workNote?: string; geofenceStatus: string; latitude?: number; longitude?: number; checklist: readonly WorkerAttendanceChecklistItem[]; checklistResponses: readonly WorkerAttendanceChecklistResponse[] }, policy: WorkerAttendancePolicy): string[] {
  const errors: string[] = [];
  if (input.entries.some((entry) => entry.status === "unconfirmed")) errors.push("Còn công nhân chưa xác nhận trạng thái.");
  if (input.photoCount < policy.minimumPhotos) errors.push(`Cần ít nhất ${policy.minimumPhotos} ảnh điểm danh.`);
  if (policy.workNoteRequired && !input.workNote?.trim()) errors.push("Cần nhập nội dung công việc.");
  if (input.geofenceStatus !== "not_required" && !hasWorkerCoordinates(input)) errors.push("Chưa có tọa độ GPS. Hãy thử lại vị trí.");
  const checked = new Set(input.checklistResponses.filter((response) => response.checked).map((response) => response.itemId));
  if (input.checklist.some((item) => item.required && !checked.has(item.id))) errors.push("Cần hoàn thành các mục checklist bắt buộc.");
  return errors;
}

export function assignmentRangesOverlap(first: { startDate: string; endDate?: string; shiftStart: string; shiftEnd: string }, second: { startDate: string; endDate?: string; shiftStart: string; shiftEnd: string }) {
  const datesOverlap = first.startDate <= (second.endDate ?? "9999-12-31") && second.startDate <= (first.endDate ?? "9999-12-31");
  return datesOverlap && first.shiftStart < second.shiftEnd && second.shiftStart < first.shiftEnd;
}
