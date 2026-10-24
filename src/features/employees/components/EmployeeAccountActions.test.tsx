import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmployeeAccountView } from "@/features/employees/types";
import type { RoleDefinition } from "@/services/authorization/rbacService";
import { EmployeeAccountActions } from "./EmployeeAccountActions";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/shared/RoleAccessSelector", () => ({
  RoleAccessSelector: ({ roles, selectedRoleIds, onToggle }: { roles: RoleDefinition[]; selectedRoleIds: string[]; onToggle: (id: string) => void }) => (
    <>{roles.map((role) => <label key={role.id}><input checked={selectedRoleIds.includes(role.id)} onChange={() => onToggle(role.id)} type="checkbox" />{role.name}</label>)}</>
  )
}));

const employeeId = "11111111-1111-4111-8111-111111111111";
const accountId = "22222222-2222-4222-8222-222222222222";
const employeeRoleId = "33333333-3333-4333-8333-333333333333";
const managerRoleId = "44444444-4444-4444-8444-444444444444";
const roles: RoleDefinition[] = [
  { id: employeeRoleId, code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 },
  { id: managerRoleId, code: "manager", name: "Quản lý", description: "", isSystem: true, permissionKeys: [], userCount: 0 }
];
const account: EmployeeAccountView = { id: accountId, employeeId, displayName: "Nhân viên thử", employeeCodeIdentifier: "NV01", status: "active", roleIds: [employeeRoleId], roleNames: ["Nhân viên"] };
const permissions = ["account.assign_role", "account.disable", "account.enable"] as const;
const response = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => ({ ok: status >= 200 && status < 300, data }) });
function completed(body: string, extra = {}) {
  const input = JSON.parse(body);
  return response({ requestId: input.requestId, accountId, employeeId, kind: "provision", state: "completed", ...extra });
}
async function provisionForm() {
  fireEvent.click(screen.getByRole("button", { name: "Cấp tài khoản hệ thống" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/Tên tài khoản/), { target: { value: "nv_test" } });
  return { dialog, form: dialog.querySelector("form")! };
}
function renderProvision(assignRole = false) {
  return render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" permissions={assignRole ? ["account.create", "account.assign_role"] : ["account.create"]} roles={roles} />);
}
async function statusForm() {
  fireEvent.click(screen.getByRole("button", { name: "Vô hiệu hóa" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Nghỉ phép" } });
  return { dialog, form: dialog.querySelector("form")! };
}

beforeEach(() => mocks.refresh.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("account provision command recovery", () => {
  it("retains the immutable UUID and body after connection failure and retries the same command", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockImplementationOnce((_url, options) => Promise.resolve(completed(options.body)));
    vi.stubGlobal("fetch", fetchMock); renderProvision();
    const { dialog, form } = await provisionForm(); fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Chưa thể xác nhận kết quả");
    expect(within(dialog).getByLabelText(/Tên tài khoản/)).toBeDisabled();
    expect(within(dialog).getByLabelText("Nhân viên")).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeEnabled();
    const first = fetchMock.mock.calls[0][1];
    expect(JSON.parse(first.body).requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.signal).toBeInstanceOf(AbortSignal);
    fireEvent.click(within(dialog).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[1][1].body).toBe(first.body);
    expect(screen.queryByRole("button", { name: "Cấp tài khoản hệ thống" })).not.toBeInTheDocument();
  });

  it("keeps the command after closing and reopening an uncertain provision", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockImplementationOnce((_url, options) => Promise.resolve(completed(options.body)));
    vi.stubGlobal("fetch", fetchMock); renderProvision();
    const { dialog, form } = await provisionForm();
    fireEvent.change(within(dialog).getByLabelText(/Mật khẩu ban đầu/), { target: { value: "StrongPass123!" } });
    fireEvent.submit(form); await within(dialog).findByRole("alert");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục cấp tài khoản" }));
    const resumed = await screen.findByRole("dialog");
    expect(within(resumed).getByLabelText(/Tên tài khoản/)).toHaveValue("nv_test");
    fireEvent.click(within(resumed).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).password).toBe("StrongPass123!");
  });

  it("blocks duplicate provisions and closing while a request is in flight", async () => {
    let rejectWrite: ((error: Error) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((_resolve, reject) => { rejectWrite = reject; }));
    vi.stubGlobal("fetch", fetchMock); renderProvision();
    const { dialog, form } = await provisionForm();
    fireEvent.submit(form); fireEvent.submit(form); expect(fetchMock).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" })); expect(screen.getByRole("dialog")).toBeInTheDocument();
    rejectWrite?.(new Error("Mất kết nối")); await within(dialog).findByRole("alert");
  });

  it("allows editing after a definite validation failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, error: { message: "Tên tài khoản chưa hợp lệ." } }) }));
    renderProvision(); const { dialog, form } = await provisionForm(); fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Tên tài khoản chưa hợp lệ");
    expect(within(dialog).getByLabelText(/Tên tài khoản/)).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Cấp tài khoản" })).toBeEnabled();
  });

  it("rejects malformed successful receipts and keeps the pending command", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ account: { id: accountId }, temporaryPassword: "secret" })));
    renderProvision(); const { dialog, form } = await provisionForm(); fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Chưa thể xác nhận kết quả");
    expect(within(dialog).getByRole("button", { name: "Thử lại" })).toBeEnabled();
    expect(screen.queryByText("secret")).not.toBeInTheDocument(); expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("does not offer privileged provision roles without assignment permission", async () => {
    renderProvision(); const { dialog } = await provisionForm();
    expect(within(dialog).getByLabelText("Nhân viên")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Quản lý")).not.toBeInTheDocument();
  });

  it("offers provision roles with assignment permission", async () => {
    renderProvision(true); const { dialog } = await provisionForm();
    expect(within(dialog).getByLabelText("Quản lý")).toBeInTheDocument();
  });

  it("does not claim the password was copied when clipboard access fails and clears it on close", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "jsdom" });
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, options) => Promise.resolve(completed(options.body, { temporaryPassword: "only-once-password" }))));
    renderProvision(); const { form } = await provisionForm(); fireEvent.submit(form);
    fireEvent.click(await screen.findByRole("button", { name: "Sao chép" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể sao chép");
    expect(screen.queryByRole("button", { name: "Đã sao chép" })).not.toBeInTheDocument(); expect(writeText).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn tất" }));
    expect(screen.queryByText("only-once-password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cấp tài khoản hệ thống" })).not.toBeInTheDocument();
  });
});

