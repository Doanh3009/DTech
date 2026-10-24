import { AppError, errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { activateSystemSettings, readSettingsActivationState, requireSettingsActivationPermission } from "@/services/system-settings/settingsActivationService";

export async function GET() {
  try {
    requireSettingsActivationPermission(await getRequestUser());
    return successResponse(await readSettingsActivationState(), { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = requireSettingsActivationPermission(await getRequestUser());
    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 32_768) throw new Error("body limit");
      body = JSON.parse(text);
    } catch { throw new AppError("VALIDATION_ERROR", "Nội dung cấu hình ERP không hợp lệ."); }
    return successResponse(await activateSystemSettings(user, body), { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
