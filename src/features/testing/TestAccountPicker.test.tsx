import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { TestAccountPicker } from "./TestAccountPicker";

const accounts = [
  { username: "employee.test", label: "Nhân viên", status: "active" },
  { username: "hr.test", label: "Nhân sự", status: "disabled" }
];
const compactAccounts = [...accounts, { username: "accountant.test", label: "Kế toán", status: "active" }];
const response = (status: number, data: unknown = accounts) => new Response(JSON.stringify({ data, error: { message: "Không tải được tài khoản test" } }), { status });
function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
const gateInput = () => screen.queryByLabelText(/^Mã truy cập tester/);

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

describe("TestAccountPicker account loading", () => {
  it("shows loading instead of the access gate while an existing grant is checked", async () => {
    const pending = deferredResponse();
    const fetch = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker compact currentUsername="employee.test" environment="test" />);
    expect(screen.getByText("employee.test")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Đang tải tài khoản kiểm thử" })).toHaveClass("test-account-picker__loading");
    expect(document.querySelector('[data-ui="loading-spinner"]')).not.toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mở kiểm thử" })).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/testing/accounts", expect.objectContaining({ cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal) })));
    await act(async () => { pending.resolve(response(200)); });
    expect(await screen.findByRole("combobox", { name: "Chuyển tài khoản kiểm thử" })).toHaveValue("employee.test");
    expect(screen.getByRole("option", { name: "Nhân sự" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
  });

  it("checks access again after remount without flashing the gate form", async () => {
    const pending = deferredResponse();
    const fetch = vi.fn().mockResolvedValueOnce(response(200)).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", fetch);
    const initial = render(<TestAccountPicker environment="test" />);
    await screen.findByRole("button", { name: "Nhân viên" });
    initial.unmount();
    render(<TestAccountPicker compact currentUsername="employee.test" environment="test" />);
    expect(screen.getByRole("status", { name: "Đang tải tài khoản kiểm thử" })).toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => { pending.resolve(response(200)); });
    expect(await screen.findByRole("combobox", { name: "Chuyển tài khoản kiểm thử" })).toBeEnabled();
    expect(gateInput()).not.toBeInTheDocument();
  });

  it("shows the access gate only after the account endpoint returns 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401)));
    render(<TestAccountPicker environment="test" />);
    expect(await screen.findByLabelText(/^Mã truy cập tester/)).toBeRequired();
    expect(screen.getByRole("button", { name: "Mở kiểm thử" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it.each([
    ["server error", () => Promise.resolve(response(503))],
    ["permission error", () => Promise.resolve(response(403))],
    ["network error", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["invalid response", () => Promise.resolve(new Response("<html>Unavailable</html>", { status: 200 }))]
  ])("allows retry after %s without requesting the gate code", async (_name, failure) => {
    const pending = deferredResponse();
    const fetch = vi.fn().mockImplementationOnce(failure).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker environment="test" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(screen.getByRole("status", { name: "Đang tải tài khoản kiểm thử" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(async () => { pending.resolve(response(200)); });
    expect(await screen.findByRole("button", { name: "Nhân viên" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/testing/accounts", expect.objectContaining({ cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal) }));
  });

  it("keeps loading after unlocking until the refreshed account list arrives", async () => {
    const pending = deferredResponse();
    const fetch = vi.fn().mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, null)).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker environment="test" />);
    const input = await screen.findByLabelText(/^Mã truy cập tester/);
    fireEvent.change(input, { target: { value: "FixtureTesterGateOnly" } });
    fireEvent.submit(screen.getByRole("button", { name: "Mở kiểm thử" }).closest("form")!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("status", { name: "Đang tải tài khoản kiểm thử" })).toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
    await act(async () => { pending.resolve(response(200)); });
    expect(await screen.findByRole("button", { name: "Nhân viên" })).toBeEnabled();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/testing/access", expect.objectContaining({
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: "FixtureTesterGateOnly" })
    }));
    expect(gateInput()).not.toBeInTheDocument();
  });

  it("shows an empty account result without reopening the access gate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, [])));
    render(<TestAccountPicker environment="test" />);
    expect(await screen.findByText("Chưa có tài khoản kiểm thử")).toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("TestAccountPicker compact account switching", () => {
  it("keeps full mode as individual account buttons", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200)));
    render(<TestAccountPicker currentUsername="employee.test" environment="test" />);
    expect(await screen.findByRole("button", { name: "Nhân viên" })).toHaveClass("button--primary");
    expect(screen.getByRole("button", { name: "Nhân sự" })).toBeDisabled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows one labeled select with the current account and prevents disabled or current account login", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, compactAccounts));
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker compact currentUsername="employee.test" environment="staging" />);
    const picker = await screen.findByRole("combobox", { name: "Chuyển tài khoản kiểm thử" });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(picker).toHaveAttribute("name", "testAccount");
    expect(picker).toHaveClass("select");
    expect(picker).toHaveValue("employee.test");
    expect(screen.getByRole("option", { name: "Nhân viên" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "Nhân sự" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Nhân viên" })).not.toBeInTheDocument();
    expect(screen.getByText("STAGING")).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "hr.test" } });
    fireEvent.change(picker, { target: { value: "employee.test" } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(picker).toHaveValue("employee.test");
  });

  it.each([undefined, "unlisted.test"])("shows a placeholder when the current account is %s", async (currentUsername) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, compactAccounts)));
    render(<TestAccountPicker compact currentUsername={currentUsername} environment="test" />);
    expect(await screen.findByRole("combobox", { name: "Chuyển tài khoản kiểm thử" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Chọn tài khoản" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Kế toán" })).toBeEnabled();
  });

  it("shows the compact empty result without a select or access gate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, [])));
    render(<TestAccountPicker compact currentUsername="employee.test" environment="test" />);
    expect(await screen.findByText("Chưa có tài khoản kiểm thử")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(gateInput()).not.toBeInTheDocument();
  });

  it("posts only the selected username, blocks further changes and recovers after failed login", async () => {
    const pending = deferredResponse();
    const fetch = vi.fn().mockResolvedValueOnce(response(200, compactAccounts)).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker compact currentUsername="employee.test" environment="test" />);
    const picker = await screen.findByRole("combobox", { name: "Chuyển tài khoản kiểm thử" });
    fireEvent.change(picker, { target: { value: "accountant.test" } });
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/testing/login", expect.objectContaining({
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "accountant.test" })
    }));
    expect(picker).toBeDisabled();
    expect(picker).toHaveAttribute("aria-busy", "true");
    fireEvent.change(picker, { target: { value: "employee.test" } });
    fireEvent.change(picker, { target: { value: "accountant.test" } });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      pending.resolve(new Response(JSON.stringify({ error: { message: "Không chuyển được tài khoản" } }), { status: 403 }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Không chuyển được tài khoản");
    expect(picker).toBeEnabled();
    expect(picker).not.toHaveAttribute("aria-busy");
    expect(picker).toHaveValue("employee.test");
    expect(gateInput()).not.toBeInTheDocument();
  });
});

