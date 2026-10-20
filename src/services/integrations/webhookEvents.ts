import { z } from "zod";

import { nowServerReceivedAt } from "@/lib/time/timezone";

export const webhookEventTypeSchema = z.enum([
  "employee.created",
  "employee.updated",
  "attendance.checked_in",
  "attendance.checked_out",
  "leave.approved",
  "project.updated",
  "warehouse.receipt.posted",
  "warehouse.issue.posted",
  "shipment.updated"
]);

export type WebhookEventType = z.infer<typeof webhookEventTypeSchema>;

export interface WebhookEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  type: WebhookEventType;
  occurredAt: string;
  payload: TPayload;
}

export function createWebhookEvent<TPayload extends Record<string, unknown>>(
  id: string,
  type: WebhookEventType,
  payload: TPayload
): WebhookEvent<TPayload> {
  return {
    id,
    type,
    occurredAt: nowServerReceivedAt(),
    payload
  };
}
