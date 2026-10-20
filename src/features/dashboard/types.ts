import type { Permission } from "@/lib/auth/permissions";

export const dashboardProfileKeys = [
  "management",
  "supervisor",
  "import_export",
  "warehouse",
  "accounting",
  "hr",
  "employee"
] as const;

export type DashboardProfileKey = (typeof dashboardProfileKeys)[number];

export const dashboardWidgetKeys = [
  "attendance_overview",
  "employee_today",
  "supervisor_today",
  "my_approvals",
  "timesheet_exceptions",
  "project_attention",
  "warehouse_low_stock",
  "shipment_attention",
  "accounting_summary",
  "hr_summary",
  "recent_activity",
  "recent_notifications",
  "quick_actions"
] as const;

export type DashboardWidgetKey = (typeof dashboardWidgetKeys)[number];

export const dashboardLandingPages = [
  "/home",
  "/dashboard",
  "/dashboard/hr",
  "/dashboard/warehouse",
  "/dashboard/import-export",
  "/dashboard/management",
  "/attendance",
  "/attendance/me",
  "/attendance/history",
  "/attendance/requests",
  "/employees",
  "/project-monitoring",
  "/warehouse/inventory",
  "/import-export/shipments",
  "/accounting/salaries",
  "/accounting/payroll",
  "/accounting/payslips",
  "/approvals",
  "/documents",
  "/reports",
  "/messages",
  "/search",
  "/settings",
  "/system-admin",
  "/profile",
  "/worker-attendance/today",
  "/projects"
] as const;

export type DashboardLandingPage = (typeof dashboardLandingPages)[number];

export type AttentionPriority = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface DashboardMetric {
  label: string;
  value: number | string;
  href?: string;
  tone?: "neutral" | "success" | "warning" | "error" | "info";
}

export interface DashboardItem {
  id: string;
  type: string;
  title: string;
  context?: string;
  priority?: AttentionPriority;
  dueOrAge?: string;
  href: string;
  status?: string;
}

export interface DashboardAction {
  key: string;
  label: string;
  href: string;
  requiredPermission: Permission;
}

export interface DashboardChartSeries {
  label: string;
  value: number;
  href?: string;
  tone?: keyof typeof import("@/config/dataVisualization").semanticChartColors;
}

export interface DashboardChart {
  key: string;
  title: string;
  series: DashboardChartSeries[];
  kind?: "bar" | "line" | "donut";
  unit?: string;
  maxValue?: number;
  context?: string;
  emptyLabel?: string;
}

export interface DashboardWidgetData {
  metrics?: DashboardMetric[];
  items?: DashboardItem[];
  actions?: DashboardAction[];
  charts?: DashboardChart[];
  state?: Record<string, string | number | boolean | undefined>;
}

export interface DashboardWidgetResult {
  key: DashboardWidgetKey;
  label: string;
  status: "ready" | "error";
  data?: DashboardWidgetData;
  error?: string;
}

export interface DashboardReadModel {
  profile: DashboardProfileKey;
  profileLabel: string;
  generatedAt: string;
  widgets: DashboardWidgetResult[];
  attention: DashboardItem[];
}

export interface DashboardPresetSetting {
  profile: DashboardProfileKey;
  landingPage: DashboardLandingPage;
  enabledWidgets: DashboardWidgetKey[];
}

export interface DashboardSettings {
  presetOrder: DashboardProfileKey[];
  presets: DashboardPresetSetting[];
}
