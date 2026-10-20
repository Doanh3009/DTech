import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthenticatedUser } from "@/lib/auth/permissions";
import type { LeaveSettlementOverview } from "@/features/leave/types/leaveSettlement";
import { LeaveYearEndSettlement } from "./LeaveYearEndSettlement";

const { actor } = vi.hoisted(() => ({ actor: { permissions: ["leave.balance.view_all", "leave.balance.adjust", "payroll.view"] } }));
vi.mock("@/components/providers/CurrentUserProvider", () => ({ useCurrentUser: () => actor as unknown as AuthenticatedUser }));
const overview: LeaveSettlementOverview = {
  year: 2025, rows: [
    { employeeId: "employee-a", employeeCode: "NV001", employeeName: "Nguyễn Minh An", leaveTypeId: "annual", leaveTypeName: "Phép năm", leaveTypeCode: "ANNUAL", balanceDays: 3, days: 3, dailyRate: 400000, rateVersion: 2, amount: 1200000, status: "waiting_payroll" },
    { employeeId: "employee-b", employeeCode: "NV002", employeeName: "Trần Thị Bình", leaveTypeId: "annual", leaveTypeName: "Phép năm", leaveTypeCode: "ANNUAL", balanceDays: 2, days: 2, dailyRate: 500000, rateVersion: 1, amount: 1000000, status: "included", payrollPeriodId: "payroll-a" },
    { employeeId: "employee-a", employeeCode: "NV001", employeeName: "Nguyễn Minh An", leaveTypeId: "bonus", leaveTypeName: "Phép bổ sung", leaveTypeCode: "BONUS", balanceDays: 100, days: 100, dailyRate: null, rateVersion: null, amount: 0, status: "missing_rate" }
  ]
};

