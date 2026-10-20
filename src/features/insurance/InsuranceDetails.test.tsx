import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsuranceDetails } from "./InsuranceDetails";
import type { InsuranceContribution, InsuranceRecord } from "./sharedtypes";

const contribution: InsuranceContribution = { id: "month-october", employeeId: "employee", contributionMonth: "2026-10", contributionBase: 12_000_000, contributionRatePercent: 10, expectedAmount: 1_200_000, paidAmount: 1_200_000, paymentStatus: "paid", paidDate: "2026-10-05", note: "Đã đối chiếu", updatedAt: "2026-10-05T09:00:00Z", source: "recorded" };
const record: InsuranceRecord = { employeeId: "employee", employeeCode: "NV01", employeeName: "Nguyễn Văn An", socialInsuranceNumber: "BHXH00001", participationStatus: "active", startDate: "2026-01-01", contributionBase: 13_000_000, contributionRatePercent: 10, contributionMonth: "2026-10", paymentStatus: "paid", socialInsuranceEnabled: true, healthInsuranceEnabled: true, unemploymentInsuranceEnabled: true, updatedAt: "2026-10-05T09:00:00Z", history: [], contributions: [contribution, { ...contribution, id: "month-august", contributionMonth: "2026-08", paymentStatus: "overdue", paidAmount: undefined, paidDate: undefined }] };
const show = (overrides: Partial<Parameters<typeof InsuranceDetails>[0]> = {}) => render(<InsuranceDetails record={record} canEdit canViewHistory={false} onClose={vi.fn()} onEditProfile={vi.fn()} onUpdated={vi.fn().mockResolvedValue(undefined)} {...overrides} />);
afterEach(() => vi.unstubAllGlobals());

describe("insurance person details", () => {
  it("shows actual month ledger under view access without audit permission or invented missing months", () => {
    show({ canEdit: false });
    expect(screen.getByRole("dialog")).toHaveAccessibleName("BHXH · Nguyễn Văn An");
    expect(screen.getByLabelText("Hồ sơ BHXH")).toHaveTextContent("BHXH00001");
    expect(screen.getByLabelText("Hồ sơ BHXH")).toHaveTextContent("Đang tham gia");
    const ledger = screen.getByRole("table", { name: "Các kỳ đóng BHXH" });
    expect(within(ledger).getAllByRole("row")).toHaveLength(3);
    expect(ledger).toHaveTextContent("10/2026"); expect(ledger).toHaveTextContent("08/2026");
    expect(ledger).not.toHaveTextContent("09/2026");
    expect(ledger).toHaveTextContent("1.200.000"); expect(ledger).toHaveTextContent("05/10/2026");
    expect(ledger).toHaveTextContent("Chậm đóng");
    expect(screen.queryByRole("tab", { name: "Lịch sử điều chỉnh" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ghi nhận kỳ đóng" })).not.toBeInTheDocument();
  });

  it("shows empty ledger truthfully and keeps unknown actual amounts blank", () => {
    show({ record: { ...record, contributionMonth: undefined, contributionRatePercent: undefined, paymentStatus: "pending", contributions: [] } });
    expect(screen.getByText("Chưa ghi nhận quá trình đóng")).toBeInTheDocument();
    expect(screen.getByText("Chưa ghi nhận kỳ đóng")).toBeInTheDocument();
    expect(screen.queryByText("Chưa đóng")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Tình trạng kỳ đóng gần nhất")).queryByText(/^0\s*₫$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ghi nhận kỳ đóng" })).toBeEnabled();
  });

  it("does not borrow another month's profile salary for a ledger row with unknown salary", () => {
    show({ record: { ...record, contributions: [{ ...contribution, contributionBase: undefined, contributionRatePercent: undefined, expectedAmount: undefined, paidAmount: undefined }] } });
    const current = screen.getByLabelText("Tình trạng kỳ đóng gần nhất");
    expect(current).not.toHaveTextContent("13.000.000");
    expect(current).not.toHaveTextContent("1.300.000");
  });

  it("preserves edited period, payment data and version after a rejected update", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Kỳ đóng đã thay đổi. Vui lòng tải lại." } }) });
    vi.stubGlobal("fetch", fetchMock);
    show();
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật kỳ 10/2026" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Số tiền đã đóng"), { target: { value: "1300000" } });
    fireEvent.change(within(dialog).getByLabelText("Ghi chú"), { target: { value: "Đang đối chiếu lần hai" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Kỳ đóng đã thay đổi");
    expect(within(dialog).getByLabelText("Số tiền đã đóng")).toHaveValue(1300000);
    expect(within(dialog).getByLabelText("Ghi chú")).toHaveValue("Đang đối chiếu lần hai");
    expect(within(dialog).getByLabelText(/Kỳ đóng/)).toHaveAttribute("readonly");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({ employeeId: record.employeeId, contributionMonth: "2026-10", paidAmount: 1300000, expectedUpdatedAt: contribution.updatedAt });
    expect(within(dialog).getByRole("button", { name: "Lưu kỳ đóng" })).toBeEnabled();
  });

  it("clears payment date and amount when switching back to unpaid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    show(); fireEvent.click(screen.getByRole("button", { name: "Cập nhật kỳ 10/2026" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Tình trạng đóng" }));
    fireEvent.click(screen.getByRole("option", { name: "Chưa đóng" }));
    expect(screen.queryByLabelText("Số tiền đã đóng")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ngày đóng")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.paymentStatus).toBe("pending"); expect(payload).not.toHaveProperty("paidAmount"); expect(payload).not.toHaveProperty("paidDate");
  });

  it("rejects duplicate new month in place and serializes repeated submit clicks", async () => {
    let resolve!: (result: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((next) => { resolve = next; }));
    vi.stubGlobal("fetch", fetchMock);
    show(); fireEvent.click(screen.getByRole("button", { name: "Ghi nhận kỳ đóng" }));
    fireEvent.change(screen.getByLabelText(/Kỳ đóng/), { target: { value: "2026-10" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Kỳ đóng đã có");
    expect(screen.getByRole("button", { name: "Lưu kỳ đóng" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Kỳ đóng/), { target: { value: "2026-09" } });
    const form = screen.getByRole("dialog").querySelector("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Lưu kỳ đóng" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Ghi nhận kỳ đóng BHXH");
    resolve({ ok: true, json: async () => ({ data: {} }) });
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu kỳ đóng");
  });

  it("does not submit a second write when refreshing after a successful save fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    const onUpdated = vi.fn().mockRejectedValue(new Error("Mất kết nối"));
    vi.stubGlobal("fetch", fetchMock);
    show({ onUpdated }); fireEvent.click(screen.getByRole("button", { name: "Cập nhật kỳ 10/2026" }));
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Đã lưu kỳ đóng. Không thể tải lại dữ liệu.");
    expect(screen.queryByRole("button", { name: "Lưu kỳ đóng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard tab selection and only displays authorized adjustment events", () => {
    show({ canViewHistory: true });
    const first = screen.getByRole("tab", { name: /Quá trình đóng/ }); first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Lịch sử điều chỉnh" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Lịch sử điều chỉnh" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Chưa có lịch sử điều chỉnh")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Lịch sử điều chỉnh" }), { key: "Home" });
    expect(first).toHaveFocus(); expect(first).toHaveAttribute("aria-selected", "true");
  });
});
