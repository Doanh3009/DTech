import { listTransactionTypes } from "@/features/warehouse/services/warehouseRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(request:Request){try{return successResponse(await listTransactionTypes(requireAuthenticatedUser(await getRequestUser()),new URL(request.url).searchParams.get("type")??undefined));}catch(error){return errorResponse(error);}}
