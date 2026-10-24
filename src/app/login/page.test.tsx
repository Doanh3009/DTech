import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { defaultSystemSettings } from "@/config/systemSettings";
import { erpModuleKeys } from "@/config/erpModules";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), presentationSettings: vi.fn(), redirect: vi.fn(), testToolsAvailable: vi.fn()
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/services/system-settings/systemSettingsService", () => ({
  readPresentationSettings: mocks.presentationSettings
}));
vi.mock("@/lib/testing/policy.mjs", () => ({ testToolsAvailable: mocks.testToolsAvailable }));
vi.mock("@/features/auth/components/LoginForm", () => ({
  LoginForm: () => <form aria-label="Đăng nhập hệ thống"><button type="submit">Đăng nhập</button></form>
}));
vi.mock("@/features/system-admin/components/LoginBrand", () => ({
  LoginBrand: ({ shortName }: { shortName: string }) => <span role="img" aria-label={shortName} />
}));
vi.mock("@/features/testing/TestAccountPicker", () => ({
  TestAccountPicker: () => <div data-testid="test-account-picker" />
}));

import LoginPage from "./page";

const pageProps = (reason?: string): PageProps<"/login"> => ({
  params: Promise.resolve({}),
  searchParams: Promise.resolve(reason ? { reason } : {})
});

describe("login page settings and session handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","true");
    mocks.user.mockResolvedValue(null);
    mocks.presentationSettings.mockResolvedValue(structuredClone(defaultSystemSettings));
    mocks.testToolsAvailable.mockReturnValue(null);
    mocks.redirect.mockImplementation((destination: string) => { throw new Error(`NEXT_REDIRECT:${destination}`); });
  });
  afterEach(()=>{cleanup();vi.unstubAllEnvs();});
  it("customer login excludes operator marketing and intake links",async()=>{vi.stubEnv("DTECH_CONTROL_CENTER_ENABLED","false");render(await LoginPage(pageProps()));expect(screen.queryByRole("link",{name:"Đăng ký dùng thử cho doanh nghiệp"})).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Giới thiệu DTech ERP"})).not.toBeInTheDocument();});

  it("renders an anonymous login with presentation settings while all modules are disabled", async () => {
    const settings = structuredClone(defaultSystemSettings);
    settings.branding.systemName = "Acme ERP";
    settings.organization.companyName = "Acme Company";
    settings.organization.shortName = "ACME";
    for (const moduleKey of erpModuleKeys) settings.modules[moduleKey] = false;
    mocks.presentationSettings.mockResolvedValue(settings);

    // Resolve the page factory explicitly; this does not exercise Next's RSC runtime.
    render(await LoginPage(pageProps()));

    expect(screen.getByRole("heading", { name: "Đăng nhập", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Đăng nhập hệ thống" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "ACME" })).toBeInTheDocument();
    expect(screen.getAllByText("Acme ERP")).toHaveLength(2);
    expect(screen.getAllByText("Acme Company")).toHaveLength(2);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Giới thiệu DTech ERP" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Đăng ký dùng thử cho doanh nghiệp" })).toHaveAttribute("href", "/dang-ky-dung-thu");
    expect(screen.queryByRole("link", { name: "Module" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("test-account-picker")).not.toBeInTheDocument();
    expect(mocks.presentationSettings).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects an existing session to the module hub", async () => {
    mocks.user.mockResolvedValue({ id: "active-account", status: "active", permissions: [] });

    await expect(LoginPage(pageProps())).rejects.toThrow("NEXT_REDIRECT:/applications");

    expect(mocks.presentationSettings).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/applications");
    expect(mocks.testToolsAvailable).not.toHaveBeenCalled();
  });

  it("shows the expired session state for an anonymous visitor", async () => {
    render(await LoginPage(pageProps("session-expired")));

    expect(screen.getByRole("status")).toHaveTextContent("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    expect(screen.getByRole("form", { name: "Đăng nhập hệ thống" })).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
