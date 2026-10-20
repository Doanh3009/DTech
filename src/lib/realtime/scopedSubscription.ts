"use client";

import { getAuthenticatedSupabaseRealtimeClient } from "@/lib/supabase/client";
import {
  broadcastRealtimeInvalidation,
  emitRealtimeInvalidation,
  markRealtimeTransportState,
  reconcileRealtimeDomain,
  subscribeRealtimeDomain,
  type RealtimeConnectionState,
  type RealtimeDomain
} from "@/lib/realtime/coordinator";

export type { RealtimeConnectionState } from "@/lib/realtime/coordinator";

interface RealtimePayload {
  commit_timestamp?: string;
  eventType?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

interface RealtimeChannelLike {
  on: (type: string, config: Record<string, string>, callback: (payload: RealtimePayload) => void) => RealtimeChannelLike;
  subscribe: (callback: (status: string) => void) => RealtimeChannelLike;
}

export interface RealtimeClientLike {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel: (channel: RealtimeChannelLike) => Promise<unknown>;
}

export interface ScopedRealtimeOptions {
  domain: RealtimeDomain;
  scope: string;
  table: string;
  filter: `${string}=eq.${string}`;
  schema?: string;
  onInvalidate: () => void;
  resolveEvent?: (payload: RealtimePayload) => { domain: RealtimeDomain; key: string } | null;
  onStateChange?: (state: RealtimeConnectionState) => void;
  client?: RealtimeClientLike | null;
}

function safeSegment(value: string): string {
  return value.toLocaleLowerCase("en").replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function eventIdentity(payload: RealtimePayload): string {
  const row = payload.new ?? payload.old ?? {};
  return [payload.commit_timestamp, payload.eventType, row.id ?? row.delivery_key ?? "unknown"].join(":");
}

export function subscribeScopedRealtime(options: ScopedRealtimeOptions): () => void {
  if (!/^[a-z][a-z0-9_]*$/.test(options.table)) throw new Error("Bảng Realtime không hợp lệ.");
  if (!/^[a-z][a-z0-9_]*=eq\.[^,]+$/.test(options.filter)) throw new Error("Realtime bắt buộc có bộ lọc phạm vi dạng eq.");

  let disposed = false;
  let disconnected = false;
  let channel: RealtimeChannelLike | undefined;
  let client: RealtimeClientLike | null = options.client ?? null;
  const unsubscribeInvalidation = subscribeRealtimeDomain(options.domain, () => options.onInvalidate());
  markRealtimeTransportState("connecting");
  options.onStateChange?.("connecting");

  const connect = async () => {
    client ??= await getAuthenticatedSupabaseRealtimeClient() as unknown as RealtimeClientLike | null;
    if (disposed) return;
    if (!client) {
      markRealtimeTransportState("disconnected");
      options.onStateChange?.("degraded");
      return;
    }
    channel = client.channel(`ct:${safeSegment(options.scope)}:${safeSegment(options.table)}`)
      .on("postgres_changes", {
        event: "*",
        schema: options.schema ?? "public",
        table: options.table,
        filter: options.filter
      }, (payload) => {
        const resolved = options.resolveEvent?.(payload);
        if (options.resolveEvent && !resolved) return;
        emitRealtimeInvalidation({
          version: 1,
          domain: resolved?.domain ?? options.domain,
          key: resolved?.key ?? eventIdentity(payload),
          source: "postgres",
          occurredAt: payload.commit_timestamp ?? new Date().toISOString()
        }, broadcastRealtimeInvalidation);
      })
      .subscribe((status) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          markRealtimeTransportState("connected");
          options.onStateChange?.("connected");
          if (disconnected) reconcileRealtimeDomain(options.domain, "reconnect");
          disconnected = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          disconnected = true;
          markRealtimeTransportState("error");
          options.onStateChange?.("degraded");
        } else if (status === "CLOSED") {
          disconnected = true;
          markRealtimeTransportState("disconnected");
          options.onStateChange?.("degraded");
        }
      });
  };
  void connect();

  return () => {
    disposed = true;
    unsubscribeInvalidation();
    if (client && channel) void client.removeChannel(channel);
  };
}
