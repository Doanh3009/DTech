import { createWorkerSessionSchema } from "@/features/worker-attendance/schemas/workerAttendanceSchemas";
import { createWorkerSession, listWorkerSessions } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(request: Request) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const params = new URL(request.url).searchParams; return successResponse(await listWorkerSessions(user, { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined, projectId: params.get("projectId") ?? undefined, status: params.get("status") ?? undefined })); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); return successResponse(await createWorkerSession(user, await parseJsonBody(request, createWorkerSessionSchema)), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
