import { z } from "zod";
import { getWorkerSession } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function GET(_request: Request, context: RouteContext<"/api/v1/worker-attendance/sessions/[id]">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await getWorkerSession(user, id)); }
  catch (error) { return errorResponse(error); }
}
