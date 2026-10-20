import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployeeAccountActions } from "./EmployeeAccountActions";
vi.mock("@/components/shared/RoleAccessSelector", () => ({ RoleAccessSelector: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());
describe("account network recovery", () => {
  it("re-enables provision after a rejected connection while keeping the form", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Mất kết nối")); vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeAccountActions employeeId="employee" employeeLabel="NV01" permissions={["account.create"]} roles={[{ id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cấp tài khoản hệ thống" }));
    const dialog = await screen.findByRole("dialog"); fireEvent.change(within(dialog).getByLabelText(/Tên tài khoản/), { target: { value: "nv_test" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByText("Mất kết nối")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cấp tài khoản" })).toBeEnabled());
  });
  it("blocks duplicate provision requests while one is pending", async () => {
    let rejectWrite: ((error: Error) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((_resolve, reject) => { rejectWrite = reject; })); vi.stubGlobal("fetch", fetchMock);
    render(<EmployeeAccountActions employeeId="employee" employeeLabel="NV01" permissions={["account.create"]} roles={[{ id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cấp tài khoản hệ thống" }));
    const dialog = await screen.findByRole("dialog"), form = dialog.querySelector("form")!;
    fireEvent.submit(form); fireEvent.submit(form); expect(fetchMock).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    rejectWrite?.(new Error("Mất kết nối")); await within(dialog).findByText("Mất kết nối");
  });
  it("does not claim the password was copied when clipboard access fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied")); vi.stubGlobal("navigator", { clipboard: { writeText }, userAgent: "jsdom" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { account: { id: "account", status: "active", roleIds: ["role-employee"] }, temporaryPassword: "only-once-password" } }) }));
    render(<EmployeeAccountActions employeeId="employee" employeeLabel="NV01" permissions={["account.create"]} roles={[{ id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cấp tài khoản hệ thống" }));
    const dialog = await screen.findByRole("dialog"); fireEvent.submit(dialog.querySelector("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "Sao chép" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể sao chép");
    expect(screen.queryByRole("button", { name: "Đã sao chép" })).not.toBeInTheDocument(); expect(writeText).toHaveBeenCalledOnce();
  });
});
