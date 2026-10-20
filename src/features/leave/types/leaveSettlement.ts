export type LeaveSettlementStatus = "not_due" | "missing_rate" | "invalid_rate" | "pending_leave" | "waiting_payroll" | "waiting_calculation" | "payroll_locked" | "included";
export interface LeaveSettlementRow {
  employeeId: string; employeeCode: string; employeeName: string;
  leaveTypeId: string; leaveTypeName: string; leaveTypeCode?: string;
  balanceDays: number; days: number; dailyRate: number | null; rateVersion: number | null;
  amount: number; status: LeaveSettlementStatus; payrollPeriodId?: string;
}
export interface LeaveSettlementOverview { year: number; rows: LeaveSettlementRow[]; lastRunAt?: string; }
