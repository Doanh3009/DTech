import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { provisionAccountSchema } from "@/features/employees/schemas/employeeSchemas";
import { provisionAccount } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { normalizeEmployeeAccountRoles } from "@/services/authorization/employeeAccountRoleService";

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
    parseWithSchema(z.string().uuid(), id);
    const input = await parseJsonBody(request, provisionAccountSchema);
    input.roleIds = await normalizeEmployeeAccountRoles(input.roleIds);
    const provisioned = await provisionAccount(id, input, authorizedUser.id);
    return successResponse(provisioned, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.employees.account_provision_failed");
    return errorResponse(error);
  }
}
