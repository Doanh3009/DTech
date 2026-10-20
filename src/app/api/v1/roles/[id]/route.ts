import { z } from "zod";

import type { Permission } from "@/lib/auth/permissions";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { updatePersistedRole } from "@/services/authorization/rolePersistenceService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const permissionKeySchema = z.string().trim().min(1).max(160).transform((value) => value as Permission);

const rolePatchSchema = z.object({
  code: z.string().trim().min(2).max(60).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  permissionKeys: z.array(permissionKeySchema).min(1).optional()
});

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getRequestUser();
    const authorizedUser = requirePermission(user, "role.manage");
    const { id } = await params;
    const input = parseWithSchema(rolePatchSchema, await request.json());
    const role = await updatePersistedRole(id, input, authorizedUser.id);

    return successResponse({ role });
  } catch (error) {
    logger.error("api.roles.patch_failed");
    return errorResponse(error);
  }
}
