import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { approvalInboxPermissions } from "@/lib/auth/approvalAccess";

const personalAttendancePermissions = ["attendance.self", "attendance.self.view", "attendance.self.create"] as const;

export const humanResourcesPermissions = [
  "employee.view", "contract.view", "insurance.view", "department.manage", "position.manage",
  "attendance.view_all", "attendance.manage", "attendance.adjust", "attendance.period.manage",
  "timesheet.view_team", "timesheet.view_all", "timesheet.adjust", "timesheet.lock",
  "shift.view", "shift.manage", "shift.edit", "leave.view_all", "leave.view_team",
  "attendance.config.view", "attendance.config.manage", "leave.type.manage", "leave.workflow.manage", "leave.policy.manage"
] as const satisfies readonly Permission[];

export const managedTimesheetPermissions = [
  "timesheet.view_team", "timesheet.view_all", "timesheet.adjust", "timesheet.lock", "timesheet.unlock",
  "attendance.view_all", "attendance.manage", "attendance.period.manage", "attendance.adjust"
] as const satisfies readonly Permission[];

export function canOpenPersonalAttendance(permissions: readonly Permission[]): boolean {
  return personalAttendancePermissions.some((permission) => can(permissions, permission));
}

export function canSubmitPersonalAttendance(permissions: readonly Permission[]): boolean {
  return can(permissions, "attendance.self.create") || can(permissions, "attendance.self");
}

export const applicationPermissionSets = {
  overview: ["dashboard.view"],
  "human-resources": humanResourcesPermissions,
  attendance: ["attendance.self", "attendance.self.view", "attendance.self.create", "attendance.self_history", "attendance.self_request", "payslip.self.view"],
  projects: ["project.view", "project_monitoring.view", "project_monitoring.view_all", "project_issue.view", "worker_attendance.view", "worker_attendance.create", "worker_attendance.self_scope", "worker_attendance.view_project", "worker_attendance.view_all"],
  warehouse: ["warehouse.view", "warehouse.view_all", "warehouse.item.view", "warehouse.receipt.view", "warehouse.issue.view", "warehouse.transfer.view", "warehouse.adjustment.view", "warehouse.stock_count.view", "warehouse.ledger.view", "warehouse.master.manage"],
  "import-export": ["shipment.view", "import_contract.view", "shipment_document.view", "customs.view", "partner.view", "module.manage"],
  accounting: ["accounting.access", "payroll.view", "payroll.create", "salary.view", "salary.history.view"],
  messaging: ["chat.access"],
  operations: [...approvalInboxPermissions, "document.view", "report.view"],
  system: ["system_admin.access", "settings.view", "user.view", "role.view", "permission.view", "integration.view"]
} as const satisfies Readonly<Record<string, readonly Permission[]>>;
