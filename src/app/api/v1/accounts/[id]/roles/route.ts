import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { accountRolesPatchSchema } from "@/features/employees/schemas/employeeSchemas";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { replaceAccountRoles } from "@/features/employees/services/employeeMutationService";
import { toEmployeeAccountView } from "@/features/employees/services/employeeService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { normalizeEmployeeAccountRoles } from "@/services/authorization/employeeAccountRoleService";
import { listPersistedRoles } from "@/services/authorization/rolePersistenceService";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "account.assign_role");
    const { id } = await params;
    const input = parseWithSchema(accountRolesPatchSchema, await request.json());
    input.roleIds = await normalizeEmployeeAccountRoles(input.roleIds);
    await replaceAccountRoles(id, input, user.id);
    const [dataSet, roles] = await Promise.all([getEmployeeDataSetAsync(), listPersistedRoles()]);
    const account = dataSet.accounts.find((item) => item.id === id);
    if (!account) throw new Error("Updated account could not be reloaded");

    await recordAuditLog({
      actorId: user.id,
      action: "account.roles_updated",
      entityType: "account",
      entityId: id,
      after: { roleIds: input.roleIds }
    });

    return successResponse({ account: toEmployeeAccountView(account, roles) });
  } catch (error) {
    logger.error("api.accounts.roles_failed");
    return errorResponse(error);
  }
}
