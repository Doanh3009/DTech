import { notificationTemplateSchema } from "@/features/shared-platforms/schemas";
import { updateNotificationTemplate } from "@/features/shared-platforms/services/notificationRepository";
import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/validation";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export async function PATCH(request:Request,context:RouteContext<"/api/v1/notification-templates/[eventKey]">){try{const{eventKey}=await context.params;return successResponse(await updateNotificationTemplate(requireAuthenticatedUser(await getRequestUser()),eventKey,await parseJsonBody(request,notificationTemplateSchema)));}catch(error){return errorResponse(error);}}
