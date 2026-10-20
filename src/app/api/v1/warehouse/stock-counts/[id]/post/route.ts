import { z } from "zod";
import { postStockCount } from "@/features/warehouse/services/warehouseRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({ rowVersion: z.number().int().positive().optional(), postingDate: z.string().date(), idempotencyKey: z.string().uuid() });

export async function POST(request: Request, context: RouteContext<"/api/v1/warehouse/stock-counts/[id]/post">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await postStockCount(user, id, await parseJsonBody(request, inputSchema)));
  } catch (error) { return errorResponse(error); }
}
