import { z } from "zod";

import { adjustAttendanceEvent, getAttendanceEvent } from "@/features/attendance/services/attendanceRepository";
import { attendanceAdjustmentSchema } from "@/features/attendance/schemas/attendanceSchemas";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext<"/api/v1/attendance/records/[id]">) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const { id } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await getAttendanceEvent(user, id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/v1/attendance/records/[id]">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await adjustAttendanceEvent(user, id, await parseJsonBody(request, attendanceAdjustmentSchema))); }
  catch (error) { return errorResponse(error); }
}
