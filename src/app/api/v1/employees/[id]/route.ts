import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { z } from "zod";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { employeeLifecyclePatchKeys, patchEmployeeSchema } from "@/features/employees/schemas/employeeSchemas";
import { getEmployeeDetail } from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { patchEmployee } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser, requirePermission } from "@/services/authorization/requirePermission";
import { can } from "@/lib/auth/permissions";

const employeeIdSchema = z.string().uuid("Mã hồ sơ nhân sự không hợp lệ.");

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
    const authorizedUser = requireAuthenticatedUser(await getRequestUser());
    if (!can(authorizedUser.permissions, "employee.edit") && !can(authorizedUser.permissions, "employee.offboard")) {
      throw new AppError("PERMISSION_DENIED");
    }
    const { id } = await params;
    parseWithSchema(employeeIdSchema, id);
    const input = await parseJsonBody(request, patchEmployeeSchema);
    const fields = Object.entries(input).filter(([key, value]) => key !== "rowVersion" && key !== "reason" && value !== undefined);
    const changesTermination = input.employmentStatus === "terminated" || input.terminationDate !== undefined || input.terminationReason !== undefined;
    const changesProfile = fields.some(([key]) => !(employeeLifecyclePatchKeys as readonly string[]).includes(key))
      || (input.employmentStatus !== undefined && input.employmentStatus !== "terminated");
    if (changesTermination) requirePermission(authorizedUser, "employee.offboard");
    if (changesProfile) requirePermission(authorizedUser, "employee.edit");

    const rowVersion = await patchEmployee(id, input, authorizedUser.id);
    return successResponse({ employeeId: id, rowVersion }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.employees.patch_failed");
    return errorResponse(error);
  }
}
