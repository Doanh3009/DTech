import { z } from "zod";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { recoverAccountOperation } from "@/features/employees/services/accountLifecycleService";
import { accountRecoverySchema } from "@/features/employees/schemas/employeeSchemas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "account.create") && !can(user.permissions, "account.delete")) throw new AppError("PERMISSION_DENIED");
    const { id } = await params;
    parseWithSchema(z.string().uuid(), id);
    const input = await parseJsonBody(request, accountRecoverySchema);
    return successResponse(await recoverAccountOperation(id, user.id, input.action, input.password), { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
