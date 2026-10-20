import { z } from "zod";
import { setProjectUpdatePinned } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() }); const bodySchema = z.object({ pinned: z.boolean() });
export async function POST(request: Request, context: RouteContext<"/api/v1/project-updates/[id]/pin">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const { pinned } = await parseJsonBody(request, bodySchema); return successResponse(await setProjectUpdatePinned(user, id, pinned)); } catch (error) { return errorResponse(error); } }
