import { z } from "zod";
import { projectUpdateInputSchema, projectUpdateQuerySchema } from "@/features/projects/schemas/projectSchemas";
import { createProjectUpdate, listProjectUpdates } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
export async function GET(request: Request, context: RouteContext<"/api/v1/projects/[id]/updates">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const query = Object.fromEntries(new URL(request.url).searchParams); return successResponse(await listProjectUpdates(user, id, parseWithSchema(projectUpdateQuerySchema, query))); } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: RouteContext<"/api/v1/projects/[id]/updates">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await createProjectUpdate(user, id, await parseJsonBody(request, projectUpdateInputSchema)), { status: 201 }); } catch (error) { return errorResponse(error); }
}
