import { NextResponse } from "next/server";
import { z } from "zod";
import { getMessageAttachmentAsset } from "@/features/messaging/service";
import { AppError, errorResponse } from "@/lib/api/errors";
import { parseWithSchema } from "@/lib/api/validation";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

const paramsSchema = z.object({ id: z.string().uuid(), attachmentId: z.string().uuid() });

export async function GET(
  _request: Request,
  context: RouteContext<"/api/v1/chat/conversations/[id]/attachments/[attachmentId]">
) {
  try {
    const { id, attachmentId } = parseWithSchema(paramsSchema, await context.params);
    const user = requireAuthenticatedUser(await getRequestUser());
    const asset = await getMessageAttachmentAsset(user, id, attachmentId);
    const client = getSupabaseServiceClient();
    if (!client) throw new AppError("SERVER_ERROR", "Supabase chưa được cấu hình.");
    const { data, error } = await client.storage.from(asset.bucket).createSignedUrl(asset.path, 120, { download: asset.fileName });
    if (error || !data?.signedUrl) throw new AppError("SERVER_ERROR", "Không thể mở tệp đính kèm.");
    return NextResponse.redirect(data.signedUrl, 307);
  } catch (error) {
    return errorResponse(error);
  }
}
