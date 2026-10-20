import { leaveTypeInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { updateLeaveType } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await updateLeaveType(user,(await params).id,await parseJsonBody(request,leaveTypeInputSchema)));}catch(error){return errorResponse(error);}}
