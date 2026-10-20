import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

type MetricAccent = "green" | "blue" | "purple" | "amber" | "coral" | "teal";

export function MetricCard({ accent, children, className }: DashboardCardProps & { accent: MetricAccent }) {
  return <div className={cn("dashboard-overview__metric", `dashboard-overview__metric--${accent}`, className)}>{children}</div>;
}

export function ChartCard({ children, className }: DashboardCardProps) {
  return <section className={cn("dashboard-data-chart", className)}>{children}</section>;
}

export function AnalyticsCard({ children, className }: DashboardCardProps) {
  return <section className={cn("dashboard-analytics-card", className)}>{children}</section>;
}

export function ProgressCard({ children, className }: DashboardCardProps) {
  return <section className={cn("dashboard-card", "dashboard-card--progress", className)}>{children}</section>;
}

export function ActivityCard({ children, className }: DashboardCardProps) {
  return <section className={cn("dashboard-card", "dashboard-card--activity", className)}>{children}</section>;
}

export function TaskCard({ children, className }: DashboardCardProps) {
  return <section className={cn("dashboard-card", "dashboard-card--task", className)}>{children}</section>;
}
