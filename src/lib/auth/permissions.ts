export type Permission =
  | "dashboard.view"
  | "employee.view"
  | "employee.view_sensitive"
  | "employee.create"
  | "employee.edit"
  | "employee.edit_sensitive"
  | "employee.archive"
  | "employee.offboard"
  | "employee.export_basic"
  | "employee.export_sensitive"
  | "employee.identity_document.view"
  | "employee.identity_document.edit"
  | "contract.view"
  | "contract.edit"
  | "contract.file.view"
  | "contract.file.upload"
  | "insurance.view"
  | "insurance.edit"
  | "insurance.history.view"
  | "insurance.document.view"
  | "insurance.document.upload"
  | "account.view"
  | "account.create"
  | "account.disable"
  | "account.enable"
  | "account.assign_role"
  | "account.revoke_sessions"
  | "attendance.view"
  | "attendance.self.view"
  | "attendance.self.create"
  | "attendance.view_team"
  | "attendance.view_all"
  | "attendance.view_photo"
  | "attendance.review"
  | "attendance.adjust"
  | "attendance.config.view"
  | "attendance.config.manage"
  | "attendance.self"
  | "attendance.self_history"
  | "attendance.self_request"
  | "attendance.period.manage"
  | "attendance.manage"
  | "attendance.log.view"
  | "shift.edit"
  | "timesheet.view"
  | "shift.view"
  | "shift.manage"
  | "timesheet.self.view"
  | "timesheet.view_team"
  | "timesheet.view_all"
  | "timesheet.adjust"
  | "timesheet.lock"
  | "timesheet.unlock"
  | "timesheet.export"
  | "timesheet.export_detail"
  | "attendance.raw.view"
  | "attendance.photo.view"
  | "export_template.view"
  | "export_template.manage"
  | "report.employee_basic"
  | "report.employee_sensitive"
  | "leave.export"
  | "leave.view"
  | "leave.self.view"
  | "leave.self.create"
  | "leave.self.withdraw"
  | "leave.approve"
  | "leave.approve_all"
  | "leave.view_team"
  | "leave.view_all"
  | "leave.balance.view_self"
  | "leave.balance.view_all"
  | "leave.balance.adjust"
  | "leave.type.manage"
  | "leave.workflow.manage"
  | "leave.policy.manage"
  | "leave.pdf.export_self"
  | "leave.pdf.export_all"
  | "project.view"
  | "project.create"
  | "project.edit"
  | "project.manage_team"
  | "project.manage_schedule"
  | "project_update.create"
  | "project_update.view_project"
  | "project_update.view_all"
  | "project_update.edit_own"
  | "project_update.edit_all"
  | "project_update.archive"
  | "project_update.pin"
  | "project_health.update"
  | "project_issue.view"
  | "project_issue.manage"
  | "project_issue.resolve"
  | "project_monitoring.view"
  | "project_monitoring.view_all"
  | "worker_attendance.view"
  | "worker_attendance.self_scope"
  | "worker_attendance.create"
  | "worker_attendance.view_project"
  | "worker_attendance.view_all"
  | "worker_attendance.view_photo"
  | "worker_attendance.adjust"
  | "worker_attendance.lock"
  | "worksite.view"
  | "worksite.manage"
  | "warehouse.view"
  | "warehouse.view_all"
  | "warehouse.item.view"
  | "warehouse.item.manage"
  | "warehouse.master.manage"
  | "warehouse.receipt.view"
  | "warehouse.receipt.create"
  | "warehouse.receipt.post"
  | "warehouse.receipt.reverse"
  | "warehouse.issue.view"
  | "warehouse.issue.create"
  | "warehouse.issue.post"
  | "warehouse.issue.reverse"
  | "warehouse.transfer.view"
  | "warehouse.transfer.create"
  | "warehouse.transfer.post"
  | "warehouse.adjustment.view"
  | "warehouse.adjustment.create"
  | "warehouse.adjustment.post"
  | "warehouse.stock_count.view"
  | "warehouse.stock_count.create"
  | "warehouse.stock_count.post"
  | "warehouse.ledger.view"
  | "warehouse.report.export"
  | "import_export.view"
  | "import_export.view_all"
  | "import_contract.view"
  | "import_contract.create"
  | "import_contract.edit"
  | "import_contract.close"
  | "shipment.view"
  | "shipment.create"
  | "shipment.edit"
  | "shipment.update_schedule"
  | "shipment.close"
  | "shipment.cancel"
  | "shipment_document.view"
  | "shipment_document.upload"
  | "shipment_document.replace"
  | "customs.view"
  | "customs.manage"
  | "shipment_receiving.view"
  | "shipment_receiving.create_receipt"
  | "partner.view"
  | "partner.manage"
  | "import_export.report.export"
  | "accounting.access"
  | "salary.view"
  | "salary.edit"
  | "salary.history.view"
  | "payroll.view"
  | "payroll.create"
  | "payroll.edit"
  | "payroll.lock"
  | "payroll.export"
  | "payslip.create"
  | "payslip.publish"
  | "payslip.revoke"
  | "payslip.self.view"
  | "bonus.manage"
  | "allowance.manage"
  | "deduction.manage"
  | "chat.access"
  | "chat.group.create"
  | "approval.view"
  | "approval.inbox.view"
  | "approval.view_assigned"
  | "approval.view_all"
  | "approval.act"
  | "approval.reassign"
  | "approval.workflow.manage"
  | "approval.delegation.manage"
  | "report.view"
  | "notification.view"
  | "notification.self.view"
  | "notification.preference.manage"
  | "notification.system_notice.manage"
  | "document.view"
  | "document.upload"
  | "document.replace"
  | "document.archive"
  | "document.company_manage"
  | "profile.view"
  | "user.view"
  | "role.view"
  | "role.manage"
  | "permission.view"
  | "settings.view"
  | "system_admin.access"
  | "branding.view"
  | "branding.manage"
  | "appearance.view"
  | "appearance.manage"
  | "navigation.manage"
  | "module.manage"
  | "organization_settings.view"
  | "organization_settings.manage"
  | "localization.manage"
  | "config_history.view"
  | "config_history.restore"
  | "department.manage"
  | "position.manage"
  | "audit.view"
  | "audit.view_sensitive"
  | "settings.manage"
  | "integration.view"
  | "integration.manage"
  | "api_key.view"
  | "api_key.create"
  | "api_key.revoke"
  | "service_account.manage"
  | "webhook.view"
  | "webhook.manage"
  | "webhook.retry"
  | "integration_log.view"
  | "integration_conflict.view"
  | "integration_conflict.resolve"
  | "import.create"
  | "import.execute"
  | "api_docs.view"
  | "file.read"
  | "webhook.publish"
  | "operations.view"
  | "operations.run"
  | "jobs.retry";

