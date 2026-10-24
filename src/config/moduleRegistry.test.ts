import { describe, expect, it } from "vitest";

import { applicationForPath, applicationRegistry, applicationsForLauncher, contextualNavigationGroups, visibleApplications, visibleApplicationShortcuts } from "@/config/moduleRegistry";
import { defaultSystemSettings } from "@/config/systemSettings";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { employeeBaselinePermissions } from "@/services/authorization/employeeAccessPolicy";

function user(permissions: Permission[]): AuthenticatedUser {
  return { id: "test", displayName: "Test", username: "test", email: "test@example.com", status: "active", permissions };
}

describe("application registry", () => {
  it("gives every application a distinct semantic identity", () => {
    expect(new Set(applicationRegistry.map((application) => application.icon)).size).toBe(applicationRegistry.length);
  });

  it("resolves nested routes to one application", () => {
    expect(applicationForPath("/warehouse/receipts/new").id).toBe("warehouse");
    expect(applicationForPath("/dashboard/hr").id).toBe("human-resources");
    expect(applicationForPath("/attendance/today").id).toBe("human-resources");
    expect(applicationForPath("/attendance/logs").id).toBe("human-resources");
    expect(applicationForPath("/timesheets").id).toBe("human-resources");
    expect(applicationForPath("/attendance/me").id).toBe("attendance");
    expect(applicationForPath("/personal").id).toBe("attendance");
    expect(applicationForPath("/attendance/requests").id).toBe("attendance");
    expect(applicationForPath("/dashboard/warehouse").id).toBe("warehouse");
    expect(applicationForPath("/projects/abc/updates").id).toBe("projects");
  });

  it("shows launcher applications by permission", () => {
    const applications = visibleApplications(user(["warehouse.view", "profile.view"]), defaultSystemSettings.modules);
    expect(applications.map((item) => item.id)).toEqual(["warehouse"]);
  });

  it("offers messaging as a configurable application with its own permission", () => {
    expect(visibleApplications(user(["chat.access"]), defaultSystemSettings.modules).some((item) => item.id === "messaging")).toBe(true);
    expect(visibleApplications(user(["chat.access"]), { ...defaultSystemSettings.modules, messaging: false })).toEqual([]);
    expect(contextualNavigationGroups("/messages", user(["chat.access"]), defaultSystemSettings.modules, defaultSystemSettings.navigation).flatMap((group) => group.items)).toEqual([]);
  });

  it("keeps reports reachable when approvals and documents are disabled", () => {
    const applications = visibleApplications(user(["document.view", "report.view"]), { ...defaultSystemSettings.modules, operations: false });
    expect(applications.find((item) => item.id === "operations")?.defaultRoute).toBe("/reports");
  });

  it("keeps attendance management reachable without the employee records capability", () => {
    const applications = visibleApplications(user(["employee.view", "attendance.view_all"]), { ...defaultSystemSettings.modules, human_resources: false });
    expect(applications.find((item) => item.id === "human-resources")?.defaultRoute).toBe("/attendance/today");
  });

  it("omits Dashboard from the launcher and from business module sidebars", () => {
    const currentUser = user(["dashboard.view", "warehouse.view"]);
    expect(applicationsForLauncher(currentUser, defaultSystemSettings.modules).some((item) => item.id === "overview")).toBe(false);
    expect(contextualNavigationGroups("/warehouse/inventory", currentUser, defaultSystemSettings.modules, defaultSystemSettings.navigation)
      .flatMap((group) => group.items)
      .filter((item) => item.href === "/dashboard")).toHaveLength(0);
  });

  it("does not treat attendance management permission as access to the personal app", () => {
    const admin = visibleApplications(user(["attendance.view_all"]), defaultSystemSettings.modules);
    const employee = visibleApplications(user(["attendance.self"]), defaultSystemSettings.modules);
    expect(admin.map((item) => item.id)).toEqual(["human-resources"]);
    expect(admin[0].defaultRoute).toBe("/attendance/today");
    expect(employee.map((item) => item.id)).toEqual(["attendance"]);
  });

  it("keeps unavailable applications visible and explicitly locked in the launcher", () => {
    const applications = applicationsForLauncher(user(["warehouse.view"]), defaultSystemSettings.modules);

    expect(applications.find((item) => item.id === "warehouse")?.accessible).toBe(true);
    expect(applications.find((item) => item.id === "human-resources")?.accessible).toBe(false);
  });

  it("keeps employee self-service from granting access to HR", () => {
    const employee = user([...employeeBaselinePermissions]);
    expect(visibleApplications(employee, defaultSystemSettings.modules).map((item) => item.id)).not.toContain("human-resources");
    expect(applicationsForLauncher(employee, defaultSystemSettings.modules).find((item) => item.id === "human-resources")?.accessible).toBe(false);
    expect(contextualNavigationGroups("/attendance/today", employee, defaultSystemSettings.modules, defaultSystemSettings.navigation)
      .flatMap((group) => group.items.map((item) => item.href))).toEqual([]);
    expect(visibleApplications(employee, defaultSystemSettings.modules).map((item) => item.id)).toContain("attendance");
  });

  it("keeps the sidebar contextual", () => {
    const groups = contextualNavigationGroups("/warehouse/inventory", user(["warehouse.view", "employee.view"]), defaultSystemSettings.modules, defaultSystemSettings.navigation);
    expect(groups.map((group) => group.label)).toEqual(["VẬN HÀNH KHO", "DANH MỤC & CẤU HÌNH"]);
    expect(groups.flatMap((group) => group.items).every((item) => item.href.startsWith("/warehouse"))).toBe(true);
  });

  it("opens warehouse on inventory and places setup with warehouse navigation", () => {
    const groups = contextualNavigationGroups(
      "/settings/warehouse",
      user(["warehouse.view", "warehouse.item.view", "warehouse.master.manage", "warehouse.ledger.view"]),
      defaultSystemSettings.modules,
      { ...defaultSystemSettings.navigation, itemOrder: [...defaultSystemSettings.navigation.itemOrder].reverse() }
    );
    const paths = groups.flatMap((group) => group.items.map((item) => item.href));

    expect(applicationForPath("/settings/warehouse").id).toBe("warehouse");
    expect(paths[0]).toBe("/warehouse/inventory");
    expect(paths.indexOf("/settings/warehouse")).toBeGreaterThan(paths.indexOf("/warehouse/items"));
    expect(paths.indexOf("/settings/warehouse")).toBeGreaterThan(paths.indexOf("/warehouse/warehouses"));
    expect(visibleApplicationShortcuts(applicationForPath("/warehouse"), user(["warehouse.view"]), defaultSystemSettings.modules, { ...defaultSystemSettings.navigation, itemOrder: [...defaultSystemSettings.navigation.itemOrder].reverse() })[0].href).toBe("/warehouse");
  });

  it("opens HR directly on its primary function", () => {
    const groups = contextualNavigationGroups("/dashboard/hr", user(["employee.view"]), defaultSystemSettings.modules, defaultSystemSettings.navigation);

    expect(groups[0].items[0].href).toBe("/employees");
    expect(groups.flatMap((group) => group.items).some((item) => item.href === "/dashboard/hr")).toBe(false);
    expect(groups.flatMap((group) => group.items).some((item) => item.href === "/employees")).toBe(true);
  });

  it("keeps HR administration and personal attendance separate", () => {
    const hr = contextualNavigationGroups("/attendance/today", user(["attendance.view_all", "timesheet.view", "shift.view"]), defaultSystemSettings.modules, defaultSystemSettings.navigation);
    expect(hr.flatMap((group) => group.items).map((item) => item.href)).toEqual(["/attendance/today", "/timesheets/matrix", "/timesheets", "/shifts", "/timesheets/adjustments"]);
    const personal = contextualNavigationGroups("/attendance/me", user(["attendance.self", "attendance.self.view"]), defaultSystemSettings.modules, defaultSystemSettings.navigation);
    expect(personal[0].items.map((item) => item.href)).toEqual(["/attendance/me", "/attendance/history", "/attendance/requests", "/attendance/notifications"]);
  });

  it("opens the correct application for dedicated attendance permissions", () => {
    const manager = visibleApplications(user(["attendance.period.manage"]), defaultSystemSettings.modules);
    const personal = visibleApplications(user(["attendance.self_history"]), defaultSystemSettings.modules);
    expect(manager.map((item) => item.id)).toEqual(["human-resources"]);
    expect(manager[0].defaultRoute).toBe("/timesheets");
    expect(personal.map((item) => item.id)).toEqual(["attendance"]);
    expect(personal[0].defaultRoute).toBe("/attendance/history");
  });

  it("opens every application on a function the user can access", () => {
    expect(visibleApplications(user(["warehouse.issue.view"]), defaultSystemSettings.modules)[0]?.defaultRoute).toBe("/warehouse/issues");
    expect(visibleApplications(user(["payslip.self.view"]), defaultSystemSettings.modules)[0]?.defaultRoute).toBe("/personal/payslips");
    expect(visibleApplications(user(["approval.view"]), defaultSystemSettings.modules)[0]?.defaultRoute).toBe("/approvals");
    expect(visibleApplications(user(["role.view"]), defaultSystemSettings.modules)[0]?.defaultRoute).toBe("/settings/roles");
  });
});
