import type { PayrollPeriod, Payslip, SalaryRecord } from "./types";

const comparePeriods = (first: PayrollPeriod, second: PayrollPeriod) => first.periodMonth.localeCompare(second.periodMonth) || first.id.localeCompare(second.id);

export function summarizeAccounting(periods: readonly PayrollPeriod[], salaries: readonly SalaryRecord[], slips: readonly Payslip[], businessDate: string, pendingDeliveryPeriodIds: readonly string[] = []) {
  const throughMonth = businessDate.slice(0, 7);
  const [year, month] = throughMonth.split("-").map(Number);
  const fromMonth = new Date(Date.UTC(year, month - 6, 1)).toISOString().slice(0, 7);
  const latestPublished = new Map<string, Payslip>();
  for (const slip of slips) {
    if (slip.status !== "published") continue;
    const key = `${slip.employeeId}:${slip.periodMonth.slice(0, 7)}`;
    const previous = latestPublished.get(key);
    if (!previous || slip.version > previous.version || slip.version === previous.version && (slip.publishedAt ?? "") > (previous.publishedAt ?? "")) latestPublished.set(key, slip);
  }
  const published = [...latestPublished.values()];
  const reportingPayrolls = periods.filter(period => ["locked", "published"].includes(period.status) && period.periodMonth.slice(0, 7) >= fromMonth && period.periodMonth.slice(0, 7) <= throughMonth).sort(comparePeriods);
  const deliveryPeriods = new Set(pendingDeliveryPeriodIds);
  const pendingPayrolls = periods.filter(period => period.status !== "published" || Boolean(period.syncIssue) || (period.pendingDeliveryCount ?? 0) > 0 || deliveryPeriods.has(period.id)).sort(comparePeriods);
  const payslipMonth = published.map(slip => slip.periodMonth.slice(0, 7)).filter(value => value <= throughMonth).sort().at(-1);
  const reportingPayslips = payslipMonth ? published.filter(slip => slip.periodMonth.slice(0, 7) === payslipMonth) : [];
  return {
    salaryProfiles: new Set(salaries.map(item => item.employeeId)).size,
    openPayrolls: periods.filter(item => !["locked", "published"].includes(item.status)).length,
    lockedPayrolls: periods.filter(item => ["locked", "published"].includes(item.status)).length,
    publishedPayslips: published.length,
    viewedPayslips: published.filter(item => item.viewedAt || item.confirmedAt).length,
    unseenPayslips: published.filter(item => !item.viewedAt && !item.confirmedAt).length,
    unconfirmedPayslips: published.filter(item => !item.confirmedAt).length,
    revokedPayslips: slips.filter(item => item.status === "revoked").length,
    recentPayrolls: [...periods].sort(comparePeriods).reverse().slice(0, 5),
    recentPayslips: [...slips].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth) || b.version - a.version).slice(0, 5),
    pendingPayrolls,
    awaitingPublication: periods.filter(item => item.status === "locked").length,
    reporting: {
      fromMonth, throughMonth, payrolls: reportingPayrolls, payslipMonth,
      payslips: {
        total: reportingPayslips.length,
        unseen: reportingPayslips.filter(item => !item.viewedAt && !item.confirmedAt).length,
        awaitingConfirmation: reportingPayslips.filter(item => item.viewedAt && !item.confirmedAt).length,
        confirmed: reportingPayslips.filter(item => item.confirmedAt).length
      }
    }
  };
}
