import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { z } from "zod";
import { can } from "@/lib/auth/permissions";
import { logger } from "@/lib/logger";
import { accountStatusPatchSchema } from "@/features/employees/schemas/employeeSchemas";
import { setAccountStatus } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser, requirePermission } from "@/services/authorization/requirePermission";

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "account.enable") && !can(user.permissions, "account.disable")) throw new AppError("PERMISSION_DENIED");
    const input = await parseJsonBody(request, accountStatusPatchSchema);
    const requiredPermission = input.status === "active" ? "account.enable" : "account.disable";
    const authorizedUser = requirePermission(user, requiredPermission);
    const { id } = await params;
    parseWithSchema(z.string().uuid(), id);
    const account = await setAccountStatus(id, input, authorizedUser.id);
    if (!account || account.id !== id || account.status !== input.status) throw new AppError("NETWORK_ERROR");
    return successResponse({ accountId: id, status: input.status }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.accounts.status_failed");
    return errorResponse(error);
  }
}
