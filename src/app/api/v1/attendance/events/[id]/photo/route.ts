import { z } from "zod";

import { uploadAttendancePhoto } from "@/features/attendance/services/attendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { can } from "@/lib/auth/permissions";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, context: RouteContext<"/api/v1/attendance/events/[id]/photo">) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    if (!can(user.permissions, "attendance.self.create") && !can(user.permissions, "attendance.self")) throw new AppError("PERMISSION_DENIED");
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const form = await request.formData();
    const photo = form.get("photo");
    const thumbnail = form.get("thumbnail");
    if (!(photo instanceof File) || !(thumbnail instanceof File)) throw new AppError("PHOTO_UPLOAD", "Thiếu ảnh chấm công.");
    const width = Number(form.get("width"));
    const height = Number(form.get("height"));
    const capturedAt = String(form.get("capturedAt") ?? "");
    if (!z.string().datetime().safeParse(capturedAt).success) throw new AppError("VALIDATION_ERROR", "Thời gian chụp ảnh không hợp lệ.");
    return successResponse(await uploadAttendancePhoto(user, id, { photo, thumbnail, width, height, capturedAt }));
  } catch (error) {
    return errorResponse(error);
  }
}
