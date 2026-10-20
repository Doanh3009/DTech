import { z } from "zod";
import { uploadProjectUpdateAttachment } from "@/features/projects/services/projectUpdateRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function POST(request: Request, context: RouteContext<"/api/v1/project-updates/[id]/attachments">) { try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Chưa chọn tệp."); const clientAttachmentId=String(form.get("clientAttachmentId")??"").trim()||undefined; return successResponse(await uploadProjectUpdateAttachment(user, id, file, String(form.get("caption") ?? ""),clientAttachmentId), { status: 201 }); } catch (error) { return errorResponse(error); } }
