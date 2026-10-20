import { z } from "zod";
import { workerSessionSubmitSchema } from "@/features/worker-attendance/schemas/workerAttendanceSchemas";
import { submitWorkerSession } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function POST(request: Request, context: RouteContext<"/api/v1/worker-attendance/sessions/[id]/submit">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const input = await parseJsonBody(request, workerSessionSubmitSchema); return successResponse(await submitWorkerSession(user, id, input.version)); }
  catch (error) { return errorResponse(error); }
}
