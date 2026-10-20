import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { deleteAccount } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "account.disable");
    const { id } = await params;
    const deleted = await deleteAccount(id, user.id);

    await recordAuditLog({
      actorId: user.id,
      action: "account.deleted",
      entityType: "account",
      entityId: id,
      before: {
        employeeId: deleted.employeeId,
        username: deleted.username,
        loginEmail: deleted.loginEmail
      }
    });

    return successResponse({ accountId: id });
  } catch (error) {
    logger.error("api.accounts.delete_failed");
    return errorResponse(error);
  }
}
