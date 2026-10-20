import { payrollInputIssues } from "./payrollRules";
import type { PayrollDetail } from "./types";

export function payrollWorkflow(data: PayrollDetail) {
  const readiness = data.readiness;
  const inputIssues = readiness ? payrollInputIssues(readiness) : [];
  const calculated = data.status !== "draft";
  const staleTimesheet = Boolean(readiness && calculated && (readiness.calculatedTimesheetVersion == null || readiness.calculatedTimesheetVersion !== readiness.timesheetVersion));
  const inputByEmployee = new Map(readiness?.employees.map(item => [item.employeeId, item]) ?? []);
  const rosterChanged = Boolean(readiness && calculated && (readiness.employees.length !== data.lines.length || data.lines.some(item => !inputByEmployee.has(item.employeeId))));
  const changedSalary = Boolean(readiness && calculated && data.lines.some(item => inputByEmployee.get(item.employeeId)?.salaryHistoryId !== item.calculation?.salaryHistoryId));
  const negativeLines = data.lines.filter(item => item.netSalary < 0);
  const sent = data.lines.filter(item => item.payslipStatus === "published").length;
  const pending = data.lines.filter(item => item.payslipStatus !== "published");
  const missingRecipients = pending.filter(item => item.deliveryReady === false);
  const inputReady = Boolean(readiness && !inputIssues.length);
  const needsRecalculation = staleTimesheet || changedSalary || rosterChanged;
  const readyToReview = inputReady && !needsRecalculation && data.lines.length > 0 && !negativeLines.length;
  const locked = data.status === "locked" || data.status === "published";
  return {
    inputIssues, staleTimesheet, rosterChanged, changedSalary, negativeLines, sent, pending, missingRecipients,
    inputReady, needsRecalculation, readyToReview, locked,
    readyToPublish: readyToReview && !missingRecipients.length && data.status === "locked"
  };
}
