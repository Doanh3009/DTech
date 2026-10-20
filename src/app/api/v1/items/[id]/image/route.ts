import { z } from "zod";

import { deleteItemImage, replaceItemImage } from "@/features/warehouse/services/warehouseRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, context: RouteContext<"/api/v1/items/[id]/image">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Thiếu ảnh hàng hóa.");
    return successResponse(await replaceItemImage(requireAuthenticatedUser(await getRequestUser()), id, file));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/v1/items/[id]/image">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await deleteItemImage(requireAuthenticatedUser(await getRequestUser()), id));
  } catch (error) {
    return errorResponse(error);
  }
}
