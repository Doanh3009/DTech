import { describe, expect, it } from "vitest";
import { payrollWorkflow } from "./payrollWorkflow";
import type { PayrollDetail } from "./types";
const input = { employeeId: "employee-1", employeeCode: "NV01", employeeName: "Nguyễn Minh Anh", scheduledWorkdays: 22, actualWorkdays: 20, annualLeaveDays: 2, businessTripDays: 0, businessTripExtraDays: 0, dailyCount: 30, dailyWorkdays: 20, salaryHistoryId: "salary-1", contractSalary: 22_000_000, allowance: 1_000_000, bonus: 0, deduction: 0 };
const detail: PayrollDetail = { id: "payroll-1", periodMonth: "2026-09-01", status: "calculated", rowVersion: 2, lineCount: 1, grossTotal: 21_000_000, deductionTotal: 0, netTotal: 21_000_000, updatedAt: "2026-10-16T00:00:00Z", lines: [{ id: "line-1", employeeId: input.employeeId, employeeName: input.employeeName, employeeCode: input.employeeCode, workDays: 20, baseSalary: 20_000_000, allowance: 1_000_000, bonus: 0, deduction: 0, netSalary: 21_000_000, rowVersion: 1, calculation: { salaryHistoryId: "salary-1" }, deliveryReady: true }], readiness: { timesheetId: "timesheet-1", timesheetStatus: "locked", timesheetVersion: 1, calculatedTimesheetVersion: 1, payBasis: "actual", employees: [input], openHighExceptions: 0 } };
describe("simple payroll approval readiness", () => {
  it("separates salary approval from payslip approval without stage navigation", () => {
    expect(payrollWorkflow({ ...detail, status: "draft", lines: [] })).toMatchObject({ inputReady: true, readyToReview: false });
    expect(payrollWorkflow(detail)).toMatchObject({ readyToReview: true, readyToPublish: false });
    expect(payrollWorkflow({ ...detail, status: "reviewed" }).readyToReview).toBe(true);
    expect(payrollWorkflow({ ...detail, status: "locked" })).toMatchObject({ readyToPublish: true });
    expect(payrollWorkflow({ ...detail, status: "published" })).toMatchObject({ readyToPublish: false });
  });
  it("returns stale or uncalculated source versions to preparation", () => {
    expect(payrollWorkflow({ ...detail, status: "published", readiness: { ...detail.readiness!, timesheetVersion: 2 } })).toMatchObject({ staleTimesheet: true, readyToReview: false, locked: true });
    expect(payrollWorkflow({ ...detail, readiness: { ...detail.readiness!, calculatedTimesheetVersion: undefined } }).staleTimesheet).toBe(true);
  });
  it("compares roster identities as well as counts before review", () => {
    expect(payrollWorkflow({ ...detail, readiness: { ...detail.readiness!, employees: [{ ...input, employeeId: "other" }] } })).toMatchObject({ rosterChanged: true, readyToReview: false });
    expect(payrollWorkflow({ ...detail, readiness: { ...detail.readiness!, employees: [input, { ...input, employeeId: "second" }] } }).rosterChanged).toBe(true);
  });
  it("invalidates review after the effective salary profile changes", () => {
    expect(payrollWorkflow({ ...detail, readiness: { ...detail.readiness!, employees: [{ ...input, salaryHistoryId: "salary-2" }] } })).toMatchObject({ changedSalary: true, readyToReview: false });
  });
  it("blocks negative net, missing salary, and unavailable inputs", () => {
    expect(payrollWorkflow({ ...detail, lines: [{ ...detail.lines[0], netSalary: -1 }] })).toMatchObject({ readyToReview: false, negativeLines: [expect.objectContaining({ netSalary: -1 })] });
    expect(payrollWorkflow({ ...detail, readiness: { ...detail.readiness!, employees: [{ ...input, salaryHistoryId: undefined }] } }).inputReady).toBe(false);
    expect(payrollWorkflow({ ...detail, readiness: undefined }).readyToReview).toBe(false);
  });
  it("counts only published snapshots and checks recipients only for remaining employees", () => {
    const published = { ...detail.lines[0], payslipStatus: "published" as const, deliveryReady: false };
    const pending = { ...detail.lines[0], id: "line-2", employeeId: "second", deliveryReady: false };
    const flow = payrollWorkflow({ ...detail, status: "locked", lines: [published, pending] });
    expect(flow.sent).toBe(1); expect(flow.pending).toEqual([pending]); expect(flow.missingRecipients).toEqual([pending]); expect(flow.readyToPublish).toBe(false);
  });
});
