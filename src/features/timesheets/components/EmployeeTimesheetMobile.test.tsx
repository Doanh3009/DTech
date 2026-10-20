import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyTimesheet, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";
import { EmployeeTimesheetMobile } from "./EmployeeTimesheetMobile";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
const period: TimesheetPeriod = { id: "period", code: "2026-10", name: "Tháng 10/2026", startDate: "2026-10-01", endDate: "2026-10-31", status: "open", version: 1, rowVersion: 3 };
const summary = { employeeId: "employee", employeeCode: "NV01", employeeName: "Nguyễn Minh An", departmentName: "Nhân sự", actualWorkdays: 22, lateDays: 3, annualLeaveDays: 1.5, unpaidLeaveDays: 0.5, absentDays: 2, exceptionCount: 1 } as TimesheetSummary;
const daily: DailyTimesheet = { id: "day", periodId: "period", employeeId: "employee", employeeCode: "NV01", employeeName: "Nguyễn Minh An", departmentName: "Nhân sự", positionName: "", employmentTypeName: "", workDate: "2026-10-01", status: "late", workFraction: 1, shiftName: "Hành chính", shiftStart: "08:00", shiftEnd: "17:00", effectiveCheckIn: "2026-10-01T01:12:00Z", effectiveCheckOut: "2026-10-01T10:00:00Z", workMinutes: 468, lateMinutes: 12, earlyLeaveMinutes: 0, leaveFraction: 0, exceptionCount: 1, sources: ["SELF_ATTENDANCE"], adjustments: [], rawSource: {}, calculationVersion: 1 };
function mockData(days = [daily], currentPeriod = period) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: { period: currentPeriod, summaries: [summary], daily: [...days, { ...daily, id: "other-day", employeeId: "other", employeeCode: "NV02", workDate: "2026-10-02" }] } }) })));
}
beforeEach(() => mockData());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("individual employee attendance calendar", () => {
  it("shows a single full-period calendar and retains saved summary totals", async () => {
    render(<EmployeeTimesheetMobile periodId="period" employeeId="NV01"/>);
    await screen.findByRole("heading", { name: "Nguyễn Minh An" });
    expect(screen.getAllByRole("button", { name: /^\d{2}\/10\/2026:/ })).toHaveLength(31);
    expect(screen.getByRole("button", { name: "01/10/2026: Đi muộn" })).toHaveTextContent("01/10M");
    expect(screen.getByRole("button", { name: "02/10/2026: Chưa có dữ liệu" })).toBeInTheDocument();
    const metrics = screen.getByText("Ngày công").closest("dl")!;
    expect(within(metrics).getByText("22")).toBeInTheDocument();
    expect(within(metrics).getByText("3")).toBeInTheDocument();
    expect(within(metrics).getByText("1,5")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chưa đủ dữ liệu công từng ngày");
  });
  it("opens only the selected day with local business time and permitted adjustment", async () => {
    render(<EmployeeTimesheetMobile periodId="period" employeeId="employee" canAdjust/>);
    fireEvent.click(await screen.findByRole("button", { name: "01/10/2026: Đi muộn" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("08:12")).toBeInTheDocument();
    expect(within(dialog).getByText("17:00")).toBeInTheDocument();
    expect(within(dialog).getByText("12 phút")).toBeInTheDocument();
    expect(within(dialog).getByText("Tự chấm công")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Điều chỉnh công" })).toHaveAttribute("href", "/timesheets/adjustments?periodId=period&employeeId=employee&date=2026-10-01&rowVersion=3");
  });
  it("does not invent a daily record when only aggregate totals are available", async () => {
    mockData([]);
    render(<EmployeeTimesheetMobile periodId="period" employeeId="NV01" canAdjust/>);
    fireEvent.click(await screen.findByRole("button", { name: "01/10/2026: Chưa có dữ liệu" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Chưa có bản ghi công cho ngày này")).toBeInTheDocument();
    expect(within(dialog).queryByText("Ca làm")).not.toBeInTheDocument();
    const metrics = screen.getByText("Ngày công").closest("dl")!;
    expect(within(metrics).getByText("22")).toBeInTheDocument();
    expect(within(metrics).getByText("3")).toBeInTheDocument();
  });
  it("keeps adjustment actions hidden for read-only users", async () => {
    render(<EmployeeTimesheetMobile periodId="period" employeeId="NV01"/>);
    fireEvent.click(await screen.findByRole("button", { name: "01/10/2026: Đi muộn" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("link", { name: "Điều chỉnh công" })).not.toBeInTheDocument();
  });
  it("keeps adjustment actions hidden for a locked period", async () => {
    mockData([daily], { ...period, status: "locked" });
    render(<EmployeeTimesheetMobile periodId="period" employeeId="NV01" canAdjust/>);
    fireEvent.click(await screen.findByRole("button", { name: "01/10/2026: Đi muộn" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("link", { name: "Điều chỉnh công" })).not.toBeInTheDocument();
  });
  it("supports incoming date links while keeping the whole calendar available", async () => {
    render(<EmployeeTimesheetMobile periodId="period" employeeId="NV01" selectedDate="2026-10-01"/>);
    expect(await screen.findByRole("dialog")).toHaveAccessibleName("Nguyễn Minh An · 01/10/2026");
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    expect(screen.getAllByRole("button", { name: /^\d{2}\/10\/2026:/ })).toHaveLength(31);
  });
  it("ignores incoming dates outside the selected period", async () => {
    render(<EmployeeTimesheetMobile periodId="period" employeeId="NV01" selectedDate="2026-09-01"/>);
    await screen.findByRole("heading", { name: "Nguyễn Minh An" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
