import { cashoutRateSchema, getLeaveSettlements, saveLeaveCashoutRate } from "@/features/leave/services/leaveSettlementService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
export async function GET(request: Request) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); return successResponse(await getLeaveSettlements(user, Number(new URL(request.url).searchParams.get("year")))); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); return successResponse(await saveLeaveCashoutRate(user, await parseJsonBody(request, cashoutRateSchema))); }
  catch (error) { return errorResponse(error); }
}
