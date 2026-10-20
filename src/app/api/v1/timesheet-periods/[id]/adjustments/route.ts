import { adjustmentInputSchema } from "@/features/timesheets/schemas/timesheetSchemas";
import { addAdjustment, listAdjustments } from "@/features/timesheets/services/timesheetRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url);
    return successResponse(await listAdjustments(
      requireAuthenticatedUser(await getRequestUser()),
      (await params).id,
      url.searchParams.get("employeeId") ?? undefined,
      url.searchParams.get("date") ?? undefined
    ));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return successResponse(await addAdjustment(
      requireAuthenticatedUser(await getRequestUser()),
      (await params).id,
      await parseJsonBody(request, adjustmentInputSchema)
    ), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
