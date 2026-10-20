import { z } from "zod";
import { positionInputSchema } from "@/features/employees/schemas/employeeSchemas";
import { updatePosition } from "@/features/employees/services/organizationService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request, context: RouteContext<"/api/v1/hr/positions/[id]">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await updatePosition(
      requireAuthenticatedUser(await getRequestUser()), id,
      await parseJsonBody(request, positionInputSchema)
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
