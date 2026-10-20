import type { InsurancePaymentStatus, InsuranceContribution } from "./sharedtypes";

export const insurancePaymentLabels: Record<InsurancePaymentStatus, string> = { pending: "Chưa đóng", paid: "Đã đóng", overdue: "Chậm đóng" };
export const insuranceParticipationLabels: Record<string, string> = { active: "Đang tham gia", suspended: "Tạm dừng", ended: "Đã kết thúc", not_participating: "Không tham gia" };
export const insuranceChangeLabels: Record<string, string> = { joined: "Tham gia", adjusted: "Điều chỉnh", suspended: "Tạm dừng", resumed: "Tham gia lại", ended: "Kết thúc", contribution_recorded: "Ghi nhận kỳ đóng" };

export function insuranceMoney(value?: number) {
  return value == null ? "—" : new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export function insuranceMonth(value?: string) {
  if (!value) return "—";
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

export function latestInsuranceContribution(contributions?: InsuranceContribution[]) {
  return [...(contributions ?? [])].sort((left, right) => right.contributionMonth.localeCompare(left.contributionMonth))[0];
}
