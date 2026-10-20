import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitRealtimeInvalidation, resetRealtimeCoordinatorForTests, type RealtimeDomain } from "@/lib/realtime/coordinator";
import { useDomainReconciliation } from "@/lib/realtime/useDomainReconciliation";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  resetRealtimeCoordinatorForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function Consumer({ reconcile, domain = "warehouse" }: { reconcile: () => Promise<void>; domain?: RealtimeDomain }) {
  useDomainReconciliation(domain, reconcile);
  return null;
}

function invalidate(key: string, domain: RealtimeDomain = "warehouse") {
  emitRealtimeInvalidation({ version: 1, domain, key, source: "postgres", occurredAt: new Date().toISOString() });
}

describe("useDomainReconciliation", () => {
  it("coalesces a burst while reconciliation is running", async () => {
    let finishFirst: (() => void) | undefined;
    const reconcile = vi.fn(() => new Promise<void>((resolve) => { finishFirst ??= resolve; }));
    render(<Consumer reconcile={reconcile} />);

    await act(async () => {
      invalidate("initial");
      await vi.advanceTimersByTimeAsync(150);
      for (let index = 0; index < 100; index += 1) invalidate(`event-${index}`);
    });
    expect(reconcile).toHaveBeenCalledOnce();

    await act(async () => {
      finishFirst?.();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(reconcile).toHaveBeenCalledTimes(2);
  });

  it("contains a rejected background reconciliation", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reconcile = vi.fn(async () => { throw new Error("temporary failure"); });
    render(<Consumer reconcile={reconcile} />);
    await act(async () => {
      invalidate("failed-event");
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(reconcile).toHaveBeenCalledOnce();
    expect(warning).toHaveBeenCalledOnce();
  });

  it("batches staggered events even when each request resolves immediately", async () => {
    const reconcile = vi.fn(async () => undefined);
    render(<Consumer reconcile={reconcile} />);
    await act(async () => {
      for (let index = 0; index < 20; index += 1) {
        invalidate(`fast-${index}`);
        await vi.advanceTimersByTimeAsync(20);
      }
    });
    // Continuous invalidations must refresh within a fixed window, without twenty requests.
    expect(reconcile).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(reconcile).toHaveBeenCalledTimes(3);
  });

  it("retains one pending refresh while hidden and reloads once on resume", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    const reconcile = vi.fn(async () => undefined);
    render(<Consumer reconcile={reconcile} />);
    await act(async () => {
      for (let index = 0; index < 100; index += 1) invalidate(`hidden-${index}`);
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(reconcile).not.toHaveBeenCalled();
    await act(async () => {
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      invalidate("resume-fanout");
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(reconcile).toHaveBeenCalledOnce();
  });

  it("lets the replacement domain reconcile while the old request is still pending", async () => {
    let finishOld: (() => void) | undefined;
    const oldReconcile = vi.fn(() => new Promise<void>((resolve) => { finishOld = resolve; }));
    const nextReconcile = vi.fn(async () => undefined);
    const view = render(<Consumer reconcile={oldReconcile} />);
    await act(async () => { invalidate("old-domain"); await vi.advanceTimersByTimeAsync(150); });
    view.rerender(<Consumer domain="projects" reconcile={nextReconcile} />);
    await act(async () => { invalidate("next-domain", "projects"); await vi.advanceTimersByTimeAsync(150); });
    expect(nextReconcile).toHaveBeenCalledOnce();
    await act(async () => { finishOld?.(); await Promise.resolve(); await vi.advanceTimersByTimeAsync(150); });
    expect(oldReconcile).toHaveBeenCalledOnce();
    expect(nextReconcile).toHaveBeenCalledOnce();
  });

  it("uses the latest callback when an already scheduled batch executes", async () => {
    const before = vi.fn(async () => undefined);
    const after = vi.fn(async () => undefined);
    const view = render(<Consumer reconcile={before} />);
    act(() => { invalidate("scheduled"); });
    view.rerender(<Consumer reconcile={after} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledOnce();
  });

  it("cancels a scheduled refresh when the page unmounts", async () => {
    const reconcile = vi.fn(async () => undefined);
    const view = render(<Consumer reconcile={reconcile} />);
    act(() => { invalidate("queued-before-navigation"); });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    expect(reconcile).not.toHaveBeenCalled();
  });
});
