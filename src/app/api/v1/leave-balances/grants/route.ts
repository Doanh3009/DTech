import { leaveGrantSchema } from "@/features/leave/schemas/leaveSchemas";
import { postLeaveGrant } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function POST(request:Request){try{const user=requireAuthenticatedUser(await getRequestUser());return successResponse(await postLeaveGrant(user,await parseJsonBody(request,leaveGrantSchema)));}catch(error){return errorResponse(error);}}
