import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { accountRolesPatchSchema } from "@/features/employees/schemas/employeeSchemas";
import { replaceAccountRoles } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { normalizeEmployeeAccountRoles } from "@/services/authorization/employeeAccountRoleService";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "account.assign_role");
    const { id } = await params;
    parseWithSchema(z.string().uuid(), id);
    const input = await parseJsonBody(request, accountRolesPatchSchema);
    input.roleIds = await normalizeEmployeeAccountRoles(input.roleIds);
    await replaceAccountRoles(id, input, user.id);
    return successResponse({ accountId: id, roleIds: input.roleIds }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.accounts.roles_failed");
    return errorResponse(error);
  }
}
