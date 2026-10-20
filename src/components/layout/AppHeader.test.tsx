import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "@/components/layout/AppHeader";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

vi.mock("@/components/providers/SystemSettingsProvider", () => ({
  useBranding: () => ({ systemName: "Hệ thống nội bộ Châu Tuấn" }),
  useOrganizationSettings: () => ({ shortName: "Châu Tuấn" })
}));
vi.mock("@/components/layout/AppLogo", () => ({
  AppLogo: () => <span aria-label="Châu Tuấn" />
}));
vi.mock("@/components/layout/MobileAppLauncher", () => ({
  MobileAppLauncher: () => <button aria-label="Mở Ứng dụng của tôi" />
}));
vi.mock("@/features/search/components/CommandPalette", () => ({
  CommandPalette: () => <button>Tìm kiếm</button>
}));
vi.mock("@/features/shared-platforms/components/NotificationBell", () => ({
  NotificationBell: () => <button>Thông báo</button>
}));
vi.mock("@/components/shared/UserMenu", () => ({
  UserMenu: () => <button>Tài khoản</button>
}));

const user: AuthenticatedUser = { id: "account-1", displayName: "Nguyễn Thị Thúy Hằng", username: "thuyhang", email: "hang@example.com", status: "active", permissions: [] };

describe("AppHeader", () => {
  it("renders the brand and launcher on a mobile root screen", () => {
    render(<AppHeader connectionState="connected" pathname="/dashboard" user={user} />);
    expect(screen.getByText("Châu Tuấn")).toBeInTheDocument();
    expect(screen.queryByText("Đồng bộ tức thời")).not.toBeInTheDocument();
    expect(screen.getByText("Tìm kiếm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mở Ứng dụng của tôi" })).toBeInTheDocument();
  });

  it("keeps the module launcher on non-dashboard screens", () => {
    render(<AppHeader connectionState="connected" pathname="/employees" user={user} />);
    expect(screen.getByRole("navigation", { name: "Vị trí hiện tại" })).toHaveTextContent("Nhân viên");
    expect(screen.getByRole("button", { name: "Mở Ứng dụng của tôi" })).toBeInTheDocument();
  });

  it("uses a local return target when a screen provides one", () => {
    render(<AppHeader backHrefOverride="/projects" connectionState="connected" pathname="/worker-attendance/today" user={user} />);
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/projects");
  });

  it("only shows realtime state when the connection needs attention", () => {
    const { rerender } = render(<AppHeader connectionState="reconnecting" pathname="/dashboard" user={user} />);
    expect(screen.getByText("Đang thử kết nối lại…")).toBeInTheDocument();
    rerender(<AppHeader connectionState="offline" pathname="/dashboard" user={user} />);
    expect(screen.getByText("Mất kết nối")).toBeInTheDocument();
  });
});
