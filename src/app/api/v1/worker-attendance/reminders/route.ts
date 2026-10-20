import { workerAttendanceReminderSchema } from "@/features/worker-attendance/schemas/workerAttendanceSchemas";
import { remindWorkerAttendanceSupervisor } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await remindWorkerAttendanceSupervisor(user, await parseJsonBody(request, workerAttendanceReminderSchema)));
  } catch (error) {
    return errorResponse(error);
  }
}
