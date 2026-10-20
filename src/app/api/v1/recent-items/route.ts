import { z } from "zod";

import { listRecentEntities, recordRecentEntity } from "@/features/search/services/recentEntityService";
import { searchEntityTypes } from "@/features/search/types";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const recentSchema = z.object({
  entityType: z.enum(searchEntityTypes),
  entityId: z.string().min(1).max(200),
  title: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().max(300).optional(),
  deepLink: z.string().startsWith("/").max(500).refine((value) => !value.startsWith("//"), "Liên kết không hợp lệ.")
}).strict();

export async function GET() {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse({ items: await listRecentEntities(user, 10) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = await parseJsonBody(request, recentSchema);
    await recordRecentEntity(user, input);
    return successResponse({ recorded: true });
  } catch (error) {
    return errorResponse(error);
  }
}
