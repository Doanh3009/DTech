import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { approvalInboxPermissions } from "@/lib/auth/approvalAccess";
import {
  dashboardProfileKeys,
  dashboardWidgetKeys,
  type DashboardAction,
  type DashboardLandingPage,
  type DashboardProfileKey,
  type DashboardSettings,
  type DashboardWidgetKey
} from "@/features/dashboard/types";

interface DashboardProfileDefinition {
  key: DashboardProfileKey;
  label: string;
  requiredAny: readonly Permission[];
  defaultLandingPage: DashboardLandingPage;
}

interface DashboardWidgetDefinition {
  key: DashboardWidgetKey;
  label: string;
  requiredAny: readonly Permission[];
  allowedProfiles: DashboardProfileKey[];
}

export const dashboardProfiles: DashboardProfileDefinition[] = [
  { key: "management", label: "Quản lý", requiredAny: ["project_monitoring.view_all"], defaultLandingPage: "/applications" },
  { key: "supervisor", label: "Giám sát", requiredAny: ["worker_attendance.create", "worker_attendance.self_scope"], defaultLandingPage: "/applications" },
  { key: "import_export", label: "Xuất nhập khẩu", requiredAny: ["import_export.view", "shipment.view"], defaultLandingPage: "/applications" },
  { key: "warehouse", label: "Kho", requiredAny: ["warehouse.view"], defaultLandingPage: "/applications" },
  { key: "accounting", label: "Kế toán", requiredAny: ["accounting.access", "salary.view", "payroll.view"], defaultLandingPage: "/applications" },
  { key: "hr", label: "Nhân sự", requiredAny: ["employee.view", "timesheet.view_all", "leave.view_all"], defaultLandingPage: "/applications" },
  { key: "employee", label: "Nhân viên", requiredAny: ["attendance.self.view", "leave.self.view", "profile.view", "dashboard.view"], defaultLandingPage: "/applications" }
];

export const dashboardWidgetRegistry: DashboardWidgetDefinition[] = [
  { key: "attendance_overview", label: "Chấm công hôm nay", requiredAny: ["attendance.view_all", "attendance.manage"], allowedProfiles: ["management", "hr"] },
  { key: "employee_today", label: "Hôm nay", requiredAny: ["attendance.self.view", "attendance.self.create"], allowedProfiles: ["employee"] },
  { key: "supervisor_today", label: "Công trường hôm nay", requiredAny: ["worker_attendance.create", "worker_attendance.self_scope"], allowedProfiles: ["supervisor"] },
  { key: "my_approvals", label: "Phê duyệt cần xử lý", requiredAny: approvalInboxPermissions, allowedProfiles: [...dashboardProfileKeys] },
  { key: "timesheet_exceptions", label: "Bảng công cần xử lý", requiredAny: ["timesheet.adjust", "timesheet.view_all", "timesheet.view_team"], allowedProfiles: ["hr", "management"] },
  { key: "project_attention", label: "Dự án cần chú ý", requiredAny: ["project_monitoring.view", "project_monitoring.view_all"], allowedProfiles: ["supervisor", "management"] },
  { key: "warehouse_low_stock", label: "Cảnh báo kho", requiredAny: ["warehouse.view"], allowedProfiles: ["warehouse", "management"] },
  { key: "shipment_attention", label: "Lô hàng cần chú ý", requiredAny: ["import_export.view", "shipment.view"], allowedProfiles: ["import_export", "management"] },
  { key: "accounting_summary", label: "Tổng quan kế toán", requiredAny: ["salary.view", "payroll.view", "payslip.self.view"], allowedProfiles: ["accounting", "management", "employee"] },
  { key: "hr_summary", label: "Tổng quan nhân sự", requiredAny: ["employee.view"], allowedProfiles: ["hr", "management"] },
  { key: "recent_notifications", label: "Thông báo", requiredAny: ["notification.self.view", "notification.view"], allowedProfiles: [...dashboardProfileKeys] },
  { key: "quick_actions", label: "Tác vụ thường dùng", requiredAny: ["dashboard.view"], allowedProfiles: [...dashboardProfileKeys] }
];

const defaultWidgets: Record<DashboardProfileKey, DashboardWidgetKey[]> = {
  management: ["attendance_overview", "my_approvals", "project_attention", "hr_summary", "timesheet_exceptions", "warehouse_low_stock", "shipment_attention"],
  import_export: ["shipment_attention", "my_approvals", "recent_notifications"],
  warehouse: ["warehouse_low_stock", "my_approvals", "recent_notifications"],
  accounting: ["accounting_summary", "timesheet_exceptions", "my_approvals", "recent_notifications"],
  hr: ["hr_summary", "attendance_overview", "timesheet_exceptions", "my_approvals", "recent_notifications"],
  supervisor: ["supervisor_today", "project_attention", "my_approvals", "recent_notifications"],
  employee: ["employee_today", "my_approvals", "recent_notifications"]
};

