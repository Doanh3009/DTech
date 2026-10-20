import { attendanceAdjustmentRequestSchema } from "@/features/attendance/schemas/adjustmentRequestSchemas";
import { createAdjustmentRequest, listAdjustmentRequests } from "@/features/attendance/services/adjustmentRequestService";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope") ?? "self";
    if (scope !== "self" && scope !== "all") throw new AppError("VALIDATION_ERROR", "Phạm vi không hợp lệ.");
    return successResponse(await listAdjustmentRequests(requireAuthenticatedUser(await getRequestUser()), scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = await parseJsonBody(request, attendanceAdjustmentRequestSchema);
    return successResponse(await createAdjustmentRequest(user, input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
