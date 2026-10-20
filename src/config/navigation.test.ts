import { describe, expect, it } from "vitest";

import {
  desktopNavigation,
  filterGroupsByPermissions,
  isNavigationItemActive
} from "@/config/navigation";
import type { Permission } from "@/lib/auth/permissions";
import { employeeBaselinePermissions } from "@/services/authorization/employeeAccessPolicy";

describe("permission-aware navigation", () => {
  it("uses a distinct semantic icon for every sibling navigation item", () => {
    for (const group of desktopNavigation) {
      const icons = group.items.map((item) => item.icon);
      expect(new Set(icons).size, `Nhóm ${group.label} có icon trùng`).toBe(icons.length);
    }
  });

  it("hides navigation items when permission is missing", () => {
    const permissions: Permission[] = ["dashboard.view", "employee.view"];
    const groups = filterGroupsByPermissions(desktopNavigation, permissions);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));

    expect(labels).toContain("Dashboard");
    expect(labels).toContain("Nhân viên");
    expect(labels).not.toContain("Thông quan");
    expect(labels).not.toContain("Hàng hóa");
    expect(labels).not.toContain("Audit log");
  });

  it("shows organization management with its dedicated permissions", () => {
    const groups = filterGroupsByPermissions(desktopNavigation, ["department.manage", "position.manage"]);
    const labels = groups.flatMap((group) => group.items.map((item) => item.label));
    expect(labels).toContain("Phòng ban");
    expect(labels).toContain("Chức vụ");
    expect(labels).not.toContain("Hồ sơ nhân viên");
  });

  it("keeps payroll navigation focused on periods and salary profiles", () => {
    const salaryProfile = filterGroupsByPermissions(desktopNavigation, ["salary.view"]);
    const payroll = filterGroupsByPermissions(desktopNavigation, ["payroll.view"]);
    const history = filterGroupsByPermissions(desktopNavigation, ["salary.history.view"]);
    expect(salaryProfile.flatMap((group) => group.items.map((item) => item.href))).toContain("/accounting/salaries");
    expect(payroll.flatMap((group) => group.items.map((item) => item.href))).toContain("/accounting/payroll");
    expect(history.flatMap((group) => group.items.map((item) => item.href))).not.toContain("/accounting/salary-history");
  });

  it("shows attendance period management with its dedicated permission", () => {
    const groups = filterGroupsByPermissions(desktopNavigation, ["attendance.period.manage"]);
    const paths = groups.flatMap((group) => group.items.map((item) => item.href));
    expect(paths).toContain("/timesheets");
    expect(paths).toContain("/timesheets/matrix");
    expect(paths).not.toContain("/attendance/me");
  });

  it("hides HR and attendance administration from ordinary employees", () => {
    const paths = filterGroupsByPermissions(desktopNavigation, employeeBaselinePermissions)
      .flatMap((group) => group.items.map((item) => item.href));
    expect(paths).toContain("/attendance/me");
    expect(paths).toContain("/attendance/history");
    expect(paths).not.toContain("/employees");
    expect(paths).not.toContain("/attendance/today");
    expect(paths).not.toContain("/timesheets");
    expect(paths).not.toContain("/timesheets/matrix");
  });

  it("detects active nested routes without local navigation state", () => {
    expect(
      isNavigationItemActive("/employees/NV001/profile", {
        href: "/employees"
      })
    ).toBe(true);
    expect(
      isNavigationItemActive("/attendance", {
        href: "/attendance/me",
        exact: true
      })
    ).toBe(false);
    expect(
      isNavigationItemActive("/projects/updates", {
        href: "/projects",
        exact: true
      })
    ).toBe(false);
    expect(
      isNavigationItemActive("/projects/updates", {
        href: "/projects/updates"
      })
    ).toBe(true);
  });
});
