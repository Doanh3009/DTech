export type InsurancePaymentStatus = "pending" | "paid" | "overdue";
export type InsuranceParticipationStatus = "active" | "suspended" | "ended" | "not_participating";

export interface InsuranceHistory {
  id: string;
  employeeId: string;
  changeType: string;
  effectiveDate: string;
  reason: string;
  changedAt: string;
  changedByName: string;
  snapshot: Record<string, unknown>;
  fileId?: string;
  fileName?: string;
}

export interface InsuranceRecord {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  socialInsuranceNumber: string;
  participationStatus: InsuranceParticipationStatus;
  startDate?: string;
  contributionBase?: number;
  contributionRatePercent?: number;
  contributionMonth?: string;
  paymentStatus: InsurancePaymentStatus;
  socialInsuranceEnabled: boolean;
  healthInsuranceEnabled: boolean;
  unemploymentInsuranceEnabled: boolean;
  updatedAt: string;
  history: InsuranceHistory[];
  contributions: InsuranceContribution[];
}

export interface InsuranceEmployee { id: string; code: string; name: string }

export interface InsuranceContribution {
  id: string;
  employeeId: string;
  contributionMonth: string;
  contributionBase?: number;
  contributionRatePercent?: number;
  expectedAmount?: number;
  paidAmount?: number;
  paymentStatus: InsurancePaymentStatus;
  paidDate?: string;
  note?: string;
  updatedAt: string;
  source: "recorded" | "legacy_profile";
}

export interface InsuranceContributionInput {
  employeeId: string;
  contributionMonth: string;
  contributionBase?: number;
  contributionRatePercent?: number;
  paidAmount?: number;
  paymentStatus: InsurancePaymentStatus;
  paidDate?: string;
  note?: string;
  expectedUpdatedAt?: string;
}
