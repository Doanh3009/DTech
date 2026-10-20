import { z } from "zod";
import { salaryDeleteSchema } from "@/features/accounting/schemas";
import { deleteSalary } from "@/features/accounting/service";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await deleteSalary(user, id, await parseJsonBody(request, salaryDeleteSchema)));
  } catch (error) {
    return errorResponse(error);
  }
}
