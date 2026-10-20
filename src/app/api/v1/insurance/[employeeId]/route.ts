import { z } from "zod";
import { getInsuranceDetail } from "@/features/insurance/service";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(_request: Request, context: { params: Promise<{ employeeId: string }> }) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const employeeId = parseWithSchema(z.string().uuid(), (await context.params).employeeId);
    return successResponse(await getInsuranceDetail(user, employeeId), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
