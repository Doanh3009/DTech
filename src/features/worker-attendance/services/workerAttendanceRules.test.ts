import { describe, expect, it } from "vitest";
import { assignmentRangesOverlap, countWorkerAttendance, validateSessionForSubmit, workerLocationLabel } from "./workerAttendanceRules";
import type { WorkerAttendanceEntry } from "@/features/worker-attendance/types/workerAttendanceTypes";

const entry = (status: WorkerAttendanceEntry["status"], isUnplanned = false): WorkerAttendanceEntry => ({ id: crypto.randomUUID(), sessionId: "s", workerId: crypto.randomUUID(), employeeCode: "CN", workerName: "Công nhân", assignmentRole: "worker", status, dayException: "none", isUnplanned });

describe("worker attendance rules", () => {
  it("counts roster states without duplicating photos by worker", () => {
    expect(countWorkerAttendance([entry("present"), entry("absent"), entry("present", true)])).toMatchObject({ total: 3, present: 2, absent: 1, unplanned: 1 });
  });
  it("blocks submit with unconfirmed workers or missing photos", () => {
    const errors = validateSessionForSubmit({ entries: [entry("unconfirmed")], photoCount: 0, geofenceStatus: "valid", latitude: 10, longitude: 106, checklist: [], checklistResponses: [] }, { minimumPhotos: 1, workNoteRequired: false, endOfDayRequired: false, offlineEnabled: true, editWindowMinutes: 120 });
    expect(errors).toHaveLength(2);
  });
  it("detects overlapping effective assignments", () => {
    expect(assignmentRangesOverlap({ startDate: "2026-09-01", endDate: "2026-09-30", shiftStart: "07:00", shiftEnd: "17:00" }, { startDate: "2026-09-10", endDate: "2026-09-12", shiftStart: "08:00", shiftEnd: "12:00" })).toBe(true);
  });

  it.each(["valid", "outside", "accuracy_low", "unavailable"])("allows a session with actual GPS and historical status %s", (geofenceStatus) => {
    expect(validateSessionForSubmit({ entries: [entry("present")], photoCount: 1, geofenceStatus, latitude: 21.0278, longitude: 105.8342, checklist: [], checklistResponses: [] }, { minimumPhotos: 1, workNoteRequired: false, endOfDayRequired: false, offlineEnabled: true, editWindowMinutes: 120 })).toEqual([]);
  });

  it("requires coordinates for GPS sessions while preserving the optional GPS policy", () => {
    const input = { entries: [entry("present")], photoCount: 1, geofenceStatus: "valid", checklist: [], checklistResponses: [] };
    const policy = { minimumPhotos: 1, workNoteRequired: false, endOfDayRequired: false, offlineEnabled: true, editWindowMinutes: 120 };
    expect(validateSessionForSubmit(input, policy)).toEqual(["Chưa có tọa độ GPS. Hãy thử lại vị trí."]);
    expect(validateSessionForSubmit({ ...input, geofenceStatus: "not_required" }, policy)).toEqual([]);
  });

  it("shows coordinate accuracy for review instead of an outside-radius error", () => {
    expect(workerLocationLabel({ latitude: 21.0278, longitude: 105.8342, accuracyMeters: 500, geofenceStatus: "accuracy_low" })).toBe("21.02780, 105.83420 · ±500 m · Cần kiểm tra");
    expect(workerLocationLabel({ latitude: 21.0278, longitude: 105.8342, geofenceStatus: "outside" })).toBe("21.02780, 105.83420");
  });
});
