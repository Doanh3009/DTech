import { getProjectMonitoring } from "@/features/projects/services/projectUpdateRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET() { try { return successResponse(await getProjectMonitoring(requireAuthenticatedUser(await getRequestUser()))); } catch (error) { return errorResponse(error); } }
