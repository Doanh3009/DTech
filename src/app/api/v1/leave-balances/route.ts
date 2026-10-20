import { getMyLeaveBalances, listAllLeaveBalances } from "@/features/leave/services/leaveRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(request:Request){try{const user=requireAuthenticatedUser(await getRequestUser());const query=new URL(request.url).searchParams;const year=Number(query.get("year")??new Date().getFullYear());return successResponse(query.get("scope")==="all"?await listAllLeaveBalances(user,year):await getMyLeaveBalances(user,year));}catch(error){return errorResponse(error);}}
