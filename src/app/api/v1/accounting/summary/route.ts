import { accountingSummary } from "@/features/accounting/service";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(){try{return successResponse(await accountingSummary(requireAuthenticatedUser(await getRequestUser())));}catch(error){return errorResponse(error);}}
