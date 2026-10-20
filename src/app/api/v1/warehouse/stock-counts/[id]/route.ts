import { z } from "zod";
import { cancelWarehouseRecordSchema, stockCountUpdateSchema } from "@/features/warehouse/schemas/warehouseSchemas";
import { cancelWarehouseRecord, getStockCount, updateStockCount } from "@/features/warehouse/services/warehouseRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext<"/api/v1/warehouse/stock-counts/[id]">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await getStockCount(requireAuthenticatedUser(await getRequestUser()), id));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext<"/api/v1/warehouse/stock-counts/[id]">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = await parseJsonBody(request, z.union([cancelWarehouseRecordSchema, stockCountUpdateSchema]));
    return successResponse(await ("action" in input ? cancelWarehouseRecord(user, id, "stock_count", input) : updateStockCount(user, id, input)));
  } catch (error) { return errorResponse(error); }
}
