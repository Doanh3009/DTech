import { z } from "zod";
import { departmentInputSchema } from "@/features/employees/schemas/employeeSchemas";
import { updateDepartment } from "@/features/employees/services/organizationService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(request: Request, context: RouteContext<"/api/v1/hr/departments/[id]">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    return successResponse(await updateDepartment(
      requireAuthenticatedUser(await getRequestUser()), id,
      await parseJsonBody(request, departmentInputSchema)
    ));
  } catch (error) {
    return errorResponse(error);
  }
}
