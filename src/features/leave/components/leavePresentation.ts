import type { LeaveRequest, LeaveRequestStatus } from "../types/leaveTypes";
import { formatBusinessDate } from "@/lib/time/timezone";

export const leaveStatusLabels: Record<LeaveRequestStatus, string> = {
  draft: "Nháp", submitted: "Đã gửi", pending_approval: "Chờ duyệt", approved: "Đã duyệt",
  rejected: "Từ chối", withdrawn: "Đã thu hồi", cancelled: "Đã hủy"
};
export const approverSourceLabels: Record<string, string> = {
  direct_manager: "Quản lý trực tiếp", department_manager: "Trưởng phòng", specific_role: "Vai trò chỉ định",
  specific_user: "Người được chỉ định", hr_role: "Nhân sự", hr_resolver: "Nhân sự"
};
export const dayPartLabels = { full_day: "Cả ngày", morning: "Buổi sáng", afternoon: "Buổi chiều" };
export const formatLeaveDays = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
export function leaveDateLabel(item: LeaveRequest) {
  return item.startDate === item.endDate
    ? `${formatBusinessDate(item.startDate)} · ${dayPartLabels[item.startDayPart]}`
    : `${formatBusinessDate(item.startDate)}${item.startDayPart === "full_day" ? "" : ` · ${dayPartLabels[item.startDayPart]}`} – ${formatBusinessDate(item.endDate)}${item.endDayPart === "full_day" ? "" : ` · ${dayPartLabels[item.endDayPart]}`}`;
}
export function monthDates(month: string) {
  const [year, number] = month.split("-").map(Number);
  return Array.from({ length: new Date(Date.UTC(year, number, 0)).getUTCDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}
export function shiftMonth(month: string, amount: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
}
export const isAwaitingLeave = (item: LeaveRequest) => item.status === "submitted" || item.status === "pending_approval";
