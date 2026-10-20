import { z } from "zod";
import { createPayslipDownload } from "@/features/accounting/service";
import { errorResponse } from "@/lib/api/errors";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  _request: Request,
  context: RouteContext<"/api/v1/accounting/payslips/[id]/download">
) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    const { bytes, fileName } = await createPayslipDownload(user, id);
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"
    } });
  } catch (error) {
    return errorResponse(error);
  }
}
