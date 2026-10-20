import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsuranceConsole } from "./InsuranceConsole";
vi.mock("@/components/shared/DropdownMenu", () => ({ DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/shared/DataTable", () => ({ DataTable: ({ data, actions, columns }: { data: Record<string, unknown>[]; actions?: (row: Record<string, unknown>) => ReactNode; columns: { id: string; cell?: (row: Record<string, unknown>) => ReactNode }[] }) => <div>{data.map((row) => <div key={String(row.employeeId)}>{columns.map((column) => <div key={column.id}>{column.cell?.(row)}</div>)}{actions?.(row)}</div>)}</div> }));
afterEach(() => vi.unstubAllGlobals());
const profile = { employeeId: "person", employeeCode: "NV01", employeeName: "Nguyễn Văn An", socialInsuranceNumber: "BH0001", participationStatus: "active", paymentStatus: "paid", contributionMonth: "2026-10", updatedAt: "2026-10-14T10:00:00Z",
  history: [{ id: "event", employeeId: "person", changeType: "adjusted", effectiveDate: "2026-10-14", changedAt: "2026-10-14T10:00:00Z", changedByName: "Nhân sự", reason: "Đã đối chiếu kỳ đóng", snapshot: { paymentStatus: "paid", contributionMonth: "2026-10", contributionBase: 10_000_000, contributionRatePercent: 10, participationStatus: "active", socialInsuranceEnabled: true }, fileId: "private-file", fileName: "BHXH.pdf" }] };
describe("insurance history UI", () => {
  it("shows actual period/status/amount/actor and authorized private document link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { records: [profile], employees: [], canViewHistory: true } }) }));
    render(<InsuranceConsole canEdit={false} canUpload={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem chi tiết BHXH Nguyễn Văn An" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Lịch sử điều chỉnh" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Đã đóng");
    expect(screen.getByRole("dialog")).toHaveTextContent("10.000.000");
    expect(screen.getByRole("dialog")).toHaveTextContent("Đã đối chiếu kỳ đóng");
    expect(screen.getByRole("dialog")).toHaveTextContent("Nhân sự");
    expect(screen.getByRole("link", { name: "BHXH.pdf" })).toHaveAttribute("href", "/api/v1/files/private-file/signed-url");
  });
  it("hides history actions when server capability is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { records: [profile], employees: [], canViewHistory: false } }) }));
    render(<InsuranceConsole canEdit={false} canUpload={false} />);
    await waitFor(() => expect(screen.getByText("1 hồ sơ")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Xem BHXH của Nguyễn Văn An" }));
    expect(await screen.findByRole("tab", { name: /Quá trình đóng/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Lịch sử điều chỉnh" })).not.toBeInTheDocument();
    expect(screen.getByText("Chưa ghi nhận quá trình đóng")).toBeInTheDocument();
  });
  it("preserves edit fields and the expected timestamp after a failed write", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init) => init?.method === "POST" ? Promise.reject(new Error("Mất kết nối")) : Promise.resolve({ ok: true, json: async () => ({ data: { records: [profile], employees: [{ id: "person", code: "NV01", name: "Nguyễn Văn An" }], canViewHistory: true } }) }));
    vi.stubGlobal("fetch", fetchMock); render(<InsuranceConsole canEdit canUpload={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cập nhật" }));
    const dialog = await screen.findByRole("dialog"), input = within(dialog).getByLabelText(/Mã số BHXH/);
    fireEvent.change(input, { target: { value: "BH-EDITED" } }); fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByText("Mất kết nối")).toBeInTheDocument(); expect(input).toHaveValue("BH-EDITED");
    const payload = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1].body as FormData;
    expect(JSON.parse(String(payload.get("metadata")))).toMatchObject({ expectedUpdatedAt: profile.updatedAt, socialInsuranceNumber: "BH-EDITED", employeeId: profile.employeeId, recordContribution: false });
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Lưu thông tin" })).toBeEnabled());
  });
  it("shows unrecorded periods truthfully instead of marking every new profile unpaid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { records: [{ ...profile, contributionMonth: undefined, paymentStatus: "pending", contributions: [] }], employees: [], canViewHistory: false } }) }));
    render(<InsuranceConsole canEdit={false} canUpload={false} />);
    await screen.findByRole("button", { name: "Xem BHXH của Nguyễn Văn An" });
    expect(screen.getAllByText("Chưa ghi nhận kỳ đóng").length).toBeGreaterThan(0);
    expect(screen.queryByText("Chưa đóng", { selector: "span" })).not.toBeInTheDocument();
  });
  it("opens the selected person directly and preserves the list filter after closing", async () => {
    const other = { ...profile, employeeId: "other", employeeName: "Trần Thị Bình", employeeCode: "NV02", socialInsuranceNumber: "BH0002", contributions: [] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { records: [profile, other], employees: [], canViewHistory: false } }) }));
    render(<InsuranceConsole canEdit={false} canUpload={false} />);
    await screen.findByRole("button", { name: "Xem BHXH của Trần Thị Bình" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Bình" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem BHXH của Trần Thị Bình" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("BHXH · Trần Thị Bình");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("searchbox")).toHaveValue("Bình");
    expect(screen.queryByRole("button", { name: "Xem BHXH của Nguyễn Văn An" })).not.toBeInTheDocument();
  });
});