export const defaultDashboardSettings: DashboardSettings = {
  presetOrder: [...dashboardProfileKeys],
  presets: dashboardProfiles.map((profile) => ({
    profile: profile.key,
    landingPage: profile.defaultLandingPage,
    enabledWidgets: [...defaultWidgets[profile.key]]
  }))
};

export function matchesAnyPermission(permissions: readonly Permission[], requiredAny: readonly Permission[]): boolean {
  return requiredAny.length === 0 || requiredAny.some((permission) => can(permissions, permission));
}

export function resolveDashboardProfile(user: AuthenticatedUser, settings: DashboardSettings): DashboardProfileKey {
  // Profile precedence is a business rule, not a display preference. Persisted
  // preset ordering may come from an older release and must not reclassify a
  // supervisor as HR merely because both roles can view employees.
  const configuredProfiles = new Set(settings.presetOrder);
  for (const key of dashboardProfileKeys) {
    if (!configuredProfiles.has(key)) continue;
    const profile = dashboardProfiles.find((item) => item.key === key);
    if (profile && matchesAnyPermission(user.permissions, profile.requiredAny)) return profile.key;
  }
  return "employee";
}

export function canUseDashboardProfile(user: AuthenticatedUser, profile: DashboardProfileKey): boolean {
  const definition = dashboardProfiles.find((item) => item.key === profile);
  return Boolean(definition && matchesAnyPermission(user.permissions, definition.requiredAny));
}

export function resolveLandingPage(user: AuthenticatedUser, settings: DashboardSettings): string {
  return resolveRoleLandingPage(user, settings);
}

export function resolveRoleLandingPage(user: AuthenticatedUser, settings: DashboardSettings): string {
  const profile = resolveDashboardProfile(user, settings);
  const configured = settings.presets.find((item) => item.profile === profile)?.landingPage;
  const legacyDashboardRoutes = new Set(["/dashboard", "/home", "/dashboard/hr", "/dashboard/warehouse", "/dashboard/import-export", "/dashboard/management", "/attendance"]);
  const candidate = configured && !legacyDashboardRoutes.has(configured)
    ? configured
    : dashboardProfiles.find((item) => item.key === profile)?.defaultLandingPage ?? firstAccessibleRoute(user);
  return isLandingPageAllowed(user, candidate) ? candidate : firstAccessibleRoute(user);
}

const landingRoutes: ReadonlyArray<{ route: string; requiredAny: readonly Permission[] }> = [
  { route: "/applications", requiredAny: [] },
  { route: "/attendance/me", requiredAny: ["attendance.self", "attendance.self.view", "attendance.self.create"] },
  { route: "/attendance/history", requiredAny: ["attendance.self.view", "attendance.self_history"] },
  { route: "/attendance/requests", requiredAny: ["attendance.self", "attendance.self_request"] },
  { route: "/employees", requiredAny: ["employee.view"] },
  { route: "/employees/contracts", requiredAny: ["contract.view"] },
  { route: "/employees/insurance", requiredAny: ["insurance.view"] },
  { route: "/employees/departments", requiredAny: ["department.manage"] },
  { route: "/employees/positions", requiredAny: ["position.manage"] },
  { route: "/attendance/today", requiredAny: ["attendance.view_all", "attendance.manage"] },
  { route: "/timesheets", requiredAny: ["attendance.period.manage"] },
  { route: "/timesheets/matrix", requiredAny: ["timesheet.view_team", "timesheet.view_all"] },
  { route: "/timesheets/adjustments", requiredAny: ["timesheet.adjust", "attendance.adjust"] },
  { route: "/shifts", requiredAny: ["shift.view"] },
  { route: "/leave/manage", requiredAny: ["leave.view_all"] },
  { route: "/leave", requiredAny: ["leave.self.view", "leave.self.create"] },
  { route: "/project-monitoring", requiredAny: ["project_monitoring.view", "project_monitoring.view_all", "project_issue.view"] },
  { route: "/worker-attendance/today", requiredAny: ["worker_attendance.view", "worker_attendance.create", "worker_attendance.self_scope", "worker_attendance.view_project", "worker_attendance.view_all"] },
  { route: "/projects", requiredAny: ["project.view"] },
  { route: "/warehouse/inventory", requiredAny: ["warehouse.view", "warehouse.view_all"] },
  { route: "/warehouse/items", requiredAny: ["warehouse.item.view"] },
  { route: "/warehouse/receipts", requiredAny: ["warehouse.receipt.view"] },
  { route: "/warehouse/issues", requiredAny: ["warehouse.issue.view"] },
  { route: "/warehouse/transfers", requiredAny: ["warehouse.transfer.view"] },
  { route: "/warehouse/adjustments", requiredAny: ["warehouse.adjustment.view"] },
  { route: "/warehouse/stock-counts", requiredAny: ["warehouse.stock_count.view"] },
  { route: "/warehouse/ledger", requiredAny: ["warehouse.ledger.view"] },
  { route: "/import-export/shipments", requiredAny: ["shipment.view"] },
  { route: "/import-export/contracts", requiredAny: ["import_contract.view"] },
  { route: "/import-export/documents", requiredAny: ["shipment_document.view"] },
  { route: "/import-export/customs", requiredAny: ["customs.view"] },
  { route: "/import-export/partners", requiredAny: ["partner.view"] },
  { route: "/accounting/salaries", requiredAny: ["salary.view"] },
  { route: "/accounting/payroll", requiredAny: ["payroll.view", "payroll.create"] },
  { route: "/accounting/payslips", requiredAny: ["payslip.self.view"] },
  { route: "/accounting/salary-history", requiredAny: ["salary.history.view"] },
  { route: "/approvals", requiredAny: approvalInboxPermissions },
  { route: "/documents", requiredAny: ["document.view"] },
  { route: "/reports", requiredAny: ["report.view"] },
  { route: "/messages", requiredAny: ["chat.access"] },
  { route: "/notifications", requiredAny: ["notification.view", "notification.self.view"] },
  { route: "/settings", requiredAny: ["settings.view"] },
  { route: "/system-admin", requiredAny: ["system_admin.access"] },
  { route: "/search", requiredAny: ["dashboard.view"] },
  { route: "/profile", requiredAny: ["profile.view"] }
];

