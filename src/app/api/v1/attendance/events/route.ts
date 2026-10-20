import { attendanceRecordInputSchema } from "@/features/attendance/schemas/attendanceSchemas";
import { recordAttendance } from "@/features/attendance/services/attendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { can } from "@/lib/auth/permissions";

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "attendance.self.create") && !can(user.permissions, "attendance.self")) throw new AppError("PERMISSION_DENIED");
    const input = await parseJsonBody(request, attendanceRecordInputSchema);
    return successResponse(await recordAttendance(user, input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
