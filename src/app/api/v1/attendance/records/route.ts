import { attendanceRecordFiltersSchema } from "@/features/attendance/schemas/attendanceSchemas";
import { listAttendanceRecords } from "@/features/attendance/services/attendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const filters = parseWithSchema(attendanceRecordFiltersSchema, Object.fromEntries(new URL(request.url).searchParams));
    return successResponse(await listAttendanceRecords(user, filters));
  } catch (error) {
    return errorResponse(error);
  }
}
