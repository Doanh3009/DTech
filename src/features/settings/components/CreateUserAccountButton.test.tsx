import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateUserAccountButton } from "@/features/settings/components/CreateUserAccountButton";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("CreateUserAccountButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the account form with username, password and role fields", () => {
    render(<CreateUserAccountButton
      employees={[{ id: "employee-1", employeeCode: "NV001", name: "Nguyễn Văn An" }]}
      roles={[{ id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tạo tài khoản" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Nhân viên" })).toHaveTextContent("Nguyễn Văn An");
    expect(document.querySelector('select[name="employeeId"]')).toHaveValue("employee-1");
    expect(screen.getByLabelText(/Tên tài khoản/)).toHaveValue("nv001");
    expect(screen.queryByLabelText(/Email đăng nhập/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu ban đầu/)).toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/Mật khẩu ban đầu/)).not.toBeRequired();
    expect(screen.queryByLabelText(/Nhập lại mật khẩu/)).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Nhân viên/ })).toBeChecked();
  });

  it("sends the username and initial password when creating an account", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CreateUserAccountButton
      employees={[{ id: "employee-1", employeeCode: "NV001", name: "Nguyễn Văn An" }]}
      roles={[{ id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    fireEvent.change(screen.getByLabelText(/Mật khẩu ban đầu/), { target: { value: "12345678" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      username: "nv001",
      password: "12345678"
    });
  });

  it("allows the admin to create an account without entering a password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { temporaryPassword: "Ct!Temporary9a" } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CreateUserAccountButton
      employees={[{ id: "employee-1", employeeCode: "NV001", name: "Nguyễn Văn An" }]}
      roles={[{ id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 }]}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("password");
    expect(await screen.findByText("Ct!Temporary9a")).toBeInTheDocument();
  });
});
