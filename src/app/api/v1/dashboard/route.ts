import { z } from "zod";

import { dashboardProfileKeys, dashboardWidgetKeys } from "@/features/dashboard/registry";
import { getDashboardReadModel } from "@/features/dashboard/services/dashboardService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const querySchema = z.object({
  profile: z.enum(dashboardProfileKeys).optional(),
  widget: z.enum(dashboardWidgetKeys).optional(),
  scope: z.enum(["global"]).optional()
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = parseWithSchema(querySchema, {
      profile: url.searchParams.get("profile") || undefined,
      widget: url.searchParams.get("widget") || undefined,
      scope: url.searchParams.get("scope") || undefined
    });
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await getDashboardReadModel(user, input.profile, input.widget, input.scope));
  } catch (error) {
    return errorResponse(error);
  }
}
