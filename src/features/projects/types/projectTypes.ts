export type ProjectStatus = "preparing" | "active" | "paused" | "completed" | "closed";
export type AssignmentRole = "project_manager" | "engineer" | "supervisor_main" | "supervisor_replacement" | "worker" | "support";
export type ProjectHealth = "on_track" | "at_risk" | "delayed" | "paused" | "completed";
export type ProjectUpdateType = "progress" | "issue" | "material" | "safety" | "change" | "general";
export type ProjectUpdateStatus = "in_progress" | "waiting" | "done";
export type ProjectUpdatePublishStatus = "draft" | "published" | "archived";
export type ProjectIssueSeverity = "low" | "medium" | "high" | "critical";
export type ProjectIssueStatus = "open" | "in_progress" | "resolved" | "closed";
export type ProjectUpdateSyncStatus = "local_draft" | "pending_sync" | "syncing" | "synced" | "sync_failed";

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  customerName?: string;
  summary?: string;
  startDate: string;
  expectedEndDate?: string;
  actualEndDate?: string;
  status: ProjectStatus;
  health: ProjectHealth;
  projectManagerEmployeeId?: string;
  projectManagerName?: string;
  currentPeople: number;
  worksiteCount: number;
  rowVersion: number;
}

export interface ProjectUpdateAttachment {
  id: string;
  fileId: string;
  attachmentType: "image" | "pdf" | "spreadsheet" | "document";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string;
  sortOrder: number;
  sourceAttendancePhotoId?: string;
  uploadedAt: string;
}

export interface ProjectIssue {
  id: string;
  projectId: string;
  projectName: string;
  worksiteId?: string;
  worksiteName?: string;
  sourceUpdateId: string;
  title: string;
  severity: ProjectIssueSeverity;
  status: ProjectIssueStatus;
  ownerEmployeeId?: string;
  ownerName?: string;
  resolutionNote?: string;
  resolvedByName?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUpdate {
  id: string;
  clientUpdateId?: string;
  projectId: string;
  projectName: string;
  worksiteId?: string;
  worksiteName?: string;
  authorEmployeeId?: string;
  authorName: string;
  authorProjectRole: string;
  updateType: ProjectUpdateType;
  title: string;
  content: string;
  status: ProjectUpdateStatus;
  publishStatus: ProjectUpdatePublishStatus;
  issue?: ProjectIssue;
  pinned: boolean;
  relatedAttendanceSessionId?: string;
  syncStatus: ProjectUpdateSyncStatus;
  capturedAtClient?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  attachments: ProjectUpdateAttachment[];
}

export interface ProjectHealthEntry {
  id: string;
  projectId: string;
  fromHealth?: ProjectHealth;
  toHealth: ProjectHealth;
  reason?: string;
  changedByName: string;
  changedAt: string;
}

export interface ProjectMonitoringSummary {
  active: number;
  averageCompletion: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  paused: number;
  projects: Array<ProjectSummary & {
    completionPercent: number;
    latestUpdate?: ProjectUpdate;
    openHighIssues: number;
    stale: boolean;
  }>;
  attention: ProjectIssue[];
  recentUpdates: ProjectUpdate[];
}

export interface Worksite {
  id: string;
  projectId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
  radiusMeters: number;
  gpsRequired: boolean;
  allowedAccuracyThresholdMeters: number;
  status: "active" | "inactive" | "closed";
  activeFrom?: string;
  activeTo?: string;
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  worksiteId?: string;
  worksiteName?: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  assignmentRole: AssignmentRole;
  startDate: string;
  endDate?: string;
  shiftCode: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  status: "active" | "inactive" | "cancelled";
  rowVersion: number;
  approvedLeave?: { requestId: string; requestNumber: string; leaveTypeName: string; dayPart: string };
}

export interface EmployeeProjectAssignment {
  project: ProjectSummary;
  assignmentId: string;
  assignmentRole: AssignmentRole;
  worksiteName?: string;
  startDate: string;
  endDate?: string;
  status: ProjectAssignment["status"];
}

export interface ProjectDetail extends ProjectSummary {
  note?: string;
  worksites: Worksite[];
  assignments: ProjectAssignment[];
}

export interface DailySchedule {
  date: string;
  worksiteId: string;
  worksiteName: string;
  supervisorNames: string[];
  peopleCount: number;
  workerCount: number;
}

export interface ProjectProgressNode {
  id: string;
  projectId: string;
  parentId?: string;
  nodeType: "phase" | "work_item" | "task" | "milestone" | "acceptance";
  name: string;
  status: "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
  completionPercent: number;
  deadline?: string;
  assigneeEmployeeId?: string;
  assigneeName?: string;
  sortOrder: number;
  rowVersion: number;
}
