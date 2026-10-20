import { describe, expect, it } from "vitest";

import { employeeDetailSections, getBackHref, getBreadcrumbs, getRouteMeta, projectDetailSections } from "@/config/routeRegistry";

describe("route registry", () => {
  it("returns metadata for exact routes", () => {
    expect(getRouteMeta("/warehouse/items")).toMatchObject({
      title: "Hàng hóa",
      module: "Kho"
    });
    expect(getRouteMeta("/projects/new")).toMatchObject({
      title: "Tạo gói",
      module: "Gói / Công trường"
    });
    expect(getBackHref("/projects/new")).toBe("/projects");
  });

  it("builds breadcrumbs for employee route-backed tabs", () => {
    expect(getBreadcrumbs("/employees/NV001/contracts")).toEqual([
      { label: "Nhân sự", href: "/employees" },
      { label: "NV001", href: "/employees/NV001/profile" },
      { label: "Hợp đồng" }
    ]);
  });

  it("keeps attendance and project history as route-backed employee tabs", () => {
    expect(employeeDetailSections).toEqual(expect.arrayContaining([
      { value: "attendance", label: "Chấm công" },
      { value: "history", label: "Lịch sử" }
    ]));
  });

  it("uses the field-operation package workspaces in business order", () => {
    expect(projectDetailSections).toEqual([
      { value: "today", label: "Hôm nay" },
      { value: "progress", label: "Thi công" },
      { value: "team", label: "Nhân lực" },
      { value: "materials", label: "Vật tư" },
      { value: "profile", label: "Thông tin" },
      { value: "documents", label: "Tài liệu" }
    ]);
    expect(getBreadcrumbs("/projects/package-1/documents")).toEqual([
      { label: "Gói / Công trường", href: "/projects" },
      { label: "package-1", href: "/projects/package-1/today" },
      { label: "Tài liệu" }
    ]);
  });

  it("hides a breadcrumb that only repeats the current page", () => {
    expect(getBreadcrumbs("/dashboard")).toEqual([]);
  });

  it("keeps warehouse edit routes in the warehouse context", () => {
    expect(getRouteMeta("/warehouse/items/57a/edit")).toMatchObject({
      title: "Chỉnh sửa hàng hóa",
      module: "Kho"
    });
  });

  it("names an employee payroll detail in its accounting context", () => {
    expect(getRouteMeta("/accounting/payroll/period-1/employees/employee-1")).toEqual({
      title: "Phiếu lương nhân viên", description: "", module: "Kế toán"
    });
    expect(getBackHref("/accounting/payroll/period-1/employees/employee-1")).toBe("/accounting/payroll/period-1");
  });

  it("resolves a stable return route for every navigation depth", () => {
    expect(getBackHref("/employees/NV001/contracts")).toBe("/employees/NV001/profile");
    expect(getBackHref("/warehouse/items/57/edit")).toBe("/warehouse/items/57");
    expect(getBackHref("/timesheets/periods/period-1/employees/employee-1")).toBe("/timesheets/periods/period-1");
    expect(getBackHref("/employees")).toBeNull();
    expect(getBackHref("/attendance/me")).toBeNull();
    expect(getBackHref("/attendance/history")).toBeNull();
    expect(getBackHref("/attendance/today")).toBeNull();
    expect(getBackHref("/attendance/logs")).toBe("/attendance/today");
    expect(getBackHref("/attendance/records/event-1")).toBe("/attendance/logs");
    expect(getBackHref("/warehouse/inventory")).toBeNull();
    expect(getBackHref("/dashboard")).toBeNull();
  });
});
