export type WorkerEntryStatus = "unconfirmed" | "present" | "absent" | "leave" | "late" | "transferred";
export type WorkerSessionStatus = "draft" | "in_progress" | "submitted" | "locked" | "needs_review";

export interface WorkerAttendanceChecklistItem {
  id: string;
  group: string;
  content: string;
  required: boolean;
  sortOrder: number;
}

export interface WorkerAttendanceChecklistResponse {
  itemId: string;
  checked: boolean;
  note?: string;
}

export interface WorkerAttendanceEntry {
  id: string;
  sessionId: string;
  workerId: string;
  employeeCode: string;
  workerName: string;
  assignmentRole: string;
  status: WorkerEntryStatus;
  exceptionReason?: "approved_leave" | "unapproved" | "unknown" | "other_worksite" | "other";
  dayException: "none" | "early_leave" | "transferred" | "half_day" | "overtime" | "left_worksite";
  exceptionTime?: string;
  isUnplanned: boolean;
  unplannedReason?: string;
  note?: string;
}

export interface WorkerAttendancePhoto {
  id: string;
  sessionId: string;
  capturedAt: string;
  sortOrder: number;
}

export interface WorkerAttendanceAdjustment {
  id: string;
  entryId?: string;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string;
}

export interface WorkerAttendanceSession {
  id: string;
  clientSessionId: string;
  projectId: string;
  projectName: string;
  worksiteId: string;
  worksiteName: string;
  worksiteAddress?: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  sessionType: "morning" | "end_of_day";
  supervisorEmployeeId: string;
  supervisorName: string;
  startedAt: string;
  submittedAt?: string;
  dayClosedAt?: string;
  capturedAtClient: string;
  geofenceStatus: "valid" | "outside" | "accuracy_low" | "unavailable" | "not_required";
  latitude?: number;
  longitude?: number;
  distanceMeters?: number;
  accuracyMeters?: number;
  workNote?: string;
  note?: string;
  status: WorkerSessionStatus;
  syncStatus: "local_pending" | "syncing" | "synced" | "sync_failed";
  photoStatus: "not_required" | "pending_upload" | "uploading" | "uploaded" | "upload_failed";
  version: number;
  entries: WorkerAttendanceEntry[];
  photos: WorkerAttendancePhoto[];
  adjustments: WorkerAttendanceAdjustment[];
  checklist: WorkerAttendanceChecklistItem[];
  checklistResponses: WorkerAttendanceChecklistResponse[];
}

export interface WorkerAttendanceTask {
  projectId: string;
  projectName: string;
  worksiteId: string;
  worksiteName: string;
  date: string;
  shiftCode: string;
  shiftName: string;
  expectedWorkers: number;
  gpsRequired?: boolean;
  allowedAccuracyThresholdMeters?: number;
  existingSessionId?: string;
  existingStatus?: WorkerSessionStatus;
  checklist: WorkerAttendanceChecklistItem[];
  roster: Array<{
    workerId: string;
    employeeCode: string;
    workerName: string;
    assignmentRole: string;
    approvedLeave?: { requestId: string; requestNumber: string; leaveTypeName: string; dayPart: string };
  }>;
}

export interface WorkerAttendanceCounts {
  total: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  transferred: number;
  unconfirmed: number;
  unplanned: number;
}

export interface WorkerAttendancePolicy {
  minimumPhotos: number;
  workNoteRequired: boolean;
  endOfDayRequired: boolean;
  offlineEnabled: boolean;
  editWindowMinutes: number;
}
