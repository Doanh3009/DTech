import { z } from "zod";
import { workerSessionDraftSchema } from "@/features/worker-attendance/schemas/workerAttendanceSchemas";
import { saveWorkerSessionDraft } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function PATCH(request: Request, context: RouteContext<"/api/v1/worker-attendance/sessions/[id]/draft">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await saveWorkerSessionDraft(user, id, await parseJsonBody(request, workerSessionDraftSchema))); }
  catch (error) { return errorResponse(error); }
}
