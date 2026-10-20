import { leaveRequestFiltersSchema, leaveRequestInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { createLeaveRequest, listLeaveRequests } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const query = new URL(request.url).searchParams;
    const value = query.get("scope");
    const scope = value === "all" || value === "approval" || value === "team" ? value : "self";
    const filters = leaveRequestFiltersSchema.parse(Object.fromEntries(["startDate", "endDate", "employeeId", "leaveTypeId", "status"].flatMap(key => query.has(key) ? [[key, query.get(key)]] : [])));
    return successResponse(await listLeaveRequests(user, scope, filters));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await createLeaveRequest(user, await parseJsonBody(request, leaveRequestInputSchema)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
