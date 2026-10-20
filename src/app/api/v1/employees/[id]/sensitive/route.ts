import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { sensitiveProfilePatchSchema } from "@/features/employees/schemas/employeeSchemas";
import { updateSensitiveProfile } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { recordAuditLog } from "@/services/audit/auditLog";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requirePermission(await getRequestUser(), "employee.edit_sensitive");
    const { id } = await params;
    const input = parseWithSchema(sensitiveProfilePatchSchema, await request.json());
    const updatedAt = await updateSensitiveProfile(id, input, user.id);

    await recordAuditLog({
      actorId: user.id,
      action: "employee.sensitive_updated",
      entityType: "employee",
      entityId: id,
      after: { fields: Object.keys(input).filter(key => key !== "reason") },
      reason: input.reason
    });

    return successResponse({ updatedAt });
  } catch (error) {
    logger.error("api.employees.sensitive_patch_failed");
    return errorResponse(error);
  }
}
