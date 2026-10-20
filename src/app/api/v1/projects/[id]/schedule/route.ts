import { z } from "zod";

import { getProjectSchedule } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ from: z.string().date(), to: z.string().date() });
export async function GET(request: Request, context: RouteContext<"/api/v1/projects/[id]/schedule">) {
  try { const user = requirePermission(await getRequestUser(), "project.view"); const { id } = parseWithSchema(paramsSchema, await context.params); const query = parseWithSchema(querySchema, Object.fromEntries(new URL(request.url).searchParams)); return successResponse(await getProjectSchedule(id, query.from, query.to, user)); }
  catch (error) { return errorResponse(error); }
}
