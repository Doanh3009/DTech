import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { listPendingAccountOperations } from "@/features/employees/services/accountLifecycleService";

export async function GET() {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "account.create") && !can(user.permissions, "account.delete")) throw new AppError("PERMISSION_DENIED");
    return successResponse({ operations: await listPendingAccountOperations(user.id) }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
