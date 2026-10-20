import { departmentInputSchema } from "@/features/employees/schemas/employeeSchemas";
import { createDepartment, getOrganizationCatalog } from "@/features/employees/services/organizationService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    const catalog = await getOrganizationCatalog(requireAuthenticatedUser(await getRequestUser()));
    return successResponse(catalog);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return successResponse(await createDepartment(
      requireAuthenticatedUser(await getRequestUser()),
      await parseJsonBody(request, departmentInputSchema)
    ), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
