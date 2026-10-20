import { z } from "zod";
import { uploadMessageAttachment } from "@/features/messaging/service";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid(), messageId: z.string().uuid() });

export async function POST(
  request: Request,
  context: RouteContext<"/api/v1/chat/conversations/[id]/messages/[messageId]/attachments">
) {
  try {
    const { id, messageId } = parseWithSchema(paramsSchema, await context.params);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Vui lòng chọn tệp đính kèm.");
    const user = requireAuthenticatedUser(await getRequestUser());
    return successResponse(await uploadMessageAttachment(user, id, messageId, file), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
