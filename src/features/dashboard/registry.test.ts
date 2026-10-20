import { describe, expect, it } from "vitest";

import { commandRegistry } from "@/features/search/commandRegistry";
import { defaultDashboardSettings, enabledWidgetsFor, resolveDashboardProfile, resolveLandingPage } from "@/features/dashboard/registry";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";

function user(permissions: Permission[]): AuthenticatedUser {
  return { id: "test", displayName: "Test", username: "test", email: "test@example.com", status: "active", permissions };
}

describe("permission-driven dashboard registry", () => {
  it("selects a preset from permissions rather than a role name", () => {
    expect(resolveDashboardProfile(user(["warehouse.view", "dashboard.view"]), defaultDashboardSettings)).toBe("warehouse");
    expect(resolveDashboardProfile(user(["payroll.view", "dashboard.view"]), defaultDashboardSettings)).toBe("accounting");
    expect(resolveDashboardProfile(user(["worker_attendance.create", "dashboard.view"]), defaultDashboardSettings)).toBe("supervisor");
    expect(resolveDashboardProfile(user(["worker_attendance.create", "employee.view", "dashboard.view"]), defaultDashboardSettings)).toBe("supervisor");
    expect(resolveDashboardProfile(user(["worker_attendance.create", "employee.view", "dashboard.view"]), {
      ...defaultDashboardSettings,
      presetOrder: ["hr", ...defaultDashboardSettings.presetOrder.filter((profile) => profile !== "hr")]
    })).toBe("supervisor");
  });

  it("does not render enabled widgets when their permission is missing", () => {
    const widgets = enabledWidgetsFor(user(["dashboard.view"]), "employee", defaultDashboardSettings);
    expect(widgets.map((widget) => widget.key)).toEqual([]);
  });

  it("combines permitted business areas in one management dashboard", () => {
    const widgets = enabledWidgetsFor(user(["project_monitoring.view_all", "attendance.view_all", "approval.view", "employee.view"]), "management", defaultDashboardSettings);
    expect(widgets.map((widget) => widget.key)).toEqual(["attendance_overview", "my_approvals", "project_attention", "hr_summary"]);
  });

  it("falls back to an accessible landing page", () => {
    const settings = structuredClone(defaultDashboardSettings);
    settings.presets.find((preset) => preset.profile === "employee")!.landingPage = "/dashboard/management";
    expect(resolveLandingPage(user(["dashboard.view"]), settings)).toBe("/dashboard");
    expect(resolveLandingPage(user(["dashboard.view", "employee.view", "warehouse.view"]), settings)).toBe("/dashboard");
    expect(resolveLandingPage(user(["timesheet.view_all"]), settings)).toBe("/timesheets/matrix");
    expect(resolveLandingPage(user(["salary.history.view"]), settings)).toBe("/accounting/salary-history");
  });

  it("contains no destructive command types", () => {
    expect(new Set(commandRegistry.map((command) => command.type))).toEqual(new Set(["NAVIGATE", "CREATE_ROUTE", "OPEN_SEARCH"]));
    expect(commandRegistry.filter((command) => command.type === "CREATE_ROUTE").some((command) => /delete|xóa|approve|duyệt|reverse|đảo/i.test(command.label))).toBe(false);
  });
});
