import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { deleteAccount } from "@/features/employees/services/employeeMutationService";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
import { z } from "zod";
import { accountDeletionSchema } from "@/features/employees/schemas/employeeSchemas";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requirePermission(await getRequestUser(), "account.delete");
    const { id } = await params;
    parseWithSchema(z.string().uuid(), id);
    const input = await parseJsonBody(request, accountDeletionSchema);
    return successResponse(await deleteAccount(id, input.requestId, user.id), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    logger.error("api.accounts.delete_failed");
    return errorResponse(error);
  }
}
