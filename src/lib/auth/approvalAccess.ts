import { can, type Permission } from "@/lib/auth/permissions";

export const generalApprovalInboxPermissions = [
  "approval.inbox.view", "approval.view", "approval.view_assigned", "approval.view_all", "approval.act"
] as const satisfies readonly Permission[];

export const approvalInboxPermissions = [
  ...generalApprovalInboxPermissions, "leave.approve", "leave.approve_all"
] as const satisfies readonly Permission[];

export function canViewApprovalInbox(permissions: readonly Permission[]): boolean {
  return approvalInboxPermissions.some((permission) => can(permissions, permission));
}

export function canViewGeneralApprovals(permissions: readonly Permission[]): boolean {
  return generalApprovalInboxPermissions.some((permission) => can(permissions, permission));
}

export function canDecideApprovalDomain(permissions: readonly Permission[], domainType: string): boolean {
  return can(permissions, "approval.act") || domainType === "LEAVE" && (
    can(permissions, "leave.approve") || can(permissions, "leave.approve_all")
  );
}
