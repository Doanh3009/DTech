import { appConfig } from "@/config/app";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { isSupabaseConfigured } from "@/lib/env";
import { nowServerReceivedAt } from "@/lib/time/timezone";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    const user = await getRequestUser();
    requirePermission(user, "dashboard.view");

    return successResponse({
      app: appConfig.name,
      version: "v1",
      status: "ok",
      timezone: appConfig.timezone,
      supabaseConfigured: isSupabaseConfigured(),
      receivedAtServer: nowServerReceivedAt()
    });
  } catch (error) {
    logger.error("api.health.failed");
    return errorResponse(error);
  }
}
