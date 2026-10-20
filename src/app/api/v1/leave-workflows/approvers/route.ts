import { listLeaveWorkflowApprovers } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await listLeaveWorkflowApprovers(user));
  } catch (error) { return errorResponse(error); }
}
