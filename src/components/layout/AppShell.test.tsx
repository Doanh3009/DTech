import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { defaultSystemSettings } from "@/config/systemSettings";
import type { AuthenticatedUser } from "@/lib/auth/permissions";

const route = vi.hoisted(() => ({ pathname: "/accounting/payroll" }));

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() })
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/components/providers/SystemSettingsProvider", () => ({
  useSystemSettings: () => ({ settings: defaultSystemSettings })
}));
vi.mock("@/components/providers/CurrentUserProvider", () => ({
  CurrentUserProvider: ({ children }: { children: ReactNode }) => children
}));
vi.mock("@/components/providers/RealtimeProvider", () => ({
  RealtimeProvider: ({ children }: { children: ReactNode }) => children,
  useRealtimeConnectionState: () => "connected"
}));
vi.mock("@/components/layout/MobileNavigationContext", () => ({
  MobileNavigationProvider: ({ children }: { children: ReactNode }) => children
}));
vi.mock("@/components/layout/AppHeader", () => ({
  AppHeader: () => <header>Châu Tuấn</header>,
  isMobileHeaderRootScreen: () => false
}));
vi.mock("@/components/layout/AppRail", () => ({
  AppRail: () => <aside><a href="#period-list">Kỳ lương</a></aside>
}));
vi.mock("@/features/shared-platforms/components/SystemNoticeBanner", () => ({ SystemNoticeBanner: () => null }));
vi.mock("@/lib/navigation/backHistory", () => ({ installBackHistory: () => () => undefined }));
vi.mock("@/lib/ui/workspacePreferencesRequest", () => ({ readWorkspacePreferences: async () => undefined }));
vi.mock("@/lib/ui/pageEntryMotion", () => ({ animatePageEntry: vi.fn(), supportsPageViewTransitions: () => true }));

const user: AuthenticatedUser = {
  id: "shell-review-account", displayName: "Kế toán", username: "accountant", email: "accountant@example.com", status: "active", permissions: ["payroll.view"]
};

describe("AppShell keyboard navigation", () => {
  it("opens the module gateway without a business sidebar", () => {
    route.pathname = "/applications";
    render(<AppShell user={user}><h1>Không gian làm việc</h1></AppShell>);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Không gian làm việc");
    route.pathname = "/accounting/payroll";
  });
  it("offers a direct route to the existing main content before the navigation", async () => {
    render(<AppShell user={user}><h1>Bảng lương</h1><input aria-label="Tìm nhân viên" defaultValue="Đơn đang soạn" /></AppShell>);
    const skip = screen.getByRole("link", { name: "Đến nội dung chính" });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(screen.getAllByRole("link")[0]).toBe(skip);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(screen.getByLabelText("Tìm nhân viên")).toHaveValue("Đơn đang soạn"));
  });
});
