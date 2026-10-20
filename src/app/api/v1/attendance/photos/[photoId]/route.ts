import { NextResponse } from "next/server";
import { z } from "zod";

import { getAttendancePhotoAsset } from "@/features/attendance/services/attendanceRepository";
import { errorResponse } from "@/lib/api/errors";
import { parseWithSchema } from "@/lib/api/validation";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ photoId: z.string().uuid() });

export async function GET(request: Request, context: RouteContext<"/api/v1/attendance/photos/[photoId]">) {
  try {
    const user = requireAuthenticatedUser(await getRequestUser());
    const { photoId } = parseWithSchema(paramsSchema, await context.params);
    const asset = await getAttendancePhotoAsset(user, photoId, new URL(request.url).searchParams.get("size") === "thumbnail");
    const client = getSupabaseServiceClient();
    const { data, error } = await client!.storage.from(asset.bucket).createSignedUrl(asset.path, 300);
    if (error || !data.signedUrl) throw error;
    return NextResponse.redirect(data.signedUrl, 307);
  } catch (error) {
    return errorResponse(error);
  }
}
