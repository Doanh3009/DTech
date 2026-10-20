import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SalaryConsole } from "./SalaryConsole";
vi.mock("@/components/shared/DataTable", () => ({ DataTable: () => <div /> }));
afterEach(() => vi.unstubAllGlobals());
describe("salary form network recovery", () => {
  it("keeps user fields and releases busy state after failed write", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init) => init?.method === "POST" ? Promise.reject(new Error("Mất kết nối")) : Promise.resolve({ ok: true, json: async () => ({ data: { records: [], employees: [{ id: "employee", code: "NV01", name: "Nguyễn Văn An" }] } }) }));
    vi.stubGlobal("fetch", fetchMock); render(<SalaryConsole canEdit canViewHistory />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled()); fireEvent.click(screen.getByRole("button", { name: "Ghi nhận mức lương" }));
    const dialog = await screen.findByRole("dialog"), input = within(dialog).getByLabelText(/Lương cơ bản/);
    fireEvent.change(input, { target: { value: "10000000" } }); fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByText("Mất kết nối")).toBeInTheDocument(); expect(input).toHaveValue(10_000_000);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Lưu mức lương" })).toBeEnabled());
  });
  it("provides a reload after initial data cannot be read", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Mất kết nối")).mockResolvedValue({ ok: true, json: async () => ({ data: { records: [], employees: [] } }) });
    vi.stubGlobal("fetch", fetchMock); render(<SalaryConsole canEdit canViewHistory />);
    expect(await screen.findByRole("button", { name: "Tải lại" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ghi nhận mức lương" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ghi nhận mức lương" })).toBeEnabled());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
