import { z } from "zod";

import { projectProgressInputSchema } from "@/features/projects/schemas/projectSchemas";
import { listProjectProgress, saveProjectProgress } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext<"/api/v1/projects/[id]/progress">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await listProjectProgress(user, id)); }
  catch (error) { return errorResponse(error); }
}

async function save(request: Request, context: RouteContext<"/api/v1/projects/[id]/progress">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await saveProjectProgress(user, id, await parseJsonBody(request, projectProgressInputSchema))); }
  catch (error) { return errorResponse(error); }
}

export const POST = save;
export const PATCH = save;
