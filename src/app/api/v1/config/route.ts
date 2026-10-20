import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { getConfiguration } from "@/services/configuration/configurationService";

const configurationReadSchema = z.object({
  key: z.string().min(1)
});

export async function GET(request: Request) {
  try {
    const user = await getRequestUser();
    requirePermission(user, "settings.view");

    const url = new URL(request.url);
    const input = parseWithSchema(configurationReadSchema, {
      key: url.searchParams.get("key")
    });
    const configuration = await getConfiguration(input.key);

    return successResponse({ configuration });
  } catch (error) {
    logger.error("api.config.read_failed");
    return errorResponse(error);
  }
}
