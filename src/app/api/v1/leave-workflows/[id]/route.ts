import { leaveWorkflowInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { updateLeaveWorkflow } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await updateLeaveWorkflow(user,(await params).id,await parseJsonBody(request,leaveWorkflowInputSchema)));}catch(error){return errorResponse(error);}}
