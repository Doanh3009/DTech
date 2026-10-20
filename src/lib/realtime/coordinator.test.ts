import { afterEach, describe, expect, it, vi } from "vitest";

import {
  emitRealtimeInvalidation,
  broadcastRealtimeInvalidation,
  getRealtimeConnectionState,
  markRealtimeTransportState,
  resetRealtimeCoordinatorForTests,
  startRealtimeCoordinator,
  subscribeRealtimeDomain
} from "@/lib/realtime/coordinator";

afterEach(() => {
  resetRealtimeCoordinatorForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("realtime coordinator", () => {
  it("deduplicates a committed event across local and remote delivery", () => {
    const listener = vi.fn();
    subscribeRealtimeDomain("warehouse", listener);
    const event = { version: 1, domain: "warehouse", key: "ledger:42:v3", source: "postgres", occurredAt: "2026-09-14T08:00:00.000Z" } as const;

    expect(emitRealtimeInvalidation(event)).toBe(true);
    expect(emitRealtimeInvalidation({ ...event, source: "remote-tab" })).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("reports degraded transport without describing the database as offline", () => {
    markRealtimeTransportState("connected");
    expect(getRealtimeConnectionState()).toBe("connected");
    markRealtimeTransportState("error");
    expect(getRealtimeConnectionState()).toBe("degraded");
  });

  it("does not fan out lifecycle refreshes to dashboard or repeat focus and resume together", () => {
    const dashboard = vi.fn();
    const warehouse = vi.fn();
    subscribeRealtimeDomain("dashboard", dashboard);
    subscribeRealtimeDomain("warehouse", warehouse);
    const stop = startRealtimeCoordinator("account-1");

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    expect(warehouse).toHaveBeenCalledOnce();
    expect(dashboard).toHaveBeenCalledOnce();

    emitRealtimeInvalidation({ version: 1, domain: "warehouse", key: "stock:changed", source: "postgres", occurredAt: new Date().toISOString() });
    expect(warehouse).toHaveBeenCalledTimes(2);
    expect(dashboard).toHaveBeenCalledTimes(2);
    stop();
  });

  it("reconciles mounted domains after the browser returns online and cleans listeners", () => {
    const listener = vi.fn();
    subscribeRealtimeDomain("notifications", listener);
    const stop = startRealtimeCoordinator("account-1");

    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledOnce();
    expect(getRealtimeConnectionState()).toBe("reconnecting");

    stop();
    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledOnce();
  });

  it("reconciles mounted data when a page is restored from the browser back-forward cache", () => {
    const listener = vi.fn();
    subscribeRealtimeDomain("employees", listener);
    const stop = startRealtimeCoordinator("account-1");

    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));

    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it("keeps lifecycle listeners balanced across repeated mount and unmount cycles", () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");

    for (let cycle = 0; cycle < 30; cycle += 1) {
      const stop = startRealtimeCoordinator("account-1");
      stop();
    }

    const focusAdds = added.mock.calls.filter(([type]) => type === "focus").length;
    const focusRemovals = removed.mock.calls.filter(([type]) => type === "focus").length;
    expect(focusAdds).toBe(30);
    expect(focusRemovals).toBe(focusAdds);
  });

  it("does not reload initial page data on a normal pageshow", () => {
    const listener = vi.fn();
    subscribeRealtimeDomain("dashboard", listener);
    const stop = startRealtimeCoordinator("account-1");
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: false }));
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it("keeps hidden lifecycle refreshes quiet and reconciles once after becoming visible", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    const listener = vi.fn();
    subscribeRealtimeDomain("employees", listener);
    const stop = startRealtimeCoordinator("account-1");
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(60_000);
    expect(listener).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();
    stop();
  });

  it("refreshes immediately after reconnect even when a recent focus refresh used the lifecycle cooldown", () => {
    vi.useFakeTimers();
    const listener = vi.fn();
    subscribeRealtimeDomain("warehouse", listener);
    const stop = startRealtimeCoordinator("account-1");
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1_000);
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].source).toBe("reconnect");
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it("retains a hidden reconnect and refreshes once on visible resume despite the recent focus cooldown", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const online = vi.spyOn(navigator, "onLine", "get");
    visibility.mockReturnValue("visible");
    online.mockReturnValue(true);
    const listener = vi.fn();
    subscribeRealtimeDomain("warehouse", listener);
    const stop = startRealtimeCoordinator("account-1");
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();

    visibility.mockReturnValue("hidden");
    online.mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    vi.advanceTimersByTime(1_000);
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();

    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[1][0].source).toBe("reconnect");
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps a retained reconnect pending while offline and clears it when the account lifecycle stops", () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const online = vi.spyOn(navigator, "onLine", "get");
    visibility.mockReturnValue("hidden");
    online.mockReturnValue(true);
    const listener = vi.fn();
    subscribeRealtimeDomain("warehouse", listener);
    const stopOld = startRealtimeCoordinator("account-old");
    window.dispatchEvent(new Event("online"));
    online.mockReturnValue(false);
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    expect(listener).not.toHaveBeenCalled();
    stopOld();

    online.mockReturnValue(true);
    const stopNew = startRealtimeCoordinator("account-new");
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].source).toBe("focus");
    stopNew();
  });

  it("does not let an old account cleanup stop the replacement account lifecycle", () => {
    const listener = vi.fn();
    subscribeRealtimeDomain("notifications", listener);
    const stopOld = startRealtimeCoordinator("account-old");
    const stopNew = startRealtimeCoordinator("account-new");
    stopOld();
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();
    stopNew();
  });

  it("treats repeated cleanup as idempotent while another provider still retains the lifecycle", () => {
    const listener = vi.fn();
    subscribeRealtimeDomain("warehouse", listener);
    const stopOne = startRealtimeCoordinator("account-1");
    const stopTwo = startRealtimeCoordinator("account-1");
    stopOne();
    stopOne();
    window.dispatchEvent(new Event("focus"));
    expect(listener).toHaveBeenCalledOnce();
    stopTwo();
  });

  it("reuses the account broadcast channel and refreshes a dashboard-only subscriber on remote domain changes", () => {
    const created: { postMessage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; listener?: EventListener }[] = [];
    class TestChannel {
      postMessage = vi.fn();
      close = vi.fn();
      listener?: EventListener;
      constructor() { created.push(this); }
      addEventListener(_type: string, listener: EventListener) { this.listener = listener; }
      removeEventListener() { this.listener = undefined; }
    }
    vi.stubGlobal("BroadcastChannel", TestChannel);
    const dashboard = vi.fn();
    subscribeRealtimeDomain("dashboard", dashboard);
    const stop = startRealtimeCoordinator("account-1");
    const event = { version: 1, domain: "warehouse", key: "stock:remote", source: "postgres", occurredAt: new Date().toISOString() } as const;
    broadcastRealtimeInvalidation(event);
    broadcastRealtimeInvalidation({ ...event, key: "stock:second" });
    expect(created).toHaveLength(1);
    expect(created[0].postMessage).toHaveBeenCalledTimes(2);
    created[0].listener?.(new MessageEvent("message", { data: event }));
    expect(dashboard).toHaveBeenCalledOnce();
    stop();
    expect(created[0].close).toHaveBeenCalledOnce();
    broadcastRealtimeInvalidation(event);
    expect(created[0].postMessage).toHaveBeenCalledTimes(2);
  });
});
