import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PayslipDetail } from "./PayslipDetail";
import type { Payslip } from "../types";

vi.mock("@/lib/ui/useMobileViewport", () => ({ useMobileViewport: () => true }));

afterEach(() => vi.unstubAllGlobals());

describe("mobile payslip detail scope", () => {
  it("checks employee ownership when opening a direct payslip URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Không tìm thấy phiếu lương." } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<PayslipDetail id="someone-elses-slip" selfOnly />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/accounting/payslips/someone-elses-slip?scope=self", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) })));
  });
});

const slip: Payslip = { id: "slip-1", payrollLineId: "line-1", employeeId: "employee-1", employeeCode: "NV001", employeeName: "Nguyễn Văn Cường", periodMonth: "2026-12-01", version: 2, status: "published", publishedAt: "2026-12-31T03:00:00Z", viewedAt: "2026-12-31T04:00:00Z", snapshot: { workDays: 22, baseSalary: 12_000_000, allowance: 1_000_000, bonus: 500_000, leaveCashoutAmount: 300_000, deduction: 200_000, netSalary: 13_600_000, calculation: { contractSalary: 12_000_000, scheduledWorkdays: 22, paidLeaveDays: 1, payableWorkdays: 22, ratio: 1, payBasis: "paid_time", leaveCashout: [{ year: 2026, days: 1, dailyRate: 300_000, leaveTypeName: "Phép năm" }] } } };
const response = (data: Payslip) => ({ ok: true, json: async () => ({ data }) });

describe("payslip detail presentation", () => {
  it("separates income, deduction, cashout and the saved calculation basis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(slip)));
    render(<PayslipDetail id="slip-1" selfOnly />);
    await screen.findByRole("heading", { name: "Nguyễn Văn Cường" });
    expect(screen.getByText("Lương theo công")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Thực nhận" })).toHaveTextContent("13.600.000");
    expect(screen.getByRole("region", { name: "Thực nhận" })).toHaveTextContent("13.800.000");
    const cashout = screen.getByText("Thanh toán phép cuối năm").closest("details")!;
    fireEvent.click(within(cashout).getByText("Thanh toán phép cuối năm"));
    expect(cashout).toHaveTextContent("Phép năm · 2026");
    expect(cashout).toHaveTextContent("1 ngày × 300.000");
    const basis = screen.getByText("Căn cứ tính lương").closest("details")!;
    fireEvent.click(within(basis).getByText("Căn cứ tính lương"));
    expect(basis).toHaveTextContent("Lương thỏa thuận");
    expect(basis).toHaveTextContent("Công, phép và công tác hưởng lương");
  });

  it("confirms only once using the issued version and updates the receipt", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(slip)).mockResolvedValueOnce(response({ ...slip, confirmedAt: "2026-12-31T05:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PayslipDetail id="slip-1" selfOnly />);
    const confirm = await screen.findByRole("button", { name: "Xác nhận phiếu lương" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole("button", { name: "Xác nhận phiếu lương" })).not.toBeInTheDocument());
    expect(within(screen.getByRole("region", { name: "Tiếp nhận phiếu lương" })).getByText("Đã xác nhận")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/v1/accounting/payslips/slip-1/confirm", expect.objectContaining({ method: "POST", body: JSON.stringify({ version: 2 }) }));
  });

  it("keeps the confirmation available with an inline error after failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(slip)).mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Phiếu lương vừa được cập nhật." } }) }));
    render(<PayslipDetail id="slip-1" selfOnly />);
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận phiếu lương" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent("Phiếu lương vừa được cập nhật.");
    expect(screen.getByRole("button", { name: "Xác nhận phiếu lương" })).not.toBeDisabled();
  });

  it("does not show an employee confirmation action in the accountant view", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(slip)));
    render(<PayslipDetail id="slip-1" />);
    await screen.findByRole("heading", { name: "Nguyễn Văn Cường" });
    expect(screen.queryByRole("button", { name: "Xác nhận phiếu lương" })).not.toBeInTheDocument();
  });

  it("labels revoked versions clearly and keeps their historical amount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...slip, status: "revoked", revokedAt: "2026-12-31T06:00:00Z", revokeReason: "Điều chỉnh phụ cấp" })));
    render(<PayslipDetail id="slip-1" />);
    await screen.findByRole("heading", { name: "Nguyễn Văn Cường" });
    expect(screen.getByRole("region", { name: "Thông tin thu hồi" })).toHaveTextContent("Điều chỉnh phụ cấp");
    expect(screen.getByRole("region", { name: "Thực nhận" })).toHaveTextContent("13.600.000");
    expect(screen.queryByRole("button", { name: "Xác nhận phiếu lương" })).not.toBeInTheDocument();
  });
});
