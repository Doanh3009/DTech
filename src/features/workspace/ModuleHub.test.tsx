import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { SystemSettingsProvider } from "@/components/providers/SystemSettingsProvider";
import { defaultSystemSettings } from "@/config/systemSettings";
import type { Permission } from "@/lib/auth/permissions";
import { ModuleHub } from "./ModuleHub";

vi.mock("@/components/shared/LinkLoadingIndicator", () => ({ LinkLoadingIndicator: () => null }));

function renderHub(permissions: Permission[], warehouse = true) {
  const settings = structuredClone(defaultSystemSettings);
  settings.modules.warehouse = warehouse;
  return render(<SystemSettingsProvider initialSettings={settings}><CurrentUserProvider user={{ id: "hub-test", displayName: "Người dùng", username: "user", email: "user@example.invalid", status: "active", permissions }}><ModuleHub /></CurrentUserProvider></SystemSettingsProvider>);
}

describe("module gateway", () => {
  it("uses one icon and a whole-card link without nested loading buttons", () => {
    renderHub(["warehouse.view"]);
    const card=screen.getByRole("link", { name: "Kho" });
    expect(card.querySelectorAll("svg")).toHaveLength(1);
    expect(card.querySelector("button, [role='status']")).toBeNull();
  });
  it("omits the category filter and Dashboard application", () => {
    renderHub(["dashboard.view", "warehouse.view"]);
    expect(screen.queryByRole("button", { name: "Tất cả" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kho" })).toBeInTheDocument();
  });
  it("shows only enabled and authorized modules and keeps admin controls private", () => {
    renderHub(["warehouse.view", "employee.view"], false);
    expect(screen.getByRole("link", { name: "Nhân sự" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kho" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cấu hình doanh nghiệp" })).not.toBeInTheDocument();
  });
  it("filters Vietnamese names without accents and recovers from an empty result", () => {
    renderHub(["employee.view", "warehouse.view"]);
    const input = screen.getByRole("searchbox", { name: "Tìm module" });
    fireEvent.change(input, { target: { value: "nhan su" } });
    expect(screen.getByRole("link", { name: "Nhân sự" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Kho" })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "khongco" } });
    expect(screen.getByRole("heading", { name: "Không tìm thấy module" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(screen.getByRole("link", { name: "Kho" })).toBeInTheDocument();
    expect(input).toHaveValue("");
  });
  it("offers no clickable application to an account with no assigned permissions", () => {
    renderHub([]);
    expect(screen.getByRole("heading", { name: "Chưa có module được cấp quyền" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nhân sự" })).not.toBeInTheDocument();
  });
  it("opens the setup wizard only for admins with every setup permission", () => {
    renderHub(["system_admin.access", "branding.manage", "organization_settings.manage", "localization.manage", "module.manage"]);
    expect(screen.getByRole("link", { name: "Thiết lập ERP" })).toHaveAttribute("href", "/system-admin/setup");
  });
  it("keeps module-only configuration available for an admin without company setup permissions", () => {
    renderHub(["system_admin.access", "module.manage"]);
    expect(screen.getByRole("link", { name: "Module" })).toHaveAttribute("href", "/system-admin/modules");
    expect(screen.queryByRole("link", { name: "Thiết lập ERP" })).not.toBeInTheDocument();
  });
});
