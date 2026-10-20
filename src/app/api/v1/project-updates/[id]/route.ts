import { z } from "zod";
import { projectUpdatePatchSchema } from "@/features/projects/schemas/projectSchemas";
import { editProjectUpdate, getProjectUpdate } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function GET(_request: Request, context: RouteContext<"/api/v1/project-updates/[id]">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await getProjectUpdate(user, id)); } catch (error) { return errorResponse(error); } }
export async function PATCH(request: Request, context: RouteContext<"/api/v1/project-updates/[id]">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await editProjectUpdate(user, id, await parseJsonBody(request, projectUpdatePatchSchema))); } catch (error) { return errorResponse(error); } }
