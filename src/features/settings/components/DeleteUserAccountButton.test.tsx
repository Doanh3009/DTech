import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteUserAccountButton } from "./DeleteUserAccountButton";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const id = "11111111-1111-4111-8111-111111111111";
function open() {
  render(<DeleteUserAccountButton accountId={id} accountName="Nguyễn Văn An" />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
  return screen.getByRole("dialog");
}
const result = (body: string) => ({ ok: true, status: 200, json: async () => ({ ok: true, data: { requestId: JSON.parse(body).requestId, accountId: id, employeeId: null, kind: "delete", state: "completed" } }) });
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("DeleteUserAccountButton", () => {
  it("requires confirmation and sends a stable command identifier", async () => {
    const mock = vi.fn().mockImplementation((_url, options) => Promise.resolve(result(options.body))); vi.stubGlobal("fetch", mock);
    const dialog = open();
    expect(within(dialog).getByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(mock).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa tài khoản" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(mock.mock.calls[0][0]).toBe(`/api/v1/accounts/${id}`);
    expect(mock.mock.calls[0][1]).toMatchObject({ method: "DELETE", body: expect.any(String) });
    expect(JSON.parse(mock.mock.calls[0][1].body).requestId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it("retries a failed deletion with the same exact request ID", async () => {
    const mock = vi.fn().mockRejectedValueOnce(new Error("offline")).mockImplementation((_url, options) => Promise.resolve(result(options.body))); vi.stubGlobal("fetch", mock);
    const dialog = open(); fireEvent.click(within(dialog).getByRole("button", { name: "Xóa tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể xác nhận kết quả xóa");
    fireEvent.click(within(dialog).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(mock.mock.calls[1][1].body).toBe(mock.mock.calls[0][1].body);
  });

  it("prevents duplicate deletion while pending", async () => {
    let reject: (error: Error) => void = () => {};
    const mock = vi.fn().mockReturnValue(new Promise((_resolve, fail) => { reject = fail; })); vi.stubGlobal("fetch", mock);
    const dialog = open(); const button = within(dialog).getByRole("button", { name: "Xóa tài khoản" });
    fireEvent.click(button); fireEvent.click(button);
    expect(mock).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("does not refresh on a malformed success receipt", async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data: { accountId: id } }) }); vi.stubGlobal("fetch", mock);
    const dialog = open(); fireEvent.click(within(dialog).getByRole("button", { name: "Xóa tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể xác nhận kết quả xóa");
    expect(refresh).not.toHaveBeenCalled();
  });
});