export function isLandingPageAllowed(user: AuthenticatedUser, route: string): boolean {
  const match = landingRoutes.find((item) => route === item.route || route.startsWith(`${item.route}/`));
  return match ? matchesAnyPermission(user.permissions, match.requiredAny) : false;
}

export function firstAccessibleRoute(user: AuthenticatedUser): string {
  return landingRoutes.find((item) => matchesAnyPermission(user.permissions, item.requiredAny))?.route ?? "/profile";
}

export function enabledWidgetsFor(user: AuthenticatedUser, profile: DashboardProfileKey, settings: DashboardSettings): DashboardWidgetDefinition[] {
  const selected = settings.presets.find((item) => item.profile === profile)?.enabledWidgets ?? defaultWidgets[profile];
  return selected.flatMap((key) => {
    const widget = dashboardWidgetRegistry.find((item) => item.key === key);
    return widget && widget.allowedProfiles.includes(profile) && matchesAnyPermission(user.permissions, widget.requiredAny) ? [widget] : [];
  });
}

export const commandActions: DashboardAction[] = [
  { key: "employee.create", label: "Thêm nhân viên", href: "/employees/new", requiredPermission: "employee.create" },
  { key: "project.create", label: "Tạo dự án", href: "/projects/new", requiredPermission: "project.create" },
  { key: "warehouse.receipt.create", label: "Tạo phiếu nhập", href: "/warehouse/receipts/new", requiredPermission: "warehouse.receipt.create" },
  { key: "warehouse.issue.create", label: "Tạo phiếu xuất", href: "/warehouse/issues/new", requiredPermission: "warehouse.issue.create" },
  { key: "warehouse.transfer.create", label: "Tạo phiếu chuyển", href: "/warehouse/transfers/new", requiredPermission: "warehouse.transfer.create" },
  { key: "shipment.create", label: "Tạo lô hàng", href: "/import-export/shipments/new", requiredPermission: "shipment.create" },
  { key: "payroll.create", label: "Tạo bảng lương", href: "/accounting/payroll", requiredPermission: "payroll.create" },
  { key: "leave.self.create", label: "Tạo đơn nghỉ", href: "/leave/new", requiredPermission: "leave.self.create" },
  { key: "worker_attendance.create", label: "Điểm danh hôm nay", href: "/worker-attendance/today", requiredPermission: "worker_attendance.create" },
  { key: "project_update.create", label: "Cập nhật dự án", href: "/projects/updates", requiredPermission: "project_update.create" }
];

export function visibleQuickActions(user: AuthenticatedUser): DashboardAction[] {
  return commandActions.filter((action) => can(user.permissions, action.requiredPermission));
}

export { dashboardProfileKeys, dashboardWidgetKeys };
