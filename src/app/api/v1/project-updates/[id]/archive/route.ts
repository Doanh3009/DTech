import { z } from "zod";
import { archiveProjectUpdate } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() }); const bodySchema = z.object({ reason: z.string().trim().min(3).max(500) });
export async function POST(request: Request, context: RouteContext<"/api/v1/project-updates/[id]/archive">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const { reason } = await parseJsonBody(request, bodySchema); await archiveProjectUpdate(user, id, reason); return successResponse({ archived: true }); } catch (error) { return errorResponse(error); } }
