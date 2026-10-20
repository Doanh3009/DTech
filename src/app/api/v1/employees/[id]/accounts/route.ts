import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { provisionAccountSchema } from "@/features/employees/schemas/employeeSchemas";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { provisionAccount } from "@/features/employees/services/employeeMutationService";
import { findAccountForEmployee, toEmployeeAccountView } from "@/features/employees/services/employeeService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { normalizeEmployeeAccountRoles } from "@/services/authorization/employeeAccountRoleService";
import { listPersistedRoles } from "@/services/authorization/rolePersistenceService";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function POST(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getRequestUser();
    const authorizedUser = requirePermission(user, "account.create");
    const { id } = await params;
    const input = parseWithSchema(provisionAccountSchema, await request.json());
    input.roleIds = await normalizeEmployeeAccountRoles(input.roleIds);
    const provisioned = await provisionAccount(id, input, authorizedUser.id);
    const [dataSet, roles] = await Promise.all([getEmployeeDataSetAsync(), listPersistedRoles()]);
    const account = findAccountForEmployee(id, dataSet);
    if (!account) throw new Error("Provisioned account could not be reloaded");

    await recordAuditLog({
      actorId: authorizedUser.id,
      action: "account.provisioned",
      entityType: "account",
      entityId: provisioned.accountId,
      after: { employeeId: id, status: account.status, roleIds: account.roleIds }
    });

    return successResponse(
      {
        account: toEmployeeAccountView(account, roles),
        temporaryPassword: provisioned.temporaryPassword
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("api.employees.account_provision_failed");
    return errorResponse(error);
  }
}
