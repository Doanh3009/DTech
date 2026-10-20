import { leaveDecisionSchema } from "@/features/leave/schemas/leaveSchemas";
import { decideLeaveRequest } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());const body=await parseJsonBody(request,leaveDecisionSchema);return successResponse(await decideLeaveRequest(user,(await params).id,"approve",body.comment,body.version));}catch(error){return errorResponse(error);}}
