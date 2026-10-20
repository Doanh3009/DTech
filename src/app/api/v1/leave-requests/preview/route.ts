import { leaveRequestInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { previewLeaveRequest } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function POST(request:Request){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await previewLeaveRequest(user,await parseJsonBody(request,leaveRequestInputSchema)));}catch(error){return errorResponse(error);}}
