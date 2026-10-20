import { NextResponse } from "next/server";

import { getOwnAvatarAsset, removeOwnAvatar, uploadOwnAvatar } from "@/features/workspace/personalWorkspaceService";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() {
  try {
    const asset = await getOwnAvatarAsset(requireAuthenticatedUser(await getRequestUser()));
    const { data, error } = await getSupabaseServiceClient()!.storage.from(asset.bucket).createSignedUrl(asset.path, 300);
    if (error || !data?.signedUrl) throw new AppError("SERVER_ERROR", "Không thể mở ảnh đại diện.");
    return NextResponse.redirect(data.signedUrl, 307);
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new AppError("VALIDATION_ERROR", "Vui lòng chọn ảnh đại diện.");
    return successResponse(await uploadOwnAvatar(requireAuthenticatedUser(await getRequestUser()), file), { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE() {
  try { return successResponse(await removeOwnAvatar(requireAuthenticatedUser(await getRequestUser()))); }
  catch (error) { return errorResponse(error); }
}
