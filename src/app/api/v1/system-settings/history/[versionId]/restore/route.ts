import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { restoreSettingsVersion } from "@/services/system-settings/systemSettingsService";

export async function POST(
  _request: Request,
  context: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await context.params;
    const user = await getRequestUser();
    requirePermission(user, "system_admin.access");
    const actor = requirePermission(user, "config_history.restore");
    return successResponse({ restored: await restoreSettingsVersion(versionId, actor.id) });
  } catch (error) {
    logger.error("api.system_settings.restore_failed");
    return errorResponse(error);
  }
}
