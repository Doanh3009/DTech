import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { patchEmployeeSchema } from "@/features/employees/schemas/employeeSchemas";
import { getEmployeeDetail } from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { patchEmployee } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getRequestUser();
    const authorizedUser = requirePermission(user, "employee.view");
    const { id } = await params;
    const detail = getEmployeeDetail(id, authorizedUser.permissions, await getEmployeeDataSetAsync());

    if (!detail) {
      throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
    }

    return successResponse({ employee: detail });
  } catch (error) {
    logger.error("api.employees.detail_failed");
    return errorResponse(error);
  }
}

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
    const input = parseWithSchema(patchEmployeeSchema, await request.json());
    const requiredPermission = input.employmentStatus === "terminated" ? "employee.offboard" : "employee.edit";
    const authorizedUser = requirePermission(user, requiredPermission);
    const { id } = await params;

    const rowVersion = await patchEmployee(id, input, authorizedUser.id);
    const detail = getEmployeeDetail(id, authorizedUser.permissions, await getEmployeeDataSetAsync());

    await recordAuditLog({
      actorId: authorizedUser.id,
      action: input.employmentStatus === "terminated" ? "employee.offboarded" : "employee.updated",
      entityType: "employee",
      entityId: id,
      before: { rowVersion: input.rowVersion },
      after: { rowVersion },
      reason: input.reason ?? input.terminationReason
    });

    return successResponse({
      employee: detail,
      historyEvents: []
    });
  } catch (error) {
    logger.error("api.employees.patch_failed");
    return errorResponse(error);
  }
}