export type PermissionSet = ReadonlySet<Permission>;

export type AccountStatus = "pending_activation" | "active" | "disabled" | "locked" | "invited";

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  username: string;
  email: string;
  status: AccountStatus;
  permissions: Permission[];
}

export const allFoundationPermissions: Permission[] = [
  "dashboard.view",
  "employee.view",
  "employee.view_sensitive",
  "employee.create",
  "employee.edit",
  "employee.edit_sensitive",
  "employee.archive",
  "employee.offboard",
  "employee.export_basic",
  "employee.export_sensitive",
  "employee.identity_document.view",
  "employee.identity_document.edit",
  "contract.view",
  "contract.edit",
  "contract.file.view",
  "contract.file.upload",
  "insurance.view",
  "insurance.edit",
  "insurance.history.view",
  "insurance.document.view",
  "insurance.document.upload",
  "account.view",
  "account.create",
  "account.disable",
  "account.enable",
  "account.assign_role",
  "account.revoke_sessions",
  "attendance.view",
  "attendance.self.view",
  "attendance.self.create",
  "attendance.view_team",
  "attendance.view_all",
  "attendance.view_photo",
  "attendance.review",
  "attendance.adjust",
  "attendance.config.view",
  "attendance.config.manage",
  "attendance.self",
  "attendance.self_history",
  "attendance.self_request",
  "attendance.period.manage",
  "attendance.manage",
  "attendance.log.view",
  "shift.edit",
  "timesheet.view",
  "shift.view",
  "shift.manage",
  "timesheet.self.view",
  "timesheet.view_team",
  "timesheet.view_all",
  "timesheet.adjust",
  "timesheet.lock",
  "timesheet.unlock",
  "timesheet.export",
  "timesheet.export_detail",
  "attendance.raw.view",
  "attendance.photo.view",
  "export_template.view",
  "export_template.manage",
  "report.employee_basic",
  "report.employee_sensitive",
  "leave.export",
  "leave.view",
  "leave.self.view",
  "leave.self.create",
  "leave.self.withdraw",
  "leave.approve",
  "leave.approve_all",
  "leave.view_team",
  "leave.view_all",
  "leave.balance.view_self",
  "leave.balance.view_all",
  "leave.balance.adjust",
  "leave.type.manage",
  "leave.workflow.manage",
  "leave.policy.manage",
  "leave.pdf.export_self",
  "leave.pdf.export_all",
  "project.view",
  "project.create",
  "project.edit",
  "project.manage_team",
  "project.manage_schedule",
  "project_update.create",
  "project_update.view_project",
  "project_update.view_all",
  "project_update.edit_own",
  "project_update.edit_all",
  "project_update.archive",
  "project_update.pin",
  "project_health.update",
  "project_issue.view",
  "project_issue.manage",
  "project_issue.resolve",
  "project_monitoring.view",
  "project_monitoring.view_all",
  "worker_attendance.view",
  "worker_attendance.self_scope",
  "worker_attendance.create",
  "worker_attendance.view_project",
  "worker_attendance.view_all",
  "worker_attendance.view_photo",
  "worker_attendance.adjust",
  "worker_attendance.lock",
  "worksite.view",
  "worksite.manage",
  "warehouse.view",
  "warehouse.view_all",
  "warehouse.item.view",
  "warehouse.item.manage",
  "warehouse.master.manage",
  "warehouse.receipt.view",
  "warehouse.receipt.create",
  "warehouse.receipt.post",
  "warehouse.receipt.reverse",
  "warehouse.issue.view",
  "warehouse.issue.create",
  "warehouse.issue.post",
  "warehouse.issue.reverse",
  "warehouse.transfer.view",
  "warehouse.transfer.create",
  "warehouse.transfer.post",
  "warehouse.adjustment.view",
  "warehouse.adjustment.create",
  "warehouse.adjustment.post",
  "warehouse.stock_count.view",
  "warehouse.stock_count.create",
  "warehouse.stock_count.post",
  "warehouse.ledger.view",
  "warehouse.report.export",
  "import_export.view",
  "import_export.view_all",
  "import_contract.view",
  "import_contract.create",
  "import_contract.edit",
  "import_contract.close",
  "shipment.view",
  "shipment.create",
  "shipment.edit",
  "shipment.update_schedule",
  "shipment.close",
  "shipment.cancel",
  "shipment_document.view",
  "shipment_document.upload",
  "shipment_document.replace",
  "customs.view",
  "customs.manage",
  "shipment_receiving.view",
  "shipment_receiving.create_receipt",
  "partner.view",
  "partner.manage",
  "import_export.report.export",
  "accounting.access",
  "salary.view",
  "salary.edit",
  "salary.history.view",
  "payroll.view",
  "payroll.create",
  "payroll.edit",
  "payroll.lock",
  "payroll.export",
  "payslip.create",
  "payslip.publish",
  "payslip.revoke",
  "payslip.self.view",
  "bonus.manage",
  "allowance.manage",
  "deduction.manage",
  "chat.access",
  "chat.group.create",
  "approval.view",
  "approval.inbox.view",
  "approval.view_assigned",
  "approval.view_all",
  "approval.act",
  "approval.reassign",
  "approval.workflow.manage",
  "approval.delegation.manage",
  "report.view",
  "notification.view",
  "notification.self.view",
  "notification.preference.manage",
  "notification.system_notice.manage",
  "document.view",
  "document.upload",
  "document.replace",
  "document.archive",
  "document.company_manage",
  "profile.view",
  "user.view",
  "role.view",
  "role.manage",
  "permission.view",
  "settings.view",
  "system_admin.access",
  "branding.view",
  "branding.manage",
  "appearance.view",
  "appearance.manage",
  "navigation.manage",
  "module.manage",
  "organization_settings.view",
  "organization_settings.manage",
  "localization.manage",
  "config_history.view",
  "config_history.restore",
  "department.manage",
  "position.manage",
  "audit.view",
  "audit.view_sensitive",
  "settings.manage",
  "integration.view",
  "integration.manage",
  "api_key.view",
  "api_key.create",
  "api_key.revoke",
  "service_account.manage",
  "webhook.view",
  "webhook.manage",
  "webhook.retry",
  "integration_log.view",
  "integration_conflict.view",
  "integration_conflict.resolve",
  "import.create",
  "import.execute",
  "api_docs.view",
  "file.read",
  "webhook.publish",
  "operations.view",
  "operations.run",
  "jobs.retry"
];

export function createPermissionSet(permissions: readonly Permission[]): PermissionSet {
  return new Set(permissions);
}

export function can(
  permissionSet: PermissionSet | readonly Permission[],
  permission: Permission
): boolean {
  if ("has" in permissionSet) {
    return permissionSet.has(permission);
  }

  return permissionSet.includes(permission);
}

export function canAll(
  permissionSet: PermissionSet | readonly Permission[],
  permissions: readonly Permission[]
): boolean {
  return permissions.every((permission) => can(permissionSet, permission));
}

export function isAccountEnabled(user: Pick<AuthenticatedUser, "status">): boolean {
  return user.status === "active";
}
