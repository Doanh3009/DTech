import { uiPreferencesSchema } from "@/features/workspace/personalWorkspaceSchemas";
import { getUiPreferences, saveUiPreferences } from "@/features/workspace/personalWorkspaceService";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET() { try { return successResponse(await getUiPreferences(requireAuthenticatedUser(await getRequestUser()))); } catch (error) { return errorResponse(error); } }
export async function PUT(request: Request) { try { const user=requireAuthenticatedUser(await getRequestUser()); return successResponse(await saveUiPreferences(user,await parseJsonBody(request,uiPreferencesSchema))); } catch (error) { return errorResponse(error); } }
