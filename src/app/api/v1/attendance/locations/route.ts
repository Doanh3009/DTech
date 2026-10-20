import { attendanceLocationInputSchema } from "@/features/attendance/schemas/attendanceSchemas";
import { saveAttendanceLocation } from "@/features/attendance/services/attendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await saveAttendanceLocation(user, await parseJsonBody(request, attendanceLocationInputSchema)), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
