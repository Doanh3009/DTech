import { z } from "zod";

import { getProjectRoster } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ date: z.string().date(), worksiteId: z.string().uuid().optional() });
export async function GET(request: Request, context: RouteContext<"/api/v1/projects/[id]/roster">) {
  try { const user = requirePermission(await getRequestUser(), "project.view"); const { id } = parseWithSchema(paramsSchema, await context.params); const query = parseWithSchema(querySchema, Object.fromEntries(new URL(request.url).searchParams)); return successResponse(await getProjectRoster(id, query.date, query.worksiteId, user)); }
  catch (error) { return errorResponse(error); }
}
