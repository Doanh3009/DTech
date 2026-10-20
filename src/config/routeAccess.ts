import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { managedTimesheetPermissions } from "@/lib/auth/applicationAccess";
import { approvalInboxPermissions } from "@/lib/auth/approvalAccess";

export type ProtectedArea =
  | "dashboard" | "employees" | "attendance" | "attendance-admin" | "timesheets" | "shifts"
  | "leave" | "projects" | "project-monitoring" | "worker-attendance"
  | "warehouse" | "import-export" | "approvals" | "documents" | "reports"
  | "notifications" | "profile" | "search" | "settings" | "accounting" | "messages";

export const areaPermissionCatalog: Readonly<Record<ProtectedArea, readonly Permission[]>> = {
  dashboard: ["dashboard.view", "attendance.self.view", "worker_attendance.view", "project_monitoring.view", "warehouse.view", "import_export.view", "salary.view", "payroll.view", "payslip.self.view"],
  employees: ["employee.view", "contract.view", "insurance.view", "department.manage", "position.manage"],
  attendance: ["attendance.view", "attendance.self", "attendance.self.view", "attendance.self.create", "attendance.self_history", "attendance.self_request", "attendance.view_team", "attendance.view_all", "attendance.manage", "attendance.adjust", "attendance.log.view"],
  "attendance-admin": ["attendance.view_all", "attendance.manage", "attendance.log.view"],
  timesheets: managedTimesheetPermissions,
  shifts: ["shift.view", "shift.manage", "shift.edit", "settings.view"],
  leave: ["leave.view", "leave.self.view", "leave.self.create", "leave.self.withdraw", "leave.view_team", "leave.view_all", "leave.approve", "leave.approve_all", "leave.balance.view_self", "leave.balance.view_all", "leave.balance.adjust"],
  projects: ["project.view", "project_update.view_project", "project_update.view_all", "project_update.create"],
  "project-monitoring": ["project_monitoring.view", "project_monitoring.view_all", "project_issue.view"],
  "worker-attendance": ["worker_attendance.view", "worker_attendance.self_scope", "worker_attendance.view_project", "worker_attendance.view_all"],
  warehouse: ["warehouse.view", "warehouse.view_all", "warehouse.item.view", "warehouse.receipt.view", "warehouse.issue.view", "warehouse.transfer.view", "warehouse.ledger.view"],
  "import-export": ["import_export.view", "import_export.view_all", "shipment.view", "customs.view", "import_contract.view", "partner.view"],
  approvals: approvalInboxPermissions,
  documents: ["document.view"],
  reports: ["report.view", "report.employee_basic", "report.employee_sensitive"],
  accounting: ["accounting.access", "salary.view", "salary.history.view", "payroll.view", "payslip.self.view"],
  messages: ["chat.access"],
  notifications: ["notification.view", "notification.self.view"],
  profile: ["profile.view"],
  search: ["dashboard.view", "employee.view", "project.view", "warehouse.view", "shipment.view", "document.view"],
  settings: ["settings.view", "user.view", "role.view", "permission.view", "integration.view", "attendance.config.view", "leave.type.manage", "leave.workflow.manage", "leave.policy.manage", "warehouse.master.manage"]
};

export function hasAreaAccess(permissions: readonly Permission[], area: ProtectedArea): boolean {
  return areaPermissionCatalog[area].some((permission) => can(permissions, permission));
}
