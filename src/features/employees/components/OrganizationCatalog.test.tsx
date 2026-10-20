import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmployeeContractList } from "./OrganizationCatalog";
vi.mock("@/components/shared/DataTable", () => ({ DataTable: () => <div /> }));
afterEach(() => vi.unstubAllGlobals());
const employeeId = "22222222-2222-4222-8222-222222222222";
const workspace = { contracts: [], templates: [], employees: [{ id: employeeId, code: "NV01", name: "Nguyễn Văn An" }] };
function fill(dialog: HTMLElement) {
  const form = dialog.querySelector("form")!;
  fireEvent.change(form.querySelector('select[name="employeeId"]')!, { target: { value: employeeId } });
  fireEvent.change(within(dialog).getByLabelText(/Số hợp đồng/), { target: { value: "HD-01" } });
  fireEvent.change(within(dialog).getByLabelText(/Loại hợp đồng/), { target: { value: "Không thời hạn" } });
  fireEvent.change(within(dialog).getByLabelText(/Ngày hiệu lực/), { target: { value: "2026-10-14" } });
  return form;
}
describe("manual contract creation", () => {
  it("creates without Word templates and sends no templateId", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => ({ ok: true, json: async () => ({ data: init?.method === "POST" ? { id: "new-contract" } : workspace }) }));
    vi.stubGlobal("fetch", fetchMock); render(<EmployeeContractList canEdit canUpload={false} canViewEmployee />);
    const create = await screen.findByRole("button", { name: "Tạo hợp đồng" }); await waitFor(() => expect(create).toBeEnabled()); fireEvent.click(create);
    const dialog = await screen.findByRole("dialog"); expect(within(dialog).queryByLabelText("Mẫu Word")).not.toBeInTheDocument();
    fireEvent.submit(fill(dialog));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    const body = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1].body as FormData;
    expect(body.get("employeeId")).toBe(employeeId); expect(body.get("templateId")).toBeNull();
  });
  it("recovers from a rejected connection and blocks duplicate pending submissions", async () => {
    let rejectWrite: ((error: Error) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation((_url, init) => init?.method === "POST" ? new Promise((_resolve, reject) => { rejectWrite = reject; }) : Promise.resolve({ ok: true, json: async () => ({ data: workspace }) }));
    vi.stubGlobal("fetch", fetchMock); render(<EmployeeContractList canEdit canUpload={false} canViewEmployee />);
    const create = await screen.findByRole("button", { name: "Tạo hợp đồng" }); await waitFor(() => expect(create).toBeEnabled()); fireEvent.click(create);
    const dialog = await screen.findByRole("dialog"), form = fill(dialog); fireEvent.submit(form); fireEvent.submit(form);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    rejectWrite?.(new Error("Mất kết nối")); expect(await within(dialog).findByText("Mất kết nối")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Tạo hợp đồng" })).toBeEnabled());
  });
});
