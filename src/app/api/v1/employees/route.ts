import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import {
  createEmployeeSchema,
  employeeListQuerySchema
} from "@/features/employees/schemas/employeeSchemas";
import {
  buildEmployeeSummary,
  findEmployee,
  getEmployeeFilterOptions,
  listEmployees
} from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { getEmployeeListFromSupabase } from "@/features/employees/services/employeeSupabaseRepository";
import { createEmployee } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function GET(request: Request) {
  try {
    const user = await getRequestUser();
    const authorizedUser = requirePermission(user, "employee.view");
    const url = new URL(request.url);
    const query = parseWithSchema(employeeListQuerySchema, {
      q: url.searchParams.get("q"),
      departmentId: url.searchParams.get("departmentId"),
      positionId: url.searchParams.get("positionId"),
      employmentTypeId: url.searchParams.get("employmentTypeId"),
      status: url.searchParams.get("status"),
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined
    });
    const persisted = await getEmployeeListFromSupabase(query, authorizedUser.permissions);
    if (persisted) return successResponse(persisted);
    const dataSet = await getEmployeeDataSetAsync();
    return successResponse({
      employees: listEmployees(query, authorizedUser.permissions, dataSet),
      filterOptions: getEmployeeFilterOptions(dataSet)
    });
  } catch (error) {
    logger.error("api.employees.list_failed");
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser();
    const authorizedUser = requirePermission(user, "employee.create");
    const input = parseWithSchema(createEmployeeSchema, await request.json());
    const employeeId = await createEmployee(input, authorizedUser.id);
    const dataSet = await getEmployeeDataSetAsync();
    const employee = findEmployee(employeeId, dataSet);
    if (!employee) throw new Error("Created employee could not be reloaded");

    await recordAuditLog({
      actorId: authorizedUser.id,
      action: "employee.created",
      entityType: "employee",
      entityId: employee.id,
      after: {
        employeeCode: employee.employeeCode,
        departmentId: employee.departmentId,
        positionId: employee.positionId,
        employmentStatus: employee.employmentStatus
      }
    });

    return successResponse(
      {
        employee: buildEmployeeSummary(employee, dataSet),
        duplicateWarnings: []
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("api.employees.create_failed");
    return errorResponse(error);
  }
}
