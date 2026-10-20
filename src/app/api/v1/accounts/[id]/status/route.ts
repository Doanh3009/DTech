import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { accountStatusPatchSchema } from "@/features/employees/schemas/employeeSchemas";
import { setAccountStatus } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

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
    const input = parseWithSchema(accountStatusPatchSchema, await request.json());
    const requiredPermission = input.status === "active" ? "account.enable" : "account.disable";
    const authorizedUser = requirePermission(user, requiredPermission);
    const { id } = await params;
    const account = await setAccountStatus(id, input, authorizedUser.id);

    await recordAuditLog({
      actorId: authorizedUser.id,
      action: input.status === "disabled" ? "account.disabled" : "account.status_updated",
      entityType: "account",
      entityId: id,
      after: { status: input.status },
      reason: input.reason
    });

    return successResponse({
      account
    });
  } catch (error) {
    logger.error("api.accounts.status_failed");
    return errorResponse(error);
  }
}