function setup(permissions = ["leave.balance.view_all", "leave.balance.adjust", "payroll.view"], data = overview) {
  actor.permissions = permissions;
  const fetcher = vi.fn((url: string, init?: RequestInit) => { void url; void init; return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) }); });
  vi.stubGlobal("fetch", fetcher);
  render(<LeaveYearEndSettlement initialYear={2025} />);
  return fetcher;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("year-end leave settlement UI", () => {
  it("summarizes only the selected leave type and locks rates already included in payroll", async () => {
    setup();
    expect(await screen.findAllByText("5 ngày")).toHaveLength(2);
    expect(screen.queryByText("105 ngày")).not.toBeInTheDocument();
    const rateButtons = screen.getAllByRole("button", { name: "Đơn giá" });
    expect(rateButtons.some((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.getAllByRole("link", { name: /Xem lương|Xem bảng lương/ })[0]).toHaveAttribute("href", "/accounting/payroll/payroll-a/employees/employee-b");
  });

  it("sends the captured version and reason when saving an HR rate", async () => {
    const fetcher = setup();
    const rateButtons = await screen.findAllByRole("button", { name: "Đơn giá" });
    fireEvent.click(rateButtons.find((button) => !button.hasAttribute("disabled"))!);
    const editor = await screen.findByRole("dialog", { name: "Đơn giá tiền phép" });
    fireEvent.change(within(editor).getByLabelText(/Đơn giá một ngày/), { target: { value: "450000" } });
    fireEvent.change(within(editor).getByLabelText(/Lý do/), { target: { value: "Theo xác nhận nhân sự" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Lưu đơn giá" }));
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    const saved = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(saved[0]).toBe("/api/v1/leave-settlements");
    expect(JSON.parse(saved[1]!.body as string)).toEqual({ year: 2025, employeeId: "employee-a", leaveTypeId: "annual", dailyRate: 450000, expectedVersion: 2, reason: "Theo xác nhận nhân sự" });
  });

  it("keeps rate editing hidden for a viewer", async () => {
    setup(["leave.balance.view_all"]);
    await screen.findAllByText("5 ngày");
    expect(screen.queryByRole("button", { name: "Đơn giá" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Xem lương|Xem bảng lương/ })).not.toBeInTheDocument();
  });

  it("does not request settlement data without the server-required viewing permission", async () => {
    const fetcher = setup(["leave.balance.adjust"]);
    expect(await screen.findByRole("heading", { name: "Không có quyền truy cập" })).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("validates the integer rate and a meaningful reason before sending any update", async () => {
    const fetcher = setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "Đơn giá" })).find((button) => !button.hasAttribute("disabled"))!);
    const dialog = screen.getByRole("dialog", { name: "Đơn giá tiền phép" });
    fireEvent.change(within(dialog).getByLabelText(/Đơn giá một ngày/), { target: { value: "0.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu đơn giá" }));
    expect(within(dialog).getByText("Đơn giá từ 1 đến 1.000.000.000 đ, không có phần lẻ.")).toBeInTheDocument();
    expect(within(dialog).getByText("Lý do cần ít nhất 3 ký tự.")).toBeInTheDocument();
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(0);
  });

  it("prevents duplicate submissions and dismissal while the update is pending", async () => {
    const fetcher = setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "Đơn giá" })).find((button) => !button.hasAttribute("disabled"))!);
    const dialog = screen.getByRole("dialog", { name: "Đơn giá tiền phép" });
    fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Đơn giá nhân sự duyệt" } });
    let finish!: (value: Awaited<ReturnType<typeof fetcher>>) => void;
    fetcher.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const save = within(dialog).getByRole("button", { name: "Lưu đơn giá" });
    fireEvent.click(save); fireEvent.click(save);
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Đóng" }));
    expect(dialog).toBeInTheDocument();
    finish({ ok: true, json: () => Promise.resolve({ ok: true, data: overview }) });
    expect(await screen.findByRole("status")).toHaveTextContent("Đã lưu đơn giá tiền phép.");
  });

  it("preserves the editor and re-enables saving after a version conflict", async () => {
    const fetcher = setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "Đơn giá" })).find((button) => !button.hasAttribute("disabled"))!);
    const dialog = screen.getByRole("dialog", { name: "Đơn giá tiền phép" });
    fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Theo xác nhận nhân sự" } });
    fetcher.mockImplementationOnce(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false, error: { message: "Đơn giá vừa thay đổi. Hãy tải lại." } }) } as unknown as Awaited<ReturnType<typeof fetcher>>));
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu đơn giá" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Đơn giá vừa thay đổi. Hãy tải lại.");
    expect(within(dialog).getByRole("button", { name: "Lưu đơn giá" })).toBeEnabled();
    expect(within(dialog).getByLabelText(/Lý do/)).toHaveValue("Theo xác nhận nhân sự");
  });

  it("saves a first rate with a null expected version for the selected leave type", async () => {
    const fetcher = setup(undefined, { ...overview, rows: [overview.rows[2]] });
    fireEvent.click((await screen.findAllByRole("button", { name: "Đơn giá" }))[0]);
    const dialog = screen.getByRole("dialog", { name: "Đơn giá tiền phép" });
    fireEvent.change(within(dialog).getByLabelText(/Đơn giá một ngày/), { target: { value: "500000" } });
    fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Nhân sự nhập đơn giá mới" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu đơn giá" }));
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    const saved = fetcher.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(JSON.parse(saved[1]!.body as string)).toEqual({ year: 2025, employeeId: "employee-a", leaveTypeId: "bonus", dailyRate: 500000, expectedVersion: null, reason: "Nhân sự nhập đơn giá mới" });
  });

  it("keeps the entered rate available after a network failure", async () => {
    const fetcher = setup();
    fireEvent.click((await screen.findAllByRole("button", { name: "Đơn giá" })).find((button) => !button.hasAttribute("disabled"))!);
    const dialog = screen.getByRole("dialog", { name: "Đơn giá tiền phép" });
    fireEvent.change(within(dialog).getByLabelText(/Đơn giá một ngày/), { target: { value: "450000" } });
    fireEvent.change(within(dialog).getByLabelText(/Lý do/), { target: { value: "Nhân sự xác nhận" } });
    fetcher.mockRejectedValueOnce(new Error("Mất kết nối mạng"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu đơn giá" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Mất kết nối mạng");
    expect(within(dialog).getByLabelText(/Đơn giá một ngày/)).toHaveValue(450000);
    expect(within(dialog).getByRole("button", { name: "Lưu đơn giá" })).toBeEnabled();
  });

  it("shows a low-rate warning and supports searching an uppercase Vietnamese Đ without accents", async () => {
    setup(undefined, { ...overview, rows: [{ ...overview.rows[0], employeeName: "Đỗ Minh Đức", days: 0.1, dailyRate: 1, amount: 0, status: "invalid_rate" }] });
    await screen.findAllByText("Đỗ Minh Đức");
    expect(screen.getAllByText("Đơn giá quá thấp")).toHaveLength(3);
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), { target: { value: "do minh duc" } });
    expect(screen.queryByText("Không có nhân viên phù hợp")).not.toBeInTheDocument();
    expect(screen.getAllByText("Đỗ Minh Đức")).toHaveLength(2);
  });
});
