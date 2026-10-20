import { listProjectIssues } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(request: Request) { try { const user = requireAuthenticatedUser(await getRequestUser()); const query = new URL(request.url).searchParams; return successResponse(await listProjectIssues(user, { projectId: query.get("projectId") ?? undefined, status: query.get("status") ?? undefined, severity: query.get("severity") ?? undefined, ownerId: query.get("ownerId") ?? undefined })); } catch (error) { return errorResponse(error); } }
