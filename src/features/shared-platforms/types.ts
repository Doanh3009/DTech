export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "withdrawn";
export type ApprovalStepStatus = "pending" | "approved" | "rejected" | "skipped" | "cancelled";

export interface ApprovalStep {
  id: string;
  sourceStepId?: string;
  stepOrder: number;
  stepName: string;
  approverSource: string;
  approverAccountId?: string;
  approverName?: string;
  status: ApprovalStepStatus;
  actedAt?: string;
  comment?: string;
  delegatedFromName?: string;
}

export interface ApprovalCase {
  id: string;
  domainType: string;
  domainId: string;
  referenceNumber: string;
  requesterName: string;
  organizationName?: string;
  summary: string;
  domainLink: string;
  workflowVersion: number;
  status: ApprovalStatus;
  currentStep?: number;
  submittedAt: string;
  completedAt?: string;
  waitingHours: number;
  metadata: Record<string, unknown>;
  steps: ApprovalStep[];
  availableActions?: { approve: boolean; reject: boolean; reassign: boolean };
}

export interface AppNotification {
  id: string;
  eventKey: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  deepLink?: string;
  priority: "normal" | "important" | "critical";
  readAt?: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  documentTypeId: string;
  documentTypeName: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  ownerEntityType: string;
  ownerEntityId: string;
  ownerReference?: string;
  visibilityScope: "domain_private" | "project" | "company_wide";
  status: "active" | "archived" | "replaced" | "deleted_pending_retention";
  currentVersion: number;
  expiryDate?: string;
  createdAt: string;
  updatedAt: string;
}
