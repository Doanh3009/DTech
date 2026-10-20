import { AlertTriangle, Ban, Inbox, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { RetryButton } from "@/components/shared/RetryButton";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { cn } from "@/lib/utils/cn";

interface StateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: StateProps) {
  return (
    <div className={cn("state-box", className)}>
      <Inbox aria-hidden="true" size={22} />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({
  title = "Đang tải dữ liệu",
  className
}: Partial<StateProps>) {
  return (
    <div aria-label={title} aria-live="polite" className={cn("state-box state-box--loading-pattern", className)} role="status">
      <span className="sr-only">{title}</span>
      <LoadingSpinner />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("skeleton", className)} />;
}

export function ErrorState({
  title = "Không thể tải dữ liệu",
  description = "Vui lòng thử lại. Nếu lỗi tiếp tục xảy ra, hãy báo quản trị hệ thống.",
  action,
  className
}: Partial<StateProps>) {
  return (
    <div role="alert" className={cn("state-box state-box--error", className)}>
      <AlertTriangle aria-hidden="true" size={22} />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ?? <RetryButton />}
    </div>
  );
}

export function PermissionDeniedState({
  title = "Không có quyền truy cập",
  description = "Bạn không có quyền xem nội dung này.",
  className
}: Partial<StateProps>) {
  return (
    <div role="alert" className={cn("state-box state-box--warning", className)}>
      <Ban aria-hidden="true" size={22} />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export const NoPermission = PermissionDeniedState;

export function OfflineState({
  title = "Đang offline",
  description = "Thao tác có thể được lưu trên thiết bị và đồng bộ khi có mạng.",
  className
}: Partial<StateProps>) {
  return (
    <div role="status" className={cn("state-box state-box--info", className)}>
      <WifiOff aria-hidden="true" size={22} />
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
