import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getAttendanceDashboard } from "@/features/attendance/services/attendanceRepository";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "attendance.self.view") && !can(user.permissions, "attendance.self.create") && !can(user.permissions, "attendance.self")) {
      throw new AppError("PERMISSION_DENIED");
    }
    return successResponse(await getAttendanceDashboard(user));
  } catch (error) {
    return errorResponse(error);
  }
}
