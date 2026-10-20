import type { ReactNode } from "react";

import type { Permission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";

export interface PermissionGateProps {
  permissions: readonly Permission[];
  require: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({
  permissions,
  require,
  children,
  fallback = null
}: PermissionGateProps) {
  if (!can(permissions, require)) {
    return fallback;
  }

  return children;
}
