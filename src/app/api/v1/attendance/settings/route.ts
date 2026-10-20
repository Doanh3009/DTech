import { attendancePolicyPatchSchema } from "@/features/attendance/schemas/attendanceSchemas";
import { getAttendanceConfiguration, updateAttendancePolicy } from "@/features/attendance/services/attendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await getAttendanceConfiguration(user));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = await parseJsonBody(request, attendancePolicyPatchSchema);
    return successResponse(await updateAttendancePolicy(user, input));
  } catch (error) {
    return errorResponse(error);
  }
}
