export type LeaveRequestStatus = "draft" | "submitted" | "pending_approval" | "approved" | "rejected" | "withdrawn" | "cancelled";
export type LeaveDayPart = "full_day" | "morning" | "afternoon";
export type LeaveApprovalStatus = "pending" | "approved" | "rejected" | "skipped" | "cancelled";
export type LeaveLedgerType = "grant" | "carryover" | "adjustment_add" | "adjustment_subtract" | "leave_usage" | "leave_reversal" | "expiry";

export interface LeaveType {
  id: string; code: string; name: string; tone: "neutral" | "info" | "success" | "warning";
  deductsBalance: boolean; requiresReason: boolean; requiresAttachment: boolean;
  allowsHalfDay: boolean; allowsMultiDay: boolean; workflowId: string; active: boolean;
}

export interface LeaveApprovalStep {
  id: string; stepOrder: number; approverSource: string; approverAccountId?: string;
  approverName?: string; status: LeaveApprovalStatus; actedAt?: string; comment?: string;
}

export interface LeaveAttachment { id: string; fileName: string; createdAt: string; }

export interface LeaveRequest {
  id: string; requestNumber: string; employeeId: string; employeeCode: string; employeeName: string;
  departmentName: string; positionName: string; leaveTypeId: string; leaveTypeName: string; deductsBalance: boolean;
  startDate: string; endDate: string; startDayPart: LeaveDayPart; endDayPart: LeaveDayPart;
  calculatedDays: number; reason: string; status: LeaveRequestStatus; submittedAt?: string;
  approvedAt?: string; rejectedAt?: string; withdrawnAt?: string; cancelledAt?: string;
  version: number; createdAt: string; warnings: string[]; approvalSteps: LeaveApprovalStep[]; attachments: LeaveAttachment[];
  availableActions?: { submit: boolean; edit: boolean; withdraw: boolean; cancel: boolean; approve: boolean; exportPdf: boolean };
  workingDates?: string[];
}

export interface LeaveLedgerEntry {
  id: string; employeeId: string; leaveYear: number; leaveTypeId: string; leaveTypeName: string;
  transactionType: LeaveLedgerType; amount: number; referenceType: string; referenceId: string;
  effectiveDate: string; reason: string; createdAt: string;
}

export interface LeaveBalance {
  employeeId: string; employeeCode: string; employeeName: string; departmentName: string; year: number;
  leaveTypeId: string; leaveTypeName: string; leaveTypeCode?: string; granted: number; carryover: number; adjustments: number;
  used: number; pending: number; officialRemaining: number; availableAfterPending: number;
}

export interface LeavePolicy {
  weekendDays: number[]; allowNegativeBalance: boolean; allowWithdrawPending: boolean;
  cancellationRequiresApproval: boolean; carryoverEnabled: boolean; carryoverMaxDays: number;
}
