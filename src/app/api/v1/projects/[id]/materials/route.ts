import { z } from "zod";
import { getProjectMaterials } from "@/features/projects/services/projectMaterials";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ worksiteId: z.string().uuid().optional() });
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const { worksiteId } = parseWithSchema(querySchema, Object.fromEntries(new URL(request.url).searchParams));
    return successResponse(await getProjectMaterials(requireAuthenticatedUser(await getRequestUser()), id, worksiteId));
  } catch (error) { return errorResponse(error); }
}