describe("account status and roles receipts", () => {
  it("merges the status receipt without requiring an account DTO", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ accountId, status: "disabled" })));
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    const { form } = await statusForm(); fireEvent.submit(form);
    expect(await screen.findByRole("button", { name: "Kích hoạt" })).toBeEnabled();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("merges the role receipt and preserves the account for later actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ accountId, roleIds: [managerRoleId] })); vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    fireEvent.click(screen.getByRole("button", { name: "Quản lý quyền truy cập" }));
    const dialog = await screen.findByRole("dialog"); fireEvent.click(within(dialog).getByLabelText("Quản lý")); fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Quản lý quyền truy cập" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Quản lý")).toBeChecked();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).roleIds).toEqual([managerRoleId]);
  });

  it("blocks duplicate status requests and controls while in flight", async () => {
    let resolveWrite: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => { resolveWrite = resolve; })); vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    const { dialog, form } = await statusForm(); fireEvent.submit(form); fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce(); expect(within(dialog).getByLabelText(/Lý do/)).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled(); expect(within(dialog).getByRole("button", { name: "Vô hiệu hóa" })).toBeDisabled();
    resolveWrite?.(response({ accountId, status: "disabled" })); await screen.findByRole("button", { name: "Kích hoạt" });
  });

  it.each(["network", "503", "malformed", "wrong-account"])("requires reload after uncertain status result: %s", async (kind) => {
    const fetchMock = kind === "network" ? vi.fn().mockRejectedValue(new Error("Mất kết nối"))
      : vi.fn().mockResolvedValue(kind === "503" ? response(null, 503) : response(kind === "malformed" ? { account } : { accountId: employeeId, status: "disabled" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    const { dialog, form } = await statusForm(); fireEvent.submit(form);
    expect(await within(dialog).findByRole("button", { name: "Tải lại trang" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Vô hiệu hóa" })).toBeDisabled();
    fireEvent.submit(form); expect(fetchMock).toHaveBeenCalledOnce(); expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("button", { name: "Quản lý quyền truy cập" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeEnabled();
  });

  it("rejects a roles receipt with roles different from the submitted set", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ accountId, roleIds: [managerRoleId] })));
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    fireEvent.click(screen.getByRole("button", { name: "Quản lý quyền truy cập" }));
    const dialog = await screen.findByRole("dialog"); fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByRole("button", { name: "Tải lại trang" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Lưu quyền truy cập" })).toBeDisabled();
    expect(within(dialog).getByLabelText("Quản lý")).toBeDisabled();
  });

  it("allows a fresh attempt after a definite permission rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ ok: false, error: { message: "Không đủ quyền" } }) }));
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    const { dialog, form } = await statusForm(); fireEvent.submit(form);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Không đủ quyền");
    expect(within(dialog).getByRole("button", { name: "Vô hiệu hóa" })).toBeEnabled();
    expect(within(dialog).queryByRole("button", { name: "Tải lại trang" })).not.toBeInTheDocument();
  });

  it("requires a disable reason before sending", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeAccountActions employeeId={employeeId} employeeLabel="NV01" account={account} permissions={permissions} roles={roles} />);
    fireEvent.click(screen.getByRole("button", { name: "Vô hiệu hóa" }));
    const dialog = await screen.findByRole("dialog"); fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cần nhập lý do"); expect(fetchMock).not.toHaveBeenCalled();
  });
});
