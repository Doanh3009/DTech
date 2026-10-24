import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrentUserProvider } from "@/components/providers/CurrentUserProvider";
import { SystemSettingsProvider, useSystemSettings } from "@/components/providers/SystemSettingsProvider";
import { defaultSystemSettings, type SystemSettingsDocument } from "@/config/systemSettings";
import { allFoundationPermissions, type Permission } from "@/lib/auth/permissions";
import { setupDraftStorageKey } from "@/features/system-admin/setupDraft";
import { SetupPage } from "./SetupPage";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => { window.localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });

function snapshot(ready = true) {
  const settings = structuredClone(defaultSystemSettings);
  settings.branding = { ...settings.branding, systemName: "Khách hàng ERP", logoMainUrl: "/brand/saved-logo.png", logoCompactUrl: "https://assets.example.invalid/compact.png", logoDarkUrl: "/brand/saved-dark.png", faviconUrl: "/brand/favicon.png", assetVersion: 7 };
  settings.organization = { companyName: "Công ty đã cấu hình", shortName: "CONGTY", address: "Địa chỉ giữ lại", phone: "0900000001", email: "saved@example.invalid", taxCode: "TAX-EXISTING", representativeName: "Người đã lưu" };
  return { settings, versions: { branding: 4, organization: 7, localization: 2, modules: 8, appearance: 1, navigation: 1, dashboard: 1, payslip: 1 }, ready };
}

function ok(data: unknown) { return { ok: true, status: 200, json: async () => ({ ok: true, data }) }; }
function failure(status: number, message: string) { return { ok: false, status, json: async () => ({ ok: false, error: { message } }) }; }

function SettingsObserver() {
  const { settings } = useSystemSettings();
  return <output aria-label="Thương hiệu đang dùng">{settings.branding.systemName}</output>;
}

function renderSetup(permissions: readonly Permission[] = allFoundationPermissions, userId = "setup-admin") {
  return render(<SystemSettingsProvider initialSettings={structuredClone(defaultSystemSettings)}><CurrentUserProvider user={{ id: userId, displayName: "Admin", username: "admin", email: "admin@example.invalid", status: "active", permissions: [...permissions] }}><SetupPage /><SettingsObserver /></CurrentUserProvider></SystemSettingsProvider>);
}

async function waitForLoad() { await screen.findByRole("textbox", { name: "Tên công ty" }); }
function next() { fireEvent.click(screen.getByRole("button", { name: "Tiếp tục" })); }
function reachConfirmation() { next(); next(); next(); }
function confirmAndPublish() {
  fireEvent.click(screen.getByRole("checkbox", { name: "Xác nhận xuất bản cấu hình" }));
  fireEvent.click(screen.getByRole("button", { name: "Xuất bản cấu hình" }));
}

