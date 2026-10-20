import { getReportExport } from "@/features/timesheets/services/reportRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return successResponse(await getReportExport(
      requireAuthenticatedUser(await getRequestUser()),
      (await params).id
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
