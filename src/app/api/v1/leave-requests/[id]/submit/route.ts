import { leaveVersionSchema } from "@/features/leave/schemas/leaveSchemas";
import { submitLeaveRequest } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{const user=requireAuthenticatedUser(await getRequestUser());const body=await parseJsonBody(request,leaveVersionSchema);return successResponse(await submitLeaveRequest(user,(await params).id,body.version));}catch(error){return errorResponse(error);}}
