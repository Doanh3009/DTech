"use client";

import { usePathname } from "next/navigation";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { applicationForPath } from "@/config/moduleRegistry";
import { cn } from "@/lib/utils/cn";

export function CardSkeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-card", className)}><span /><span /><span /></div>;
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-chart", className)}><span /><i /><i /><i /><i /></div>;
}

export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton-table", className)}>{Array.from({ length: rows }, (_, index) => <span key={index}><i /><i /><i /></span>)}</div>;
}

export function PageSkeleton() {
  return <div aria-label="Đang tải trang" className="page-skeleton" role="status"><LoadingSpinner /><div className="page-skeleton__heading"><span /><span /></div><div className="page-skeleton__cards"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div><TableSkeleton /></div>;
}

export function ModuleTransition() {
  const pathname = usePathname();
  const application = applicationForPath(pathname);
  return (
    <div aria-label={`Đang mở ${application.label}`} className="module-transition" role="status">
      <LoadingSpinner />
      <span className="sr-only">Đang mở {application.label}</span>
    </div>
  );
}

export const GlobalRouteLoader = ModuleTransition;
