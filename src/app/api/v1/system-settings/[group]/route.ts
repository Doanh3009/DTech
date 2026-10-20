import type { Permission } from "@/lib/auth/permissions";
import { isSystemSettingsGroup, type SystemSettingsGroup } from "@/config/systemSettings";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { publishSettingsGroup, readSettingsGroup } from "@/services/system-settings/systemSettingsService";

const viewPermissionByGroup: Record<SystemSettingsGroup, Permission> = {
  branding: "branding.view",
  appearance: "appearance.view",
  organization: "organization_settings.view",
  localization: "system_admin.access",
  navigation: "system_admin.access",
  dashboard: "system_admin.access",
  modules: "system_admin.access",
  payslip: "system_admin.access"
};

const managePermissionByGroup: Record<SystemSettingsGroup, Permission> = {
  branding: "branding.manage",
  appearance: "appearance.manage",
  organization: "organization_settings.manage",
  localization: "localization.manage",
  navigation: "navigation.manage",
  dashboard: "navigation.manage",
  modules: "module.manage",
  payslip: "module.manage"
};

type GroupRouteContext = { params: Promise<{ group: string }> };

async function resolveGroup(context: GroupRouteContext): Promise<SystemSettingsGroup> {
  const { group } = await context.params;
  if (!isSystemSettingsGroup(group)) throw new AppError("NOT_FOUND");
  return group;
}

export async function GET(_request: Request, context: GroupRouteContext) {
  try {
    const group = await resolveGroup(context);
    const user = await getRequestUser();
    requirePermission(user, "system_admin.access");
    requirePermission(user, viewPermissionByGroup[group]);
    return successResponse({ group, value: await readSettingsGroup(group) });
  } catch (error) {
    logger.error("api.system_settings.group_read_failed");
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: GroupRouteContext) {
  try {
    const group = await resolveGroup(context);
    const user = await getRequestUser();
    requirePermission(user, "system_admin.access");
    const actor = requirePermission(user, managePermissionByGroup[group]);
    const result = await publishSettingsGroup({ group, value: await request.json(), actorId: actor.id });
    return successResponse({ group, ...result });
  } catch (error) {
    logger.error("api.system_settings.group_write_failed");
    return errorResponse(error);
  }
}
