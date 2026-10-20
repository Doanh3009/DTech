import { listNotificationTemplates } from "@/features/shared-platforms/services/notificationRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function GET(){try{return successResponse(await listNotificationTemplates(requireAuthenticatedUser(await getRequestUser())));}catch(error){return errorResponse(error);}}
