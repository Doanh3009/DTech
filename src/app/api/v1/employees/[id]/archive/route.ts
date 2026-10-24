import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { archiveEmployeeSchema } from "@/features/employees/schemas/employeeSchemas";
import { archiveEmployee } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "employee.archive");
    const { id } = await params;
    parseWithSchema(z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."), id);
    const input = await parseJsonBody(request, archiveEmployeeSchema);
    const rowVersion = await archiveEmployee(id, input, user.id);
    return successResponse({ employeeId: id, profileStatus: "archived", rowVersion }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.employees.archive_failed");
    return errorResponse(error);
  }
}
