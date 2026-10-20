import { leaveTypeInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { createLeaveType, listLeaveTypes } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    requireAuthenticatedUser(await getRequestUser());
    return successResponse(await listLeaveTypes());
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await createLeaveType(user, await parseJsonBody(request, leaveTypeInputSchema)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
