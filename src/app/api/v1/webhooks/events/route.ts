import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { successResponse } from "@/lib/api/responses";
import { parseWithSchema } from "@/lib/api/validation";
import { logger } from "@/lib/logger";
import { createWebhookEvent, webhookEventTypeSchema } from "@/services/integrations/webhookEvents";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requirePermission } from "@/services/authorization/requirePermission";

const webhookEventSchema = z.object({
  id: z.string().uuid(),
  type: webhookEventTypeSchema,
  payload: z.record(z.unknown())
});

export async function POST(request: Request) {
  try {
    const user = await getRequestUser();
    requirePermission(user, "webhook.publish");

    const input = parseWithSchema(webhookEventSchema, await request.json());
    const event = createWebhookEvent(input.id, input.type, input.payload);

    return successResponse(
      {
        event,
        queued: true,
        note: "Delivery worker và endpoint registry sẽ được nối vào integration module."
      },
      { status: 202 }
    );
  } catch (error) {
    logger.error("api.webhook_event.failed");
    return errorResponse(error);
  }
}
