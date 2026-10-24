import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateUserAccountButton } from "./CreateUserAccountButton";
import { notifyAccountOperationsChanged } from "@/features/employees/components/useAccountProvisionCommand";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const id = "11111111-1111-4111-8111-111111111111";
const roleId = "22222222-2222-4222-8222-222222222222";
const accountId = "33333333-3333-4333-8333-333333333333";
const employees = [{ id, employeeCode: "NV001", name: "Nguyễn Văn An" }];
const roles = [{ id: roleId, code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }];
function open() {
  render(<CreateUserAccountButton employees={employees} roles={roles} />);
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
  return screen.getByRole("dialog");
}
const result = (body: string, temporaryPassword?: string) => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { requestId: JSON.parse(body).requestId, employeeId: id, accountId, kind: "provision", state: "completed", temporaryPassword } }) });
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("CreateUserAccountButton", () => {
  it("opens the labeled account form without explanatory text", () => {
    open();
    expect(screen.getByRole("combobox", { name: "Nhân viên" })).toHaveTextContent("Nguyễn Văn An");
    expect(screen.getByLabelText(/Tên tài khoản/)).toHaveValue("nv001");
    expect(screen.getByLabelText(/Mật khẩu ban đầu/)).toHaveAttribute("type", "password");
    expect(screen.getByRole("checkbox", { name: /Nhân viên/ })).toBeChecked();
    expect(screen.queryByText("Để trống để hệ thống tạo mật khẩu tạm thời.")).not.toBeInTheDocument();
  });

  it("sends a UUID command with a custom initial password", async () => {
    const mock = vi.fn().mockImplementation((_url, options) => Promise.resolve(result(options.body))); vi.stubGlobal("fetch", mock);
    const dialog = open();
    fireEvent.change(screen.getByLabelText(/Mật khẩu ban đầu/), { target: { value: "Custom!Password9" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    const body = JSON.parse(mock.mock.calls[0][1].body);
    expect(body).toMatchObject({ username: "nv001", password: "Custom!Password9", roleIds: [roleId] });
    expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/i);
    expect(mock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("displays generated credentials once and clears them on close", async () => {
    const mock = vi.fn().mockImplementation((_url, options) => Promise.resolve(result(options.body, "Dt!GeneratedPassword9"))); vi.stubGlobal("fetch", mock);
    const dialog = open(); fireEvent.submit(dialog.querySelector("form")!);
    expect(await screen.findByText("Dt!GeneratedPassword9")).toBeInTheDocument();
    expect(JSON.parse(mock.mock.calls[0][1].body)).not.toHaveProperty("password");
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tất" }));
    await waitFor(() => expect(screen.queryByText("Dt!GeneratedPassword9")).not.toBeInTheDocument());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each([503, 409])("freezes a pending form after %s and retries the exact immutable body", async (status) => {
    const mock = vi.fn().mockResolvedValueOnce({ ok: false, status, json: async () => ({ ok: false, error: { message: "Đang chờ hoàn tất" } }) }).mockImplementation((_url, options) => Promise.resolve(result(options.body)));
    vi.stubGlobal("fetch", mock);
    const dialog = open();
    fireEvent.change(screen.getByLabelText(/Mật khẩu ban đầu/), { target: { value: "Original!Password9" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Đang chờ hoàn tất");
    expect(screen.getByLabelText(/Tên tài khoản/)).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Nhân viên/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/Tên tài khoản/), { target: { value: "changed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[1][1].body).toBe(mock.mock.calls[0][1].body);
    expect(JSON.parse(mock.mock.calls[1][1].body).password).toBe("Original!Password9");
  });

  it("blocks double submits and keeps an uncertain network request recoverable", async () => {
    let reject: (reason: Error) => void = () => {};
    const mock = vi.fn().mockReturnValue(new Promise((_resolve, fail) => { reject = fail; })); vi.stubGlobal("fetch", mock);
    const dialog = open(); const form = dialog.querySelector("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(mock).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể xác nhận kết quả");
    expect(within(dialog).getByRole("button", { name: "Thử lại" })).toBeEnabled();
  });

  it("allows correction after a definitive validation rejection", async () => {
    const mock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, error: { message: "Dữ liệu chưa hợp lệ" } }) }); vi.stubGlobal("fetch", mock);
    const dialog = open(); fireEvent.submit(dialog.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dữ liệu chưa hợp lệ");
    expect(screen.getByLabelText(/Tên tài khoản/)).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Tạo tài khoản" })).toBeEnabled();
  });

  it("reports a clipboard rejection and keeps the credential available for manual copying", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, userAgent: "jsdom" });
    const mock = vi.fn().mockImplementation((_url, options) => Promise.resolve(result(options.body, "Dt!GeneratedPassword9"))); vi.stubGlobal("fetch", mock);
    const dialog = open(); fireEvent.submit(dialog.querySelector("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "Sao chép mật khẩu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể sao chép");
    expect(screen.getByText("Dt!GeneratedPassword9")).toBeInTheDocument();
    expect(screen.queryByText("Đã sao chép")).not.toBeInTheDocument();
  });

  it("uses the next eligible employee when refreshed props remove the previous selection", () => {
    const { rerender } = render(<CreateUserAccountButton employees={employees} roles={roles} />);
    const nextId = "44444444-4444-4444-8444-444444444444";
    rerender(<CreateUserAccountButton employees={[{ id: nextId, employeeCode: "NV002", name: "Nguyễn Văn Bình" }]} roles={roles} />);
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(document.querySelector('select[name="employeeId"]')).toHaveValue(nextId);
    expect(screen.getByLabelText(/Tên tài khoản/)).toHaveValue("nv002");
  });

  it("clears a matching pending credential body after authoritative recovery cancellation", async () => {
    const mock = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", mock);
    const dialog = open(); fireEvent.submit(dialog.querySelector("form")!);
    await screen.findByRole("alert");
    const requestId = JSON.parse(mock.mock.calls[0][1].body).requestId;
    expect(screen.getByLabelText(/Tên tài khoản/)).toBeDisabled();
    notifyAccountOperationsChanged({ requestId, state: "cancelled", kind: "provision", employeeId: id });
    await waitFor(() => expect(screen.getByLabelText(/Tên tài khoản/)).toBeEnabled());
    expect(within(dialog).getByRole("button", { name: "Tạo tài khoản" })).toBeEnabled();
  });
});