describe("ERP setup wizard", () => {
  it("loads the saved snapshot and preserves contact and logo fields through one atomic publication", async () => {
    const saved = snapshot();
    const fetch = vi.fn().mockImplementation(async (_url, init?: RequestInit) => {
      if (init?.method !== "POST") return ok(saved);
      const command = JSON.parse(String(init.body));
      return ok({ ...saved, settings: { ...saved.settings, ...command.groups }, versions: { ...saved.versions, branding: 5, organization: 8, localization: 3, modules: 9 } });
    });
    vi.stubGlobal("fetch", fetch);
    renderSetup();
    await waitForLoad();
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveValue(saved.settings.organization.companyName);
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Công ty triển khai mới" } });
    next();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên hiển thị hệ thống" }), { target: { value: "Thương hiệu mới ERP" } });
    expect(screen.getAllByText("Đã thiết lập")).toHaveLength(4);
    next();
    fireEvent.click(screen.getByRole("radio", { name: "May mặc" }));
    expect(screen.getByRole("switch", { name: "Dự án & Công trường" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng gói May mặc" }));
    expect(screen.getByRole("switch", { name: "Dự án & Công trường" })).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("switch", { name: "Kho & Vật tư" }));
    next();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Xuất bản cấu hình" })).toBeDisabled();
    confirmAndPublish();
    await screen.findByText("Đã xuất bản cấu hình ERP.");
    const [, init] = fetch.mock.calls[1];
    const command = JSON.parse(String(init.body));
    expect(command).toMatchObject({ requestId: expect.any(String), changeType: "publish", expectedVersions: { branding: 4, organization: 7, localization: 2, modules: 8 } });
    expect(command.groups.organization).toEqual({ ...saved.settings.organization, companyName: "Công ty triển khai mới" });
    expect(command.groups.branding).toEqual({ ...saved.settings.branding, systemName: "Thương hiệu mới ERP" });
    expect(command.groups.localization).toEqual(saved.settings.localization);
    expect(command.groups.modules).toMatchObject({ industryPreset: "garment", projects: false, warehouse: false });
    expect(Object.keys(command.groups).sort()).toEqual(["branding", "localization", "modules", "organization"]);
    expect(screen.getByLabelText("Thương hiệu đang dùng")).toHaveTextContent("Thương hiệu mới ERP");
    expect(screen.getByRole("button", { name: "Xuất bản cấu hình" })).toBeDisabled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the same request and snapshot for retry after a lost response", async () => {
    const saved = snapshot();
    const fetch = vi.fn().mockResolvedValueOnce(ok(saved)).mockRejectedValueOnce(new Error("Mất kết nối khi xuất bản")).mockResolvedValueOnce(ok(saved));
    vi.stubGlobal("fetch", fetch);
    renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Bản nháp giữ lại" } });
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Mất kết nối khi xuất bản");
    expect(screen.getByText("Bản nháp giữ lại")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.getByRole("switch", { name: "Kho & Vật tư" })).toBeDisabled();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Thử xuất bản lại" }));
    await screen.findByText("Đã xuất bản cấu hình ERP.");
    expect(fetch.mock.calls[1][1]?.body).toBe(fetch.mock.calls[2][1]?.body);
  });

  it("retains the draft on conflict and only rebases after explicit reload confirmation", async () => {
    const saved = snapshot();
    const latest = snapshot();
    latest.settings.organization.companyName = "Bản đã lưu bởi quản trị khác";
    latest.versions.organization = 10;
    const fetch = vi.fn().mockResolvedValueOnce(ok(saved)).mockResolvedValueOnce(failure(409, "Cấu hình đã thay đổi. Vui lòng tải lại.")).mockResolvedValueOnce(ok(latest));
    vi.stubGlobal("fetch", fetch);
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Bản nháp của tôi" } });
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Cấu hình đã thay đổi. Vui lòng tải lại.");
    expect(screen.getByText("Bản nháp của tôi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại cấu hình" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Bản nháp của tôi")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại cấu hình" }));
    await screen.findByText("Bản đã lưu bởi quản trị khác");
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("checkbox", { name: "Xác nhận xuất bản cấu hình" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Xuất bản cấu hình" })).toBeDisabled();
    expect(screen.getByText("v10")).toBeInTheDocument();
  });

  it("disables publication while the atomic settings database upgrade is pending", async () => {
    const fetch = vi.fn().mockResolvedValue(ok(snapshot(false)));
    vi.stubGlobal("fetch", fetch);
    renderSetup();
    await waitForLoad();
    expect(screen.getByText("Chờ cập nhật hệ thống")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Bản nháp hợp lệ" } });
    reachConfirmation();
    expect(screen.getByRole("checkbox", { name: "Xác nhận xuất bản cấu hình" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xuất bản cấu hình" })).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("publishes all nine module flags when loading an older configuration", async () => {
    const saved = snapshot();
    delete saved.settings.modules.accounting;
    delete saved.settings.modules.operations;
    delete saved.settings.modules.messaging;
    saved.settings.modules.warehouse = false;
    const fetch = vi.fn().mockResolvedValueOnce(ok(saved)).mockResolvedValueOnce(failure(409, "Phiên bản đã thay đổi."));
    vi.stubGlobal("fetch", fetch);
    renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Doanh nghiệp nâng cấp" } });
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Phiên bản đã thay đổi.");
    const modules = JSON.parse(String(fetch.mock.calls[1][1]?.body)).groups.modules;
    expect(modules).toMatchObject({ accounting: true, operations: true, messaging: true, warehouse: false });
    expect(Object.values(modules).filter((value) => typeof value === "boolean")).toHaveLength(9);
  });

  it("validates required information before advancing and retains valid entries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(snapshot())));
    renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "A" } });
    next();
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("link", { name: "Tên công ty: Giá trị không hợp lệ." })).toHaveAttribute("href", "#setup-organization-companyName");
    expect(screen.queryByRole("textbox", { name: "Tên hiển thị hệ thống" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Tên đã sửa" } });
    next();
    expect(screen.getByRole("textbox", { name: "Tên hiển thị hệ thống" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại" }));
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveValue("Tên đã sửa");
  });

  it("does not load or expose configuration when any required permission is missing", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    renderSetup(allFoundationPermissions.filter((permission) => permission !== "branding.manage"));
    expect(screen.getByText("Không có quyền truy cập")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Tên công ty" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows load failure and retries without substituting default customer settings", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("Không thể đọc máy chủ cấu hình")).mockResolvedValueOnce(ok(snapshot()));
    vi.stubGlobal("fetch", fetch);
    renderSetup();
    await screen.findByText("Không thể đọc máy chủ cấu hình");
    expect(screen.queryByRole("textbox", { name: "Tên công ty" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại cấu hình" }));
    await waitForLoad();
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveValue("Công ty đã cấu hình");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects an invalid snapshot instead of filling missing values from defaults", async () => {
    const invalid = snapshot();
    invalid.settings.branding = undefined as unknown as SystemSettingsDocument["branding"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(invalid)));
    renderSetup();
    await screen.findByText("Cấu hình ERP không hợp lệ. Vui lòng tải lại.");
    expect(screen.queryByRole("textbox", { name: "Tên công ty" })).not.toBeInTheDocument();
  });

  it("saves an explicit browser draft and resumes its original versions after a server change", async () => {
    const original = snapshot();
    const updated = snapshot();
    updated.settings.organization.companyName = "Công ty trên máy chủ mới";
    updated.versions.organization = 11;
    const fetch = vi.fn().mockResolvedValueOnce(ok(original)).mockResolvedValueOnce(ok(updated)).mockResolvedValueOnce(failure(409, "Bản nháp cần đối chiếu lại."));
    vi.stubGlobal("fetch", fetch);
    const first = renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Công ty trong bản nháp" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
    await screen.findByText("Đã lưu bản nháp trên trình duyệt.");
    expect(fetch).toHaveBeenCalledTimes(1);
    first.unmount();
    renderSetup();
    await waitForLoad();
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveValue("Công ty trên máy chủ mới");
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục bản nháp" }));
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveValue("Công ty trong bản nháp");
    expect(screen.getByText("Máy chủ có cấu hình mới")).toBeInTheDocument();
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Bản nháp cần đối chiếu lại.");
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body)).expectedVersions.organization).toBe(7);
  });

  it("resumes a pending command after a page reload with the same immutable request body", async () => {
    const saved = snapshot();
    const fetch = vi.fn().mockResolvedValueOnce(ok(saved)).mockRejectedValueOnce(new Error("Chưa nhận được kết quả")).mockResolvedValueOnce(ok(saved)).mockResolvedValueOnce(ok(saved));
    vi.stubGlobal("fetch", fetch);
    const first = renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "  Bản nháp đang gửi  " } });
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Chưa nhận được kết quả");
    const originalCommand = fetch.mock.calls[1][1]?.body;
    first.unmount();
    renderSetup();
    await waitForLoad();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục bản nháp" }));
    expect(screen.getByRole("checkbox", { name: "Xác nhận xuất bản cấu hình" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Xác nhận xuất bản cấu hình" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Thử xuất bản lại" }));
    await screen.findByText("Đã xuất bản cấu hình ERP.");
    expect(fetch.mock.calls[3][1]?.body).toBe(originalCommand);
    expect(screen.queryByRole("button", { name: "Tiếp tục bản nháp" })).not.toBeInTheDocument();
  });

  it("does not expose another account's browser draft", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => ok(snapshot())));
    const first = renderSetup(allFoundationPermissions, "first-admin");
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Bản nháp riêng" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
    first.unmount();
    renderSetup(allFoundationPermissions, "second-admin");
    await waitForLoad();
    expect(screen.queryByRole("button", { name: "Tiếp tục bản nháp" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Tên công ty" })).toHaveValue("Công ty đã cấu hình");
  });

  it("rejects a corrupt browser draft and removes it only after explicit discard", async () => {
    const key = setupDraftStorageKey("setup-admin", window.location.origin, new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? window.location.origin).origin);
    window.localStorage.setItem(key, "{broken-json");
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const fetch = vi.fn().mockImplementation(async () => ok(snapshot()));
    vi.stubGlobal("fetch", fetch);
    renderSetup();
    await waitForLoad();
    expect(screen.getByText("Bản nháp trên trình duyệt không hợp lệ.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục bản nháp" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ bản nháp" }));
    expect(window.localStorage.getItem(key)).toBe("{broken-json");
    fireEvent.click(screen.getByRole("button", { name: "Bỏ bản nháp" }));
    await screen.findByRole("textbox", { name: "Tên công ty" });
    await waitFor(() => expect(window.localStorage.getItem(key)).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it("does not send a publication if the pending request cannot be durably saved", async () => {
    const fetch = vi.fn().mockResolvedValue(ok(snapshot()));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Bản nháp chưa gửi" } });
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Không thể lưu bản nháp trên trình duyệt.");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("retains the pending draft after failed reload and deletes it after successful confirmed reload", async () => {
    const saved = snapshot();
    const fetch = vi.fn().mockResolvedValueOnce(ok(saved)).mockRejectedValueOnce(new Error("Chưa nhận kết quả xuất bản")).mockRejectedValueOnce(new Error("Tải lại chưa thành công")).mockResolvedValueOnce(ok(saved));
    vi.stubGlobal("fetch", fetch);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderSetup();
    await waitForLoad();
    fireEvent.change(screen.getByRole("textbox", { name: "Tên công ty" }), { target: { value: "Bản nháp đang chờ" } });
    reachConfirmation();
    confirmAndPublish();
    await screen.findByText("Chưa nhận kết quả xuất bản");
    const storedBefore = window.localStorage.getItem(window.localStorage.key(0)!);
    expect(storedBefore).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại cấu hình" }));
    await screen.findByText("Tải lại chưa thành công");
    expect(window.localStorage.getItem(window.localStorage.key(0)!)).toBe(storedBefore);
    expect(screen.getByRole("button", { name: "Thử xuất bản lại" })).toBeInTheDocument();
    expect(screen.getByText("Bản nháp đang chờ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại cấu hình" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Tiếp tục bản nháp" })).not.toBeInTheDocument());
    expect(window.localStorage.length).toBe(0);
    expect(screen.queryByRole("button", { name: "Thử xuất bản lại" })).not.toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
