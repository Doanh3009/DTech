import { z } from "zod";

import { getProject } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
export async function GET(_request: Request, context: RouteContext<"/api/v1/projects/[id]">) {
  try { const user = requirePermission(await getRequestUser(), "project.view"); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await getProject(id, user)); }
  catch (error) { return errorResponse(error); }
}
