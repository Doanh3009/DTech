import { insuranceContributionInputSchema } from "@/features/insurance/schema";
import { saveInsuranceContribution } from "@/features/insurance/service";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function POST(request: Request) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const input = await parseJsonBody(request, insuranceContributionInputSchema);
    return successResponse(await saveInsuranceContribution(user, input), { status: 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
