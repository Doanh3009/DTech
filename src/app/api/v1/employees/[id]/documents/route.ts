import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import {
  findEmployee,
  getEmployeeDocuments
} from "@/features/employees/services/employeeService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

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
    const dataSet = await getEmployeeDataSetAsync();

    if (!findEmployee(id, dataSet)) {
      throw new AppError("NOT_FOUND", "Không tìm thấy hồ sơ nhân sự.");
    }

    return successResponse({
      documents: getEmployeeDocuments(id, authorizedUser.permissions, dataSet)
    });
  } catch (error) {
    logger.error("api.employees.documents_failed");
    return errorResponse(error);
  }
}
