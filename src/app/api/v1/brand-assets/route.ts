import { brandAssetTypeSchema, uploadBrandAsset } from "@/services/system-settings/brandAssetService";
import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { logger } from "@/lib/logger";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

export async function POST(request: Request) {
  try {
    const user = await getRequestUser();
    requirePermission(user, "system_admin.access");
    const actor = requirePermission(user, "branding.manage");
    const form = await request.formData();
    const file = form.get("file");
    const assetType = brandAssetTypeSchema.parse(form.get("assetType"));
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Chưa chọn tệp.");
    return successResponse({ asset: await uploadBrandAsset({ file, assetType, actorId: actor.id }) }, { status: 201 });
  } catch (error) {
    logger.error("api.brand_assets.upload_failed");
    return errorResponse(error);
  }
}
