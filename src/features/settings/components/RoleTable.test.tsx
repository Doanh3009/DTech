import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleTable } from "@/features/settings/components/RoleTable";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const permissionGroups = [{
  group: "Tài khoản" as const,
  permissions: [{
    key: "user.view" as const,
    module: "settings",
    group: "Tài khoản" as const,
    label: "Xem người dùng",
    description: ""
  }]
}];

describe("RoleTable", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates a role from its name and selected permissions without exposing a technical code", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { role: { id: "role-1" } } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<RoleTable canManage permissionGroups={permissionGroups} roles={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Thêm nhóm quyền" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText(/Mã vai trò/i)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Tên nhóm quyền/), { target: { value: "Điều phối công trường" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Xem người dùng" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu nhóm quyền" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: "Điều phối công trường",
      permissionKeys: ["user.view"]
    });
  });

  it("selects an entire module permission group with one action", () => {
    render(<RoleTable canManage permissionGroups={permissionGroups} roles={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm nhóm quyền" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Chọn tất cả" }));
    expect(within(dialog).getByRole("checkbox", { name: "Xem người dùng" })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Bỏ chọn" })).toBeInTheDocument();
  });
});
