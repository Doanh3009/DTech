import { z } from "zod";
import { listProjectIssues } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function GET(request: Request, context: RouteContext<"/api/v1/projects/[id]/issues">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const query = new URL(request.url).searchParams; return successResponse(await listProjectIssues(user, { projectId: id, status: query.get("status") ?? undefined, severity: query.get("severity") ?? undefined })); } catch (error) { return errorResponse(error); } }
