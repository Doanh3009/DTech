import { z } from "zod";

import { closeWorkerDaySchema } from "@/features/worker-attendance/schemas/workerAttendanceSchemas";
import { closeWorkerSessionDay } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, context: RouteContext<"/api/v1/worker-attendance/sessions/[id]/close-day">) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const { id } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await closeWorkerSessionDay(user, id, await parseJsonBody(request, closeWorkerDaySchema)));
  } catch (error) { return errorResponse(error); }
}
