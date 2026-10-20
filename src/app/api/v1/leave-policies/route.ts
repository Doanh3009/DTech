import { leavePolicyInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { getLeavePolicy, updateLeavePolicy } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(){try{requireAuthenticatedUser(await getRequestUser());return successResponse(await getLeavePolicy());}catch(error){return errorResponse(error);}}
export async function PATCH(request:Request){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await updateLeavePolicy(user,await parseJsonBody(request,leavePolicyInputSchema)));}catch(error){return errorResponse(error);}}
