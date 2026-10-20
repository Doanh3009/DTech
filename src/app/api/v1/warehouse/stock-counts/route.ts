import { stockCountSchema } from "@/features/warehouse/schemas/warehouseSchemas";
import { createStockCount, listStockCounts } from "@/features/warehouse/services/warehouseRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try { return successResponse(await listStockCounts(requireAuthenticatedUser(await getRequestUser()))); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await createStockCount(user, await parseJsonBody(request, stockCountSchema)), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
