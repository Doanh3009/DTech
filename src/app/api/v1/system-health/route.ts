import { detailedSystemHealth } from "@/features/operations/services/systemHealthService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";
export async function GET(){try{requirePermission(await getRequestUser(),"operations.view");return successResponse(await detailedSystemHealth());}catch(error){return errorResponse(error);}}
