import { z } from "zod";

import { employeeContractUpdateSchema } from "@/features/employees/schemas/employeeSchemas";
import { archiveContract, replaceContractFile, updateContract } from "@/features/employees/services/contractService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid(), contractId: z.string().uuid() });
const archiveSchema = z.object({ reason: z.string().trim().min(3).max(500), rowVersion: z.number().int().positive() });
function fields(form: FormData) { return { contractNumber: form.get("contractNumber"), contractType: form.get("contractType"), signedDate: form.get("signedDate") || undefined, effectiveDate: form.get("effectiveDate"), endDate: form.get("endDate") || undefined, status: form.get("status") || "draft", note: form.get("note") || undefined, rowVersion: form.get("rowVersion") }; }

export async function PATCH(request: Request, context: RouteContext<"/api/v1/employees/[id]/contracts/[contractId]">) {
  try {
    const { id, contractId } = parseWithSchema(paramsSchema, await context.params), form = await request.formData();
    const user = requireAuthenticatedUser(await getRequestUser()), candidate = form.get("file"), file = candidate instanceof File && candidate.size ? candidate : undefined;
    if (form.get("fileOnly") === "true") {
      const rowVersion = parseWithSchema(z.coerce.number().int().positive(), form.get("rowVersion"));
      return successResponse(await replaceContractFile(user, id, contractId, rowVersion, file));
    }
    const input = parseWithSchema(employeeContractUpdateSchema, fields(form));
    return successResponse(await updateContract(user, id, contractId, input, file));
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: RouteContext<"/api/v1/employees/[id]/contracts/[contractId]">) {
  try { const { id, contractId } = parseWithSchema(paramsSchema, await context.params), { reason, rowVersion } = await parseJsonBody(request, archiveSchema); return successResponse(await archiveContract(requireAuthenticatedUser(await getRequestUser()), id, contractId, reason, rowVersion)); }
  catch (error) { return errorResponse(error); }
}
