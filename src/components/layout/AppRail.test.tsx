import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppRail } from "@/components/layout/AppRail";
import { defaultSystemSettings } from "@/config/systemSettings";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

vi.mock("@/components/providers/SystemSettingsProvider", () => ({
  useSystemSettings: () => ({ settings: defaultSystemSettings })
}));

vi.mock("@/components/layout/AppLogo", () => ({
  AppLogo: () => <a href="/dashboard">Châu Tuấn</a>
}));

const user: AuthenticatedUser = {
  id: "account-1",
  displayName: "Nguyễn Văn Cường",
  username: "cuong",
  email: "cuong@example.com",
  status: "active",
  permissions: ["employee.view"]
};

describe("AppRail", () => {
  it("contains only the current module navigation in the sidebar", () => {
    const onCollapsedChange = vi.fn();
    render(<AppRail collapsed={false} onCollapsedChange={onCollapsedChange} pathname="/employees" user={user} />);

    expect(screen.getByRole("complementary", { name: "Điều hướng Nhân sự" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mở danh sách ứng dụng" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nhân viên" })).toHaveAttribute("href", "/employees");

    fireEvent.click(screen.getByRole("button", { name: "Thu gọn điều hướng" }));
    expect(onCollapsedChange).toHaveBeenCalledWith(true);
  });

  it("keeps every accessible function available when the rail is collapsed", () => {
    render(<AppRail collapsed onCollapsedChange={vi.fn()} pathname="/employees" user={user} />);

    const employeeLink = screen.getByRole("link", { name: "Nhân viên" });
    expect(employeeLink).toHaveAttribute("href", "/employees");
    expect(screen.getByRole("link", { name: "Phòng ban" })).toHaveAttribute("href", "/employees/departments");
    expect(screen.getByRole("link", { name: "Chức vụ" })).toHaveAttribute("href", "/employees/positions");
    fireEvent.focus(employeeLink);
    expect(employeeLink).toHaveAttribute("aria-describedby", screen.getByRole("tooltip", { name: "Nhân viên" }).id);
  });
});
