import { z } from "zod";

import { employeeContractInputSchema } from "@/features/employees/schemas/employeeSchemas";
import { createContract, listContracts } from "@/features/employees/services/contractService";
import { listContractTemplates } from "@/features/employees/services/contractTemplateService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
function fields(form: FormData) { return { contractNumber: form.get("contractNumber"), contractType: form.get("contractType"), signedDate: form.get("signedDate") || undefined, effectiveDate: form.get("effectiveDate"), endDate: form.get("endDate") || undefined, status: form.get("status") || "draft", note: form.get("note") || undefined }; }

export async function GET(_request: Request, context: RouteContext<"/api/v1/employees/[id]/contracts">) {
  try { const { id } = parseWithSchema(paramsSchema, await context.params),user=requireAuthenticatedUser(await getRequestUser()); return successResponse({ contracts: await listContracts(user, id),templates:await listContractTemplates(user) }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: RouteContext<"/api/v1/employees/[id]/contracts">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params), form = await request.formData();
    const input = parseWithSchema(employeeContractInputSchema, fields(form)), candidate = form.get("file"), file = candidate instanceof File && candidate.size ? candidate : undefined;
    const templateCandidate=String(form.get("templateId")??"").trim(),templateId=templateCandidate?parseWithSchema(z.string().uuid(),templateCandidate):undefined;
    return successResponse(await createContract(requireAuthenticatedUser(await getRequestUser()), id, input, file,templateId), { status: 201 });
  } catch (error) { return errorResponse(error); }
}
