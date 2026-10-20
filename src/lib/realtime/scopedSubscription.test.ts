import { describe, expect, it, vi } from "vitest";

import { subscribeScopedRealtime, type RealtimeClientLike } from "@/lib/realtime/scopedSubscription";
import { subscribeRealtimeDomain } from "@/lib/realtime/coordinator";

describe("scoped realtime subscription", () => {
  it("requires a row scope filter", () => {
    expect(() => subscribeScopedRealtime({ domain: "notifications", scope: "notifications", table: "notifications", filter: "recipient=eq." as `${string}=eq.${string}`, onInvalidate: vi.fn(), client: null })).toThrow("bộ lọc phạm vi");
  });

  it("deduplicates events and removes the channel", async () => {
    let eventHandler: ((payload: Record<string, unknown>) => void) | undefined;
    const channel = {
      on: vi.fn((_type: string, _config: Record<string, string>, callback: (payload: Record<string, unknown>) => void) => { eventHandler = callback; return channel; }),
      subscribe: vi.fn((callback: (status: string) => void) => { callback("SUBSCRIBED"); return channel; })
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn(async () => undefined) } as unknown as RealtimeClientLike;
    const invalidate = vi.fn();
    const cleanup = subscribeScopedRealtime({ domain: "notifications", scope: "account-1", table: "notifications", filter: "recipient_account_id=eq.account-1", onInvalidate: invalidate, client });
    const payload = { commit_timestamp: "2026-09-14T00:00:00Z", eventType: "INSERT", new: { id: "notice-1" } };
    eventHandler?.(payload);
    eventHandler?.(payload);
    expect(invalidate).toHaveBeenCalledTimes(1);
    cleanup();
    await Promise.resolve();
    expect(client.removeChannel).toHaveBeenCalledOnce();
  });

  it("routes invalidation bus rows to their declared domain", () => {
    let eventHandler: ((payload: Record<string, unknown>) => void) | undefined;
    const channel = {
      on: vi.fn((_type: string, _config: Record<string, string>, callback: (payload: Record<string, unknown>) => void) => { eventHandler = callback; return channel; }),
      subscribe: vi.fn(() => channel)
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn(async () => undefined) } as unknown as RealtimeClientLike;
    const warehouse = vi.fn();
    const cleanup = subscribeScopedRealtime({
      domain: "dashboard",
      scope: "account-1",
      table: "realtime_invalidations",
      filter: "audience=eq.authenticated",
      client,
      onInvalidate: vi.fn(),
      resolveEvent: (payload) => payload.new?.domain === "warehouse" ? { domain: "warehouse", key: String(payload.new.event_key) } : null
    });
    const unsubscribe = subscribeRealtimeDomain("warehouse", warehouse);
    eventHandler?.({ new: { domain: "warehouse", event_key: "event-1" } });
    expect(warehouse).toHaveBeenCalledOnce();
    unsubscribe();
    cleanup();
  });
});
