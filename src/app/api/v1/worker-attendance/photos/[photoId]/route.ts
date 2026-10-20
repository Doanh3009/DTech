import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkerPhotoAsset } from "@/features/worker-attendance/services/workerAttendanceRepository";
import { AppError, errorResponse } from "@/lib/api/errors";
import { parseWithSchema } from "@/lib/api/validation";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";
const paramsSchema = z.object({ photoId: z.string().uuid() });
export async function GET(request: Request, context: RouteContext<"/api/v1/worker-attendance/photos/[photoId]">) {
  try { const user = requireAuthenticatedUser(await getRequestUser()); const { photoId } = parseWithSchema(paramsSchema, await context.params); const asset = await getWorkerPhotoAsset(user, photoId, new URL(request.url).searchParams.get("size") === "thumbnail"); const { data, error } = await getSupabaseServiceClient()!.storage.from(asset.bucket).createSignedUrl(asset.path, 300); if (error || !data.signedUrl) throw new AppError("SERVER_ERROR", "Không thể mở ảnh."); return NextResponse.redirect(data.signedUrl, 307); }
  catch (error) { return errorResponse(error); }
}
