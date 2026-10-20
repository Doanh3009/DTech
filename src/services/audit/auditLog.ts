import { z } from "zod";

import { logger } from "@/lib/logger";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { sanitizeAuditValue } from "@/features/shared-platforms/rules";

export const auditActionSchema = z.string().min(3).max(120);

export interface AuditLogEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityReference?: string;
  module?: string;
  source?: "web" | "api" | "job" | "system";
  correlationId?: string;
  severity?: "normal" | "security" | "sensitive";
  timestamp?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const localAuditEntries: AuditLogEntry[] = [];
function sanitizeRecord(record?: Record<string, unknown>): Record<string, unknown> | undefined {
  return record ? sanitizeAuditValue(record) as Record<string, unknown> : undefined;
}

export function getLocalAuditLogs(): AuditLogEntry[] {
  return [...localAuditEntries].reverse();
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  auditActionSchema.parse(entry.action);
  const safeEntry: AuditLogEntry = {
    ...entry,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    before: sanitizeRecord(entry.before),
    after: sanitizeRecord(entry.after)
  };
  localAuditEntries.push(safeEntry);

  const client = getSupabaseServiceClient();
  if (client) {
    const actorAccountId = z.string().uuid().safeParse(entry.actorId).success ? entry.actorId : null;
    const { error } = await client.from("audit_logs").insert({
      actor_account_id: actorAccountId,
      action: safeEntry.action,
      entity_type: safeEntry.entityType,
      entity_id: safeEntry.entityId,
      entity_reference: safeEntry.entityReference ?? null,
      module: safeEntry.module ?? safeEntry.action.split(".")[0],
      source: safeEntry.source ?? "web",
      correlation_id: safeEntry.correlationId ?? (typeof safeEntry.metadata?.correlationId === "string" ? safeEntry.metadata.correlationId : null),
      severity: safeEntry.severity ?? "normal",
      happened_at: safeEntry.timestamp,
      before_data: safeEntry.before,
      after_data: safeEntry.after,
      reason: safeEntry.reason,
      metadata: safeEntry.metadata ?? {}
    });
    if (error) {
      logger.error("audit_log.persistence_failed", {
        event: safeEntry.action,
        entityType: safeEntry.entityType,
        entityId: safeEntry.entityId
      });
    }
  }

  logger.info("audit_log.recorded", {
    event: safeEntry.action,
    actorId: safeEntry.actorId,
    entityType: safeEntry.entityType,
    entityId: safeEntry.entityId,
    metadata: {
      hasBefore: Boolean(safeEntry.before),
      hasAfter: Boolean(safeEntry.after),
      reason: safeEntry.reason,
      ...safeEntry.metadata
    }
  });
}
