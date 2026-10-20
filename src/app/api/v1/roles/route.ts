import { z } from "zod";

import type { Permission } from "@/lib/auth/permissions";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { getPermissionGroups } from "@/services/authorization/rbacService";
import { createPersistedRole, listPersistedPermissionKeys, listPersistedRoles } from "@/services/authorization/rolePersistenceService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const permissionKeySchema = z.string().trim().min(1).max(160).transform((value) => value as Permission);

function roleCodeFromName(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("đ", "d").replaceAll("Đ", "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return normalized.length >= 2 ? normalized : `vai_tro_${crypto.randomUUID().slice(0, 8)}`;
}

const roleCreateSchema = z.object({
  code: z.string().trim().min(2).max(60).optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  permissionKeys: z.array(permissionKeySchema).min(1)
});

export async function GET() {
  try {
    const user = await getRequestUser();
    requirePermission(user, "role.view");
    const [roles, persistedPermissionKeys] = await Promise.all([listPersistedRoles(), listPersistedPermissionKeys()]);
    return successResponse({
      roles,
      permissionGroups: getPermissionGroups().map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) => persistedPermissionKeys.has(permission.key))
      })).filter((group) => group.permissions.length > 0)
    });
  } catch (error) {
    logger.error("api.roles.list_failed");
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser();
    const authorizedUser = requirePermission(user, "role.manage");
    const input = parseWithSchema(roleCreateSchema, await request.json());
    const role = await createPersistedRole({ ...input, code: input.code ?? roleCodeFromName(input.name) }, authorizedUser.id);

    return successResponse({ role }, { status: 201 });
  } catch (error) {
    logger.error("api.roles.create_failed");
    return errorResponse(error);
  }
}
