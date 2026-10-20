import { listAttendanceHistory } from "@/features/attendance/services/attendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { can } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "attendance.self.view") && !can(user.permissions, "attendance.self")) throw new AppError("PERMISSION_DENIED");
    const url = new URL(request.url);
    return successResponse(await listAttendanceHistory(user, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined));
  } catch (error) {
    return errorResponse(error);
  }
}
