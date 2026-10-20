export interface WorkspacePreferences {
  density: "compact" | "default" | "comfortable";
  sidebarCollapsed: boolean;
  pinnedModules: string[];
  dashboardWidgetVisibility: Record<string, boolean>;
  dashboardWidgetOrder: string[];
  themePreference: "system" | "light";
}

let pendingRequest: Promise<WorkspacePreferences | undefined> | undefined;

// The shell and module launcher mount together. Share only their in-flight GET;
// later reads still reach the server so preference changes are not cached.
export function readWorkspacePreferences(): Promise<WorkspacePreferences | undefined> {
  if (!pendingRequest) {
    pendingRequest = fetch("/api/v1/workspace/preferences", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return undefined;
        const body = await response.json() as { data?: WorkspacePreferences };
        return body.data;
      })
      .finally(() => { pendingRequest = undefined; });
  }
  return pendingRequest;
}
