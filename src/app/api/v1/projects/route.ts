import { projectInputSchema } from "@/features/projects/schemas/projectSchemas";
import { createProject, listProjects } from "@/features/projects/services/projectRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

export async function GET() {
  try { const user = requirePermission(await getRequestUser(), "project.view"); return successResponse(await listProjects(user)); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try { const user = requirePermission(await getRequestUser(), "project.create"); return successResponse(await createProject(user, await parseJsonBody(request, projectInputSchema)), { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
