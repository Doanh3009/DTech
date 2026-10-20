import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmployeeContract } from "../types";
import { EmployeeContractManager } from "./EmployeeContractManager";

vi.mock("@/components/shared/DropdownMenu", () => ({ DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/shared/DataTable", () => ({ DataTable: ({ data, actions }: { data: EmployeeContract[]; actions?: (row: EmployeeContract) => ReactNode }) => <div>{data.map((row) => <div key={row.id}>{actions?.(row)}</div>)}</div> }));
afterEach(() => vi.unstubAllGlobals());
const contract: EmployeeContract = { id: "contract", employeeId: "employee", contractNumber: "HD-01", contractType: "Không thời hạn", effectiveDate: "2026-01-01", startDate: "2026-01-01", status: "active", rowVersion: 7 };
function setup(options: { canEdit?: boolean; reject?: boolean } = {}) {
  const fetchMock = vi.fn().mockImplementation((_url, init) => {
    if (options.reject && init?.method) return Promise.reject(new Error("Mất kết nối"));
    return Promise.resolve({ ok: true, json: async () => ({ data: { contracts: [contract], templates: [] } }) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const view = render(<EmployeeContractManager employeeId="employee" initialContracts={[contract]} canEdit={options.canEdit ?? true} canUpload canViewFile />);
  return { fetchMock, ...view };
}
describe("employee contract form writes", () => {
  it("sends the displayed version with edited contract metadata", async () => {
    const { fetchMock } = setup(); fireEvent.click(screen.getByRole("button", { name: "Sửa hợp đồng" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Số hợp đồng/), { target: { value: "HD-02" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
    const payload = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")![1].body as FormData;
    expect(payload.get("rowVersion")).toBe("7"); expect(payload.get("contractNumber")).toBe("HD-02"); expect(payload.get("fileOnly")).toBeNull();
  });
  it("file-only users send no stale contract metadata", async () => {
    const { fetchMock, container } = setup({ canEdit: false });
    expect(screen.queryByRole("button", { name: "Sửa hợp đồng" })).not.toBeInTheDocument();
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["%PDF"], "contract.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
    const payload = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")![1].body as FormData;
    expect([...payload.keys()].sort()).toEqual(["file", "fileOnly", "rowVersion"]);
    expect(payload.get("rowVersion")).toBe("7"); expect(payload.get("fileOnly")).toBe("true");
  });
  it("archives with a reason and the displayed version", async () => {
    const { fetchMock } = setup(); fireEvent.click(screen.getByRole("button", { name: "Lưu trữ" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Lý do lưu trữ/), { target: { value: "Kết thúc hợp đồng" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true));
    const payload = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")![1].body;
    expect(JSON.parse(payload)).toEqual({ reason: "Kết thúc hợp đồng", rowVersion: 7 });
  });
  it("retains edited fields and releases busy state on connection failure", async () => {
    setup({ reject: true }); fireEvent.click(screen.getByRole("button", { name: "Sửa hợp đồng" }));
    const dialog = await screen.findByRole("dialog"), input = within(dialog).getByLabelText(/Số hợp đồng/);
    fireEvent.change(input, { target: { value: "HD-02" } }); fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByText("Mất kết nối")).toBeInTheDocument(); expect(input).toHaveValue("HD-02");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled());
  });
});
