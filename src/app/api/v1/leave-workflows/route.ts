import { leaveWorkflowInputSchema } from "@/features/leave/schemas/leaveSchemas";
import { createLeaveWorkflow, listLeaveWorkflows } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await listLeaveWorkflows(user));}catch(error){return errorResponse(error);}}
export async function POST(request:Request){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await createLeaveWorkflow(user,await parseJsonBody(request,leaveWorkflowInputSchema)),{status:201});}catch(error){return errorResponse(error);}}
