import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { SystemSettingsProvider } from "@/components/providers/SystemSettingsProvider";
import { defaultSystemSettings } from "@/config/systemSettings";
import { allFoundationPermissions } from "@/lib/auth/permissions";
import { ModulesPage } from "./ModulesPage";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

function renderEditor() {
  return render(<SystemSettingsProvider initialSettings={structuredClone(defaultSystemSettings)}><CurrentUserProvider user={{ id: "erp-admin", displayName: "Admin", username: "admin", email: "admin@example.invalid", status: "active", permissions: allFoundationPermissions }}><ModulesPage /></CurrentUserProvider></SystemSettingsProvider>);
}

describe("industry module setup", () => {
  it("requires applying and saving a profile, then persists the chosen industry and adjustments together", async () => {
    const fetch = vi.fn().mockImplementation(async (_url, options) => ({ ok: true, json: async () => ({ ok: true, data: { value: JSON.parse(options.body) } }) }));
    vi.stubGlobal("fetch", fetch);
    renderEditor();
    fireEvent.click(screen.getByRole("radio", { name: "May mặc" }));
    expect(screen.getByRole("button", { name: "Lưu cấu hình ERP" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng gói May mặc" }));
    expect(screen.getByRole("switch", { name: "Dự án & Công trường" })).toHaveAttribute("aria-checked", "false");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "Kho & Vật tư" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình ERP" }));
    await screen.findByText("Đã cập nhật cấu hình.");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/system-settings/modules");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ industryPreset: "garment", projects: false, warehouse: false, accounting: true });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Lưu cấu hình ERP" })).toBeDisabled();
  });

  it("preserves unsaved choices after a failed save and can reset them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Không thể lưu")));
    renderEditor();
    fireEvent.click(screen.getByRole("switch", { name: "Kho & Vật tư" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình ERP" }));
    await screen.findByText("Không thể lưu");
    expect(screen.getByRole("switch", { name: "Kho & Vật tư" })).toHaveAttribute("aria-checked", "false");
    await waitFor(() => expect(screen.getByRole("button", { name: "Hoàn tác" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(screen.getByRole("switch", { name: "Kho & Vật tư" })).toHaveAttribute("aria-checked", "true");
    expect(refresh).not.toHaveBeenCalled();
  });
});
