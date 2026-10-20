import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { readSystemSettings } from "@/services/system-settings/systemSettingsService";

export async function GET() {
  try {
    const user = await getRequestUser();
    requirePermission(user, "system_admin.access");
    return successResponse({ settings: await readSystemSettings() });
  } catch (error) {
    logger.error("api.system_settings.read_failed");
    return errorResponse(error);
  }
}
