import { visibleApplications, type ApplicationId } from "@/config/moduleRegistry";
import type { ModuleSettings } from "@/config/systemSettings";
import { dashboardWidgetRegistry, matchesAnyPermission } from "@/features/dashboard/registry";
import type { DashboardWidgetKey } from "@/features/dashboard/types";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

export const analyticsWidgets: Partial<Record<ApplicationId, readonly DashboardWidgetKey[]>> = {
  "human-resources": ["hr_summary", "attendance_overview", "timesheet_exceptions"],
  projects: ["project_attention", "supervisor_today"],
  warehouse: ["warehouse_low_stock"],
  "import-export": ["shipment_attention"],
  accounting: ["accounting_summary"],
  attendance: ["employee_today"],
  operations: ["my_approvals"]
};

export function dashboardModulesFor(user: AuthenticatedUser, modules?: ModuleSettings) {
  return visibleApplications(user, modules).filter((application) => analyticsWidgets[application.id]);
}

export function analyticsDefinitionsFor(user: AuthenticatedUser, modules: ModuleSettings) {
  const allowed = new Set(dashboardModulesFor(user, modules).flatMap((application) => analyticsWidgets[application.id] ?? []));
  return dashboardWidgetRegistry.filter((widget) => allowed.has(widget.key) && matchesAnyPermission(user.permissions, widget.requiredAny));
}

