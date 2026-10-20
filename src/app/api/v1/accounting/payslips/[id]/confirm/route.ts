import { z } from "zod";
import { confirmPayslip } from "@/features/accounting/service";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody, parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({ version: z.number().int().positive() }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    const { version } = await parseJsonBody(request, inputSchema);
    return successResponse(await confirmPayslip(user, id, version));
  } catch (error) {
    return errorResponse(error);
  }
}
