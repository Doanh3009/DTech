import { getAttendanceAdminToday } from "@/features/attendance/services/attendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date") ?? undefined;
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) {
      throw new AppError("VALIDATION_ERROR", "Ngày không hợp lệ.");
    }
    return successResponse(await getAttendanceAdminToday(requireAuthenticatedUser(await getRequestUser()), date));
  } catch (error) {
    return errorResponse(error);
  }
}
