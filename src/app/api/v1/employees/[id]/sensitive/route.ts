import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { sensitiveProfilePatchSchema } from "@/features/employees/schemas/employeeSchemas";
import { updateSensitiveProfile } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requirePermission(await getRequestUser(), "employee.edit_sensitive");
    const { id } = await params;
    parseWithSchema(z.string().uuid("Mã hồ sơ nhân sự không hợp lệ."), id);
    const input = await parseJsonBody(request, sensitiveProfilePatchSchema);
    const rowVersion = await updateSensitiveProfile(id, input, user.id);
    return successResponse({ employeeId: id, rowVersion }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.employees.sensitive_patch_failed");
    return errorResponse(error);
  }
}
