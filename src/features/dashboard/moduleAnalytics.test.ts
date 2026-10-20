import { describe, expect, it } from "vitest";
import { analyticsDefinitionsFor, dashboardModulesFor } from "./moduleAnalytics";
import { hasAreaAccess } from "@/config/routeAccess";
import { defaultSystemSettings } from "@/config/systemSettings";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";

function user(permissions: Permission[]): AuthenticatedUser {
  return { id: "test", displayName: "Test", username: "test", email: "test@example.com", status: "active", permissions };
}

describe("module analytics authorization", () => {
  it("gives an accounting-only account only accounting analytics, including direct dashboard access", () => {
    const account = user(["payroll.view", "salary.view"]);
    expect(hasAreaAccess(account.permissions, "dashboard")).toBe(true);
    expect(dashboardModulesFor(account).map((module) => module.id)).toEqual(["accounting"]);
    expect(analyticsDefinitionsFor(account, defaultSystemSettings.modules).map((widget) => widget.key)).toEqual(["accounting_summary"]);
  });
  it("does not give dashboard permission access to business metrics", () => {
    expect(analyticsDefinitionsFor(user(["dashboard.view"]), defaultSystemSettings.modules)).toEqual([]);
  });
  it("does not include disabled modules or unrelated widgets", () => {
    const account = user(["warehouse.view", "salary.view", "notification.view", "audit.view"]);
    expect(analyticsDefinitionsFor(account, { ...defaultSystemSettings.modules, warehouse: false }).map((widget) => widget.key)).toEqual(["accounting_summary"]);
  });
  it("keeps self payslips in personal without granting accounting analytics", () => {
    const account = user(["payslip.self.view"]);
    expect(dashboardModulesFor(account).map((module) => module.id)).toEqual(["attendance"]);
    expect(analyticsDefinitionsFor(account, defaultSystemSettings.modules)).toEqual([]);
  });
  it("supports multiple permitted modules without mixing notification or audit widgets", () => {
    const account = user(["employee.view", "warehouse.view", "payroll.view", "audit.view", "notification.view"]);
    expect(dashboardModulesFor(account).map((module) => module.id)).toEqual(["human-resources", "warehouse", "accounting"]);
    expect(analyticsDefinitionsFor(account, defaultSystemSettings.modules).map((widget) => widget.key).sort()).toEqual(["accounting_summary", "hr_summary", "warehouse_low_stock"]);
  });

});
