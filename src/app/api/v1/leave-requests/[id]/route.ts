import { leaveRequestUpdateSchema } from "@/features/leave/schemas/leaveSchemas";
import { getLeaveRequest, updateLeaveRequest } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try { const user=requireAuthenticatedUser(await getRequestUser()); return successResponse(await getLeaveRequest(user,(await params).id,new URL(request.url).searchParams.get("scope")==="self"?"self":"all")); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  try { const user=requireAuthenticatedUser(await getRequestUser()); return successResponse(await updateLeaveRequest(user,(await params).id,await parseJsonBody(request,leaveRequestUpdateSchema))); }
  catch (error) { return errorResponse(error); }
}
