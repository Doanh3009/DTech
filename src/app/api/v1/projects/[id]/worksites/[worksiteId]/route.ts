import { z } from "zod";
import { worksiteInputSchema } from "@/features/projects/schemas/projectSchemas";
import { updateWorksite } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid(), worksiteId: z.string().uuid() });
const inputSchema = z.intersection(worksiteInputSchema, z.object({ updatedAt: z.string().datetime({ offset: true }), status: z.enum(["active", "inactive", "closed"]) }));
export async function PATCH(request: Request, context: { params: Promise<{ id: string; worksiteId: string }> }) {
  try {
    const user = requirePermission(await getRequestUser(), "worksite.manage"), { id, worksiteId } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await updateWorksite(user, id, worksiteId, await parseJsonBody(request, inputSchema)));
  } catch (error) { return errorResponse(error); }
}
