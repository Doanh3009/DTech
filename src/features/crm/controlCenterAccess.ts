import "server-only";
import { AppError } from "@/lib/api/errors";
import { requirePermission } from "@/services/authorization/requirePermission";
import { getRequestUser } from "@/services/auth/getRequestUser";
import type { Permission } from "@/lib/auth/permissions";

export function controlCenterEnabled() { return process.env.DTECH_CONTROL_CENTER_ENABLED === "true"; }
export async function requireControlCenter(permission: Permission = "crm.view") {
  if (!controlCenterEnabled()) throw new AppError("NOT_FOUND");
  const user = await getRequestUser();
  requirePermission(user, "crm.view"); requirePermission(user, permission);
  return user!;
}
