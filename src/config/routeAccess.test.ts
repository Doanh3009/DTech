import { describe, expect, it } from "vitest";
import { hasAreaAccess } from "@/config/routeAccess";
import { employeeBaselinePermissions } from "@/services/authorization/employeeAccessPolicy";
import { getEffectivePermissions } from "@/services/authorization/rbacService";

describe("route area access", () => {
  it("allows an area when one scoped permission matches", () => {
    expect(hasAreaAccess(["attendance.self.view"], "attendance")).toBe(true);
    expect(hasAreaAccess(["warehouse.item.view"], "warehouse")).toBe(true);
  });

  it("denies unrelated direct route access", () => {
    expect(hasAreaAccess(["profile.view"], "warehouse")).toBe(false);
    expect(hasAreaAccess(["dashboard.view"], "settings")).toBe(false);
  });
});

describe("HR route authorization", () => {
  it("blocks employees from HR and administrative attendance routes", () => {
    expect(hasAreaAccess(employeeBaselinePermissions, "employees")).toBe(false);
    expect(hasAreaAccess(employeeBaselinePermissions, "attendance-admin")).toBe(false);
    expect(hasAreaAccess(employeeBaselinePermissions, "timesheets")).toBe(false);
    expect(hasAreaAccess(employeeBaselinePermissions, "attendance")).toBe(true);
  });

  it("allows HR and admin to open personnel and attendance administration", () => {
    for (const role of ["role-hr", "role-admin"]) {
      const permissions = getEffectivePermissions([role]);
      expect(hasAreaAccess(permissions, "employees")).toBe(true);
      expect(hasAreaAccess(permissions, "attendance-admin")).toBe(true);
      expect(hasAreaAccess(permissions, "timesheets")).toBe(true);
    }
  });

  it("keeps supervisors within project and worker attendance scopes", () => {
    const permissions = getEffectivePermissions(["role-supervisor"]);
    expect(hasAreaAccess(permissions, "employees")).toBe(false);
    expect(hasAreaAccess(permissions, "projects")).toBe(true);
    expect(hasAreaAccess(permissions, "worker-attendance")).toBe(true);
  });

  it("requires managed scope even when legacy personal timesheet access is present", () => {
    expect(hasAreaAccess(["timesheet.view", "timesheet.self.view"], "timesheets")).toBe(false);
    expect(hasAreaAccess(["timesheet.view_team"], "timesheets")).toBe(true);
    expect(hasAreaAccess(["attendance.period.manage"], "timesheets")).toBe(true);
  });
});
