import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteUserAccountButton } from "@/features/settings/components/DeleteUserAccountButton";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("DeleteUserAccountButton", () => {
  afterEach(() => {
    refresh.mockClear();
    vi.unstubAllGlobals();
  });

  it("requires confirmation and deletes the selected login account", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DeleteUserAccountButton accountId="account-1" accountName="Nguyễn Văn An" />);

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Nguyễn Văn An")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa tài khoản" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/accounts/account-1", { method: "DELETE" }));
    expect(refresh).toHaveBeenCalledOnce();
  });
});
