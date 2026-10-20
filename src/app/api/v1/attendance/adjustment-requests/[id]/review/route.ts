import { attendanceAdjustmentReviewSchema } from "@/features/attendance/schemas/adjustmentRequestSchemas";
import { reviewAdjustmentRequest } from "@/features/attendance/services/adjustmentRequestService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const { id } = await params;
    return successResponse(await reviewAdjustmentRequest(user, id, await parseJsonBody(request, attendanceAdjustmentReviewSchema)));
  } catch (error) {
    return errorResponse(error);
  }
}
