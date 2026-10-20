import { afterEach, describe, expect, it, vi } from "vitest";

import { readWorkspacePreferences } from "./workspacePreferencesRequest";

afterEach(() => vi.unstubAllGlobals());

describe("readWorkspacePreferences", () => {
  it("shares an in-flight request and reads fresh preferences next time", async () => {
    const preferences = {
      density: "default" as const,
      sidebarCollapsed: false,
      pinnedModules: ["attendance"],
      dashboardWidgetVisibility: {},
      dashboardWidgetOrder: [],
      themePreference: "system" as const
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: preferences }) });
    vi.stubGlobal("fetch", fetchMock);

    const first = readWorkspacePreferences();
    const second = readWorkspacePreferences();
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await first).toEqual(preferences);

    expect(await readWorkspacePreferences()).toEqual(preferences);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
