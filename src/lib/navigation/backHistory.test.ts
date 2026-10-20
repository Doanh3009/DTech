import { afterEach, describe, expect, it, vi } from "vitest";

import { goBackInApp, installBackHistory } from "./backHistory";

let dispose: (() => void) | undefined;

function start(href = "/dashboard") {
  window.history.replaceState(null, "", href);
  dispose = installBackHistory("account-1");
}

function visit(href: string) {
  window.history.pushState({ __NA: true, tree: "preserve-me" }, "", href);
}

async function traverse(action: () => void) {
  const popped = new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
  action();
  await popped;
}

async function back() {
  await traverse(() => expect(goBackInApp()).toBe(true));
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.restoreAllMocks();
});

describe("application return history", () => {
  it("returns through the original screens and query filters", async () => {
    start();
    visit("/employees/employee-1/attendance?month=2026-09");
    visit("/attendance/logs?employeeId=employee-1");
    visit("/attendance/records/event-1");
    await back();
    expect(window.location.pathname + window.location.search).toBe("/attendance/logs?employeeId=employee-1");
    await back();
    expect(window.location.pathname + window.location.search).toBe("/employees/employee-1/attendance?month=2026-09");
  });

  it("does not reopen a child after returning to the list through the menu", async () => {
    start();
    visit("/warehouse/items");
    visit("/warehouse/items/item-1");
    visit("/warehouse/items");
    await back();
    expect(window.location.pathname).toBe("/dashboard");
    expect(goBackInApp()).toBe(false);
  });

  it("does not mistake forward history for an available previous screen", async () => {
    start("/warehouse/items");
    visit("/warehouse/items/item-1");
    await back();
    expect(window.history.length).toBeGreaterThan(1);
    expect(goBackInApp()).toBe(false);
  });

  it("does not return into a child when the parent was not visited before", async () => {
    start("/warehouse/items/item-1");
    visit("/warehouse/items");
    expect(goBackInApp()).toBe(false);
  });

  it("keeps the return chain across refresh/remount and router state replacements", async () => {
    start();
    visit("/warehouse/items?search=ray");
    visit("/warehouse/items/item-1");
    window.history.replaceState({ __NA: true, tree: "new-tree" }, "", window.location.href);
    dispose?.();
    dispose = installBackHistory("account-1");
    expect(window.history.state.tree).toBe("new-tree");
    await back();
    expect(window.location.pathname + window.location.search).toBe("/warehouse/items?search=ray");
    expect(window.history.state.tree).toBe("preserve-me");
  });

  it("handles browser back/forward and a new branch without stale future entries", async () => {
    start();
    visit("/warehouse/items");
    visit("/warehouse/items/item-1");
    await traverse(() => window.history.back());
    await traverse(() => window.history.forward());
    await back();
    visit("/warehouse/items/item-2");
    await back();
    expect(window.location.pathname).toBe("/warehouse/items");
    await back();
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("does not duplicate a navigation when Back is tapped twice rapidly", async () => {
    start();
    visit("/warehouse/items");
    visit("/warehouse/items/item-1");
    await traverse(() => {
      expect(goBackInApp()).toBe(true);
      expect(goBackInApp()).toBe(true);
    });
    expect(window.location.pathname).toBe("/warehouse/items");
  });

  it("starts a new boundary for another account or an untracked direct URL", () => {
    start();
    visit("/warehouse/items");
    dispose?.();
    dispose = installBackHistory("account-2");
    expect(goBackInApp()).toBe(false);
  });
});