describe("TestAccountPicker standalone testing table", () => {
  it("shows roles, usernames and account status with labeled login actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200)));
    render(<TestAccountPicker environment="test" standalone />);
    const table = await screen.findByRole("table", { name: "Danh sách tài khoản kiểm thử" });
    expect(table).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Vai trò" })).toBeInTheDocument();
    expect(screen.getByText("employee.test")).toBeInTheDocument();
    expect(screen.getByText("Sẵn sàng")).toBeInTheDocument();
    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vào test Nhân viên" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Vào test Nhân sự" })).toBeDisabled();
  });

  it("removes the invitation fragment immediately and exchanges it before reading accounts, including Strict Mode", async () => {
    window.history.replaceState(null, "", "/testing#access=FixtureSignedInvitation");
    const grant = deferredResponse();
    const fetch = vi.fn().mockReturnValueOnce(grant.promise).mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetch);
    render(<StrictMode><TestAccountPicker environment="test" standalone /></StrictMode>);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/testing");
    expect(gateInput()).not.toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/testing/access", expect.objectContaining({ method: "POST", body: JSON.stringify({ token: "FixtureSignedInvitation" }), credentials: "same-origin" }));
    await act(async () => { grant.resolve(response(200, null)); });
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/testing/accounts", expect.anything());
  });

  it("keeps accounts hidden after a rejected invitation and allows the normal access code", async () => {
    window.history.replaceState(null, "", "/testing#access=ExpiredInvitation");
    const fetch = vi.fn().mockResolvedValueOnce(response(401));
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker environment="test" standalone />);
    expect(await screen.findByLabelText(/^Mã truy cập tester/)).toBeRequired();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("");
  });

  it("retries a failed invitation exchange without restoring the token to the URL", async () => {
    window.history.replaceState(null, "", "/testing#access=FixtureSignedInvitation");
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(response(200, null)).mockResolvedValueOnce(response(200));
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker environment="test" standalone />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/testing/access", expect.objectContaining({ body: JSON.stringify({ token: "FixtureSignedInvitation" }) }));
    expect(window.location.hash).toBe("");
  });

  it("logs in from a row, prevents duplicate requests and restores actions after a failure", async () => {
    const pending = deferredResponse();
    const fetch = vi.fn().mockResolvedValueOnce(response(200)).mockReturnValueOnce(pending.promise);
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker environment="test" standalone />);
    fireEvent.click(await screen.findByText("employee.test"));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/testing/login", expect.objectContaining({ method: "POST", body: JSON.stringify({ username: "employee.test" }) }));
    const loginButton = screen.getByRole("button", { name: "Vào test Nhân viên" });
    expect(loginButton).toBeDisabled();
    expect(loginButton).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByText("employee.test"));
    fireEvent.click(screen.getByText("hr.test"));
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve(response(403)); });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(loginButton).toBeEnabled();
    expect(loginButton).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("button", { name: "Vào test Nhân sự" })).toBeDisabled();
  });

  it("does not treat an invalid login result as a successful account switch", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(200)).mockResolvedValueOnce(response(200, {}));
    vi.stubGlobal("fetch", fetch);
    render(<TestAccountPicker environment="test" standalone />);
    fireEvent.click(await screen.findByRole("button", { name: "Vào test Nhân viên" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không chuyển được tài khoản");
    expect(screen.getByRole("button", { name: "Vào test Nhân viên" })).toBeEnabled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts a pending invitation exchange when the table is unmounted", async () => {
    window.history.replaceState(null, "", "/testing#access=FixtureSignedInvitation");
    const pending = deferredResponse();
    const fetch = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetch);
    const view = render(<TestAccountPicker environment="test" standalone />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const signal = fetch.mock.calls[0][1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { pending.resolve(response(200, null)); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
