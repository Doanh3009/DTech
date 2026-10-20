import { z } from "zod";
import { uploadWorkerPhoto } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ id: z.string().uuid() });
export async function POST(request: Request, context: RouteContext<"/api/v1/worker-attendance/sessions/[id]/photos">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { id } = parseWithSchema(paramsSchema, await context.params); const form = await request.formData(); const photo = form.get("photo"); const thumbnail = form.get("thumbnail"); if (!(photo instanceof File) || !(thumbnail instanceof File)) throw new AppError("PHOTO_UPLOAD", "Thiếu ảnh điểm danh."); return successResponse(await uploadWorkerPhoto(user, id, { photoId: z.string().uuid().parse(String(form.get("photoId"))), photo, thumbnail, width: Number(form.get("width")), height: Number(form.get("height")), capturedAt: z.string().datetime().parse(String(form.get("capturedAt"))) })); }
  catch (error) { return errorResponse(error); }
}
