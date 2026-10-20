import { z } from "zod";
import { payslipRevokeSchema } from "@/features/accounting/schemas";
import { getPayslip, revokePayslip } from "@/features/accounting/service";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  context: RouteContext<"/api/v1/accounting/payslips/[id]">
) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    const scope = new URL(request.url).searchParams.get("scope") === "self" ? "self" : "all";
    return successResponse(await getPayslip(user, id, scope));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/v1/accounting/payslips/[id]">
) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const input = await parseJsonBody(request, payslipRevokeSchema);
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await revokePayslip(user, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
