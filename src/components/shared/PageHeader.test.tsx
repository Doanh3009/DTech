import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityContextHeader, PageHeader, ResponsivePageHeader } from "@/components/shared/PageHeader";

describe("PageHeader", () => {
  it("renders the route title exactly once as h1", () => {
    render(<PageHeader title="Quản lý xuất nhập khẩu" />);
    expect(screen.getAllByText("Quản lý xuất nhập khẩu")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Quản lý xuất nhập khẩu" })).toBeInTheDocument();
  });

  it("keeps the canonical responsive name compatible", () => {
    render(<ResponsivePageHeader title="Danh sách nhân viên" />);
    expect(screen.getByRole("heading", { level: 1, name: "Danh sách nhân viên" })).toBeInTheDocument();
  });

  it("composes entity identity, status and actions without duplicating the title", () => {
    render(
      <EntityContextHeader
        action={<button type="button">Thông tin gói</button>}
        code="CT-01"
        meta="Cảng ABC · 12 nhân sự"
        status={<span>Đang thi công</span>}
        title="Bảo trì hệ thống ray"
      />
    );

    expect(screen.getAllByText("Bảo trì hệ thống ray")).toHaveLength(1);
    expect(screen.getByRole("toolbar", { name: "Thao tác đối tượng" })).toBeInTheDocument();
  });
});
