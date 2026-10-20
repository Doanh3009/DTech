import { z } from "zod";

import { worksiteInputSchema } from "@/features/projects/schemas/projectSchemas";
import { createWorksite } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
export async function POST(request: Request, context: RouteContext<"/api/v1/projects/[id]/worksites">) {
  try { const user = requirePermission(await getRequestUser(), "worksite.manage"); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await createWorksite(user, id, await parseJsonBody(request, worksiteInputSchema)), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
