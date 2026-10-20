import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

export type StatusBadgeTone = "neutral" | "success" | "warning" | "error" | "info";

export interface StatusPresentation {
  label: string;
  tone: StatusBadgeTone;
}

export const statusPresentation: Readonly<Record<string, StatusPresentation>> = {
  calculated: { label: "Đã tính", tone: "info" },
  active: { label: "Đang hoạt động", tone: "success" },
  arrived_port: { label: "Đã cập cảng", tone: "info" },
  approved: { label: "Đã duyệt", tone: "success" },
  available: { label: "Sẵn sàng", tone: "success" },
  completed: { label: "Hoàn tất", tone: "success" },
  customs_cleared: { label: "Đã thông quan", tone: "success" },
  cleared: { label: "Đã thông quan", tone: "success" },
  done: { label: "Hoàn thành", tone: "success" },
  enabled: { label: "Đã bật", tone: "success" },
  in_stock: { label: "Còn hàng", tone: "success" },
  locked: { label: "Đã khóa", tone: "success" },
  present: { label: "Có mặt", tone: "success" },
  published: { label: "Đã phát hành", tone: "success" },
  recorded: { label: "Đã ghi nhận", tone: "success" },
  received: { label: "Đã nhận", tone: "success" },
  resolved: { label: "Đã xử lý", tone: "success" },
  synced: { label: "Đã đồng bộ", tone: "success" },
  valid: { label: "Hợp lệ", tone: "success" },
  draft: { label: "Nháp", tone: "neutral" },
  not_started: { label: "Chưa bắt đầu", tone: "neutral" },
  planned: { label: "Kế hoạch", tone: "neutral" },
  unconfirmed: { label: "Chưa xác nhận", tone: "neutral" },
  expired: { label: "Hết hạn", tone: "neutral" },
  inactive: { label: "Ngừng hoạt động", tone: "neutral" },
  disabled: { label: "Đã tắt", tone: "neutral" },
  archived: { label: "Đã lưu trữ", tone: "neutral" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
  terminated: { label: "Đã chấm dứt", tone: "neutral" },
  in_progress: { label: "Đang thực hiện", tone: "info" },
  booked: { label: "Đã đặt chỗ", tone: "info" },
  declared: { label: "Đã khai", tone: "info" },
  delivering_to_warehouse: { label: "Đang giao kho", tone: "info" },
  preparing_documents: { label: "Chuẩn bị hồ sơ", tone: "info" },
  transferred: { label: "Điều chuyển", tone: "info" },
  processing: { label: "Đang xử lý", tone: "info" },
  leave: { label: "Nghỉ phép", tone: "info" },
  new: { label: "Mới", tone: "info" },
  pending: { label: "Chờ xử lý", tone: "warning" },
  waiting: { label: "Chờ xử lý", tone: "warning" },
  pending_approval: { label: "Chờ duyệt", tone: "warning" },
  submitted: { label: "Đã gửi", tone: "warning" },
  needs_review: { label: "Cần kiểm tra", tone: "warning" },
  reviewed: { label: "Đã kiểm tra", tone: "warning" },
  late: { label: "Đi trễ", tone: "warning" },
  low_stock: { label: "Sắp hết", tone: "warning" },
  customs_processing: { label: "Đang thông quan", tone: "warning" },
  in_transit: { label: "Đang vận chuyển", tone: "warning" },
  inspection: { label: "Kiểm hóa", tone: "warning" },
  over_received: { label: "Nhận thừa", tone: "warning" },
  partially_received: { label: "Nhận một phần", tone: "warning" },
  partially_shipped: { label: "Giao một phần", tone: "warning" },
  pending_duty: { label: "Chờ thuế", tone: "warning" },
  short_closed: { label: "Đã chốt thiếu", tone: "warning" },
  offline: { label: "Ngoại tuyến", tone: "warning" },
  blocked: { label: "Bị chặn", tone: "error" },
  absent: { label: "Vắng", tone: "error" },
  error: { label: "Lỗi", tone: "error" },
  failed: { label: "Thất bại", tone: "error" },
  issue: { label: "Vướng mắc", tone: "error" },
  missing: { label: "Thiếu", tone: "error" },
  out_of_stock: { label: "Hết hàng", tone: "error" },
  rejected: { label: "Từ chối", tone: "error" },
  revoked: { label: "Đã thu hồi", tone: "error" },
  withdrawn: { label: "Đã thu hồi", tone: "neutral" },
  sync_failed: { label: "Đồng bộ lỗi", tone: "error" }
};

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function resolveStatusPresentation(status: string): StatusPresentation {
  const normalized = normalizeStatus(status);
  return statusPresentation[normalized] ?? { label: status, tone: "neutral" };
}

export interface StatusBadgeProps {
  children?: ReactNode;
  status?: string;
  tone?: StatusBadgeTone;
}

export function StatusBadge({ children, status, tone }: StatusBadgeProps) {
  const presentation = status ? resolveStatusPresentation(status) : undefined;
  const resolvedTone = tone ?? presentation?.tone ?? "neutral";
  return <span className={cn("status-badge", `status-badge--${resolvedTone}`)}>{children ?? presentation?.label}</span>;
}

export function BusinessStatusBadge({ status, label }: { status: string; label?: ReactNode }) {
  return <StatusBadge status={status}>{label}</StatusBadge>;
}
