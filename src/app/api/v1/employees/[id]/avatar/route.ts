import { z } from "zod";
import { NextResponse } from "next/server";

import { getEmployeeAvatarAsset, replaceEmployeeAvatar } from "@/features/employees/services/employeeAvatarService";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext<"/api/v1/employees/[id]/avatar">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const asset = await getEmployeeAvatarAsset(requireAuthenticatedUser(await getRequestUser()), id);
    const { data, error } = await getSupabaseServiceClient()!.storage.from(asset.bucket).createSignedUrl(asset.path, 300);
    if (error || !data.signedUrl) throw new AppError("SERVER_ERROR", "Không thể mở ảnh nhân viên.");
    return NextResponse.redirect(data.signedUrl, 307);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext<"/api/v1/employees/[id]/avatar">) {
  try {
    const { id } = parseWithSchema(paramsSchema, await context.params);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Thiếu ảnh nhân viên.");
    return successResponse(await replaceEmployeeAvatar(requireAuthenticatedUser(await getRequestUser()), id, file));
  } catch (error) {
    return errorResponse(error);
  }
}
