import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { archiveEmployeeSchema } from "@/features/employees/schemas/employeeSchemas";
import { archiveEmployee } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "employee.archive");
    const { id } = await params;
    const input = parseWithSchema(archiveEmployeeSchema, await request.json());
    await archiveEmployee(id, user.id, input.reason);

    await recordAuditLog({
      actorId: user.id,
      action: "employee.archived",
      entityType: "employee",
      entityId: id,
      after: { profileStatus: "archived" },
      reason: input.reason
    });

    return successResponse({ employeeId: id, profileStatus: "archived" });
  } catch (error) {
    logger.error("api.employees.archive_failed");
    return errorResponse(error);
  }
}
