import { z } from "zod";
import { issueReopenSchema } from "@/features/projects/schemas/projectSchemas";
import { reopenProjectIssue } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function POST(request: Request, context: RouteContext<"/api/v1/project-issues/[id]/reopen">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); return successResponse(await reopenProjectIssue(user, id, await parseJsonBody(request, issueReopenSchema))); } catch (error) { return errorResponse(error); } }
