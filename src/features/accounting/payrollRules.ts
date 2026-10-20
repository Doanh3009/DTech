export type PayrollPayBasis = "actual" | "paid_time";
export interface PayrollInputEmployee {
  employeeId: string; employeeCode: string; employeeName: string;
  scheduledWorkdays: number; actualWorkdays: number; annualLeaveDays: number; businessTripDays: number;
  dailyCount: number; dailyWorkdays: number; businessTripExtraDays: number;
  salaryHistoryId?: string; contractSalary: number; allowance: number; bonus: number; deduction: number;
  effectiveDate?: string;
}
export interface PayrollReadiness {
  timesheetId?: string; timesheetName?: string; timesheetStatus?: string; timesheetVersion?: number;
  calculatedTimesheetVersion?: number; startDate?: string; endDate?: string; payBasis: PayrollPayBasis;
  employees: PayrollInputEmployee[]; openHighExceptions: number;
}
export function payrollInputIssues(input: PayrollReadiness) {
  const issues: Array<{ employeeId?: string; employeeName?: string; code: string; label: string }> = [];
  if (!input.timesheetId || input.timesheetStatus !== "locked") issues.push({ code: "unlocked", label: "Kỳ công chưa chốt" });
  if (!input.employees.length) issues.push({ code: "empty", label: "Kỳ công chưa có tổng hợp" });
  if (input.openHighExceptions) issues.push({ code: "exceptions", label: `${input.openHighExceptions} ngoại lệ nghiêm trọng chưa xử lý` });
  for (const item of input.employees) {
    const person = { employeeId: item.employeeId, employeeName: item.employeeName };
    if (!item.salaryHistoryId) issues.push({ ...person, code: "salary", label: "Thiếu hồ sơ lương hiệu lực" });
    if (!item.dailyCount) issues.push({ ...person, code: "daily", label: "Thiếu bản ghi công từng ngày" });
    else if (Math.abs(item.actualWorkdays - item.dailyWorkdays) > .01) issues.push({ ...person, code: "mismatch", label: "Tổng công lệch chi tiết ngày" });
    if (!(item.scheduledWorkdays > 0)) issues.push({ ...person, code: "scheduled", label: "Chưa có ngày công chuẩn" });
    if (item.actualWorkdays > item.scheduledWorkdays + .01) issues.push({ ...person, code: "excess", label: "Công thực tế vượt công chuẩn" });
  }
  return issues;
}
export function calculatePayrollInput(item: PayrollInputEmployee, basis: PayrollPayBasis) {
  if (!(item.scheduledWorkdays > 0)) throw new RangeError("Ngày công chuẩn phải lớn hơn 0");
  const paidLeave = basis === "paid_time" ? item.annualLeaveDays : 0;
  const businessTrip = basis === "paid_time" ? item.businessTripExtraDays : 0;
  const payableWorkdays = Math.min(item.scheduledWorkdays, item.actualWorkdays + paidLeave + businessTrip);
  const ratio = payableWorkdays / item.scheduledWorkdays;
  const baseSalary = Math.round(item.contractSalary * ratio);
  return { payableWorkdays, paidLeave, businessTrip, ratio, baseSalary, gross: baseSalary + item.allowance + item.bonus, net: baseSalary + item.allowance + item.bonus - item.deduction };
}
