import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyTimesheet, TimesheetPeriod, TimesheetSummary } from "../types/timesheetTypes";
import { TimesheetMatrix } from "./TimesheetMatrix";

vi.mock("@/lib/realtime/useDomainReconciliation", () => ({ useDomainReconciliation: vi.fn() }));
const period: TimesheetPeriod = { id: "period", code: "2026-10", name: "Tháng 10/2026", startDate: "2026-10-01", endDate: "2026-10-31", status: "open", version: 1, rowVersion: 3 };
const summary: TimesheetSummary = { id: "summary", periodId: "period", employeeId: "employee", employeeCode: "NV01", employeeName: "Nguyễn Minh An", departmentName: "Nhân sự", positionName: "", employmentTypeName: "", scheduledWorkdays: 26, actualWorkdays: 22, workedMinutes: 10560, lateDays: 3, lateMinutes: 35, earlyLeaveDays: 0, earlyLeaveMinutes: 0, annualLeaveDays: 1.5, unpaidLeaveDays: 0.5, absentDays: 2, businessTripDays: 0, holidayDays: 0, missingCheckInDays: 0, missingCheckOutDays: 0, exceptionCount: 0 };
const daily: DailyTimesheet = { id: "day", periodId: "period", employeeId: "employee", employeeCode: "NV01", employeeName: summary.employeeName, departmentName: "Nhân sự", positionName: "", employmentTypeName: "", workDate: "2026-10-01", status: "full_work", workFraction: 1, shiftName: "Hành chính", shiftStart: "08:00", shiftEnd: "17:00", workMinutes: 480, lateMinutes: 0, earlyLeaveMinutes: 0, leaveFraction: 0, exceptionCount: 0, sources: ["SELF_ATTENDANCE"], adjustments: [], rawSource: {}, calculationVersion: 1 };
function mockData(summaries: TimesheetSummary[] = [summary], days: DailyTimesheet[] = [daily], periods = [period]) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url === "/api/v1/timesheet-periods" ? periods : { period: periods.find(item => url.endsWith(item.id)) ?? period, summaries, daily: days } }) })));
}
beforeEach(() => mockData());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("employee attendance summary list", () => {
  it("finishes loading when no periods have been created", async () => {
    mockData([], [], []);
    render(<TimesheetMatrix/>);
    expect(await screen.findByText("Chưa có kỳ công")).toBeInTheDocument();
    expect(screen.queryByText("Đang tải bảng công…")).not.toBeInTheDocument();
  });
  it("shows one compact employee row with saved totals and opens their calendar", async () => {
    render(<TimesheetMatrix/>);
    const table = await screen.findByRole("table", { name: "Bảng công tổng hợp nhân viên" });
    expect(within(table).getAllByRole("columnheader").map(item => item.textContent)).toEqual(["Nhân viên", "Ngày công", "Đi trễ", "Nghỉ phép", "Không lương", "Vắng", "Trạng thái"]);
    const row = within(table).getAllByRole("row")[1];
    expect(within(row).getAllByRole("cell").map(item => item.textContent)).toEqual(["22", "3", "1,5", "0,5", "2", "Cần rà soát"]);
    expect(within(row).getByRole("link", { name: /Nguyễn Minh An/ })).toHaveAttribute("href", "/timesheets/periods/period/employees/NV01");
    expect(within(row).getByText("NV01 · Nhân sự")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /01\/10\/2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tuần" })).not.toBeInTheDocument();
  });
  it("retains known late and leave totals when the daily rows are completely missing", async () => {
    mockData([summary], []);
    render(<TimesheetMatrix/>);
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("cell", { name: "3" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "1,5" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 hồ sơ thiếu dữ liệu từng ngày");
  });
  it("searches and filters by department while preserving whole-period totals", async () => {
    mockData([summary, { ...summary, employeeId: "other", employeeCode: "NV02", employeeName: "Trần Văn Bình", departmentName: "Kỹ thuật", actualWorkdays: 20 }], []);
    render(<TimesheetMatrix/>);
    await screen.findByRole("table");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), { target: { value: "NV02" } });
    expect(screen.queryByRole("link", { name: /Nguyễn Minh An/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trần Văn Bình/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Tổng hợp kỳ công")).toHaveTextContent("42");
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Phòng ban" }));
    fireEvent.click(await screen.findByRole("option", { name: "Nhân sự" }));
    expect(screen.getByRole("link", { name: /Nguyễn Minh An/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Trần Văn Bình/ })).not.toBeInTheDocument();
  });
  it("filters review issues without altering stable employee order", async () => {
    mockData([{ ...summary, actualWorkdays: 1 }, { ...summary, employeeId: "other", employeeName: "Trần Văn Bình", actualWorkdays: 0, exceptionCount: 1 }]);
    render(<TimesheetMatrix/>);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Cần rà soát · 1" }));
    expect(screen.queryByRole("link", { name: /Nguyễn Minh An/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trần Văn Bình/ })).toBeInTheDocument();
  });
  it("paginates long rosters and resets the page after searching", async () => {
    mockData(Array.from({ length: 52 }, (_, index) => ({ ...summary, employeeId: `employee-${index}`, employeeCode: `NV${index}`, employeeName: `Nhân viên ${index}` })), []);
    render(<TimesheetMatrix/>);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(21);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp" }));
    expect(screen.getByRole("link", { name: /^Nhân viên 20 / })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm nhân viên" }), { target: { value: "Nhân viên 51" } });
    expect(screen.getByRole("link", { name: /^Nhân viên 51 / })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp" })).not.toBeInTheDocument();
  });
  it("restores the period requested by the employee calendar back link", async () => {
    const previous = { ...period, id: "previous", name: "Tháng 09/2026", startDate: "2026-09-01", endDate: "2026-09-30" };
    mockData([summary], [], [period, previous]);
    render(<TimesheetMatrix initialPeriodId="previous"/>);
    await screen.findByRole("table");
    expect(screen.getByRole("combobox", { name: "Kỳ công" })).toHaveTextContent("Tháng 09/2026");
    expect(screen.getByRole("link", { name: /Nguyễn Minh An/ })).toHaveAttribute("href", "/timesheets/periods/previous/employees/NV01");
    fireEvent.click(screen.getByRole("combobox", { name: "Kỳ công" }));
    fireEvent.click(await screen.findByRole("option", { name: "Tháng 10/2026" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Nguyễn Minh An/ })).toHaveAttribute("href", "/timesheets/periods/period/employees/NV01"));
  });
});
