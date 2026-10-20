import { describe, expect, it } from "vitest";
import { summarizeAccounting } from "./accountingSummaryRules";
import type { PayrollPeriod, Payslip } from "./types";

const period = (month: string, status: PayrollPeriod["status"] = "published"): PayrollPeriod => ({ id: `period-${month}`, periodMonth: `${month}-01`, status, rowVersion: 1, lineCount: 2, grossTotal: 200, deductionTotal: 20, netTotal: 180, updatedAt: "2026-10-16T00:00:00Z" });
const slip = (overrides: Partial<Payslip> = {}): Payslip => ({ id: "slip", payrollLineId: "line", employeeId: "employee", employeeCode: "NV01", employeeName: "Nhân viên", periodMonth: "2026-09-01", version: 1, status: "published", snapshot: {}, ...overrides });

describe("accounting dashboard facts", () => {
  it("keeps a published period with failed or pending delivery in the work queue", () => {
    const item = period("2026-09");
    const summary = summarizeAccounting([item], [], [], "2026-10-16", [item.id, item.id]);
    expect(summary.pendingPayrolls).toEqual([item]);
    expect(summary.openPayrolls).toBe(0);
  });
  it("finds pending work outside the five newest periods, including locked unsent periods", () => {
    const periods = [period("2026-08", "draft"), period("2026-09", "locked"), ...[2091, 2092, 2094, 2095, 2099].map(year => period(`${year}-01`))];
    const summary = summarizeAccounting(periods, [], [], "2026-10-16");
    expect(summary.recentPayrolls).toHaveLength(5);
    expect(summary.pendingPayrolls.map(item => item.status)).toEqual(["draft", "locked"]);
    expect(summary.awaitingPublication).toBe(1);
  });
  it("uses six real business months and only closed amounts, without future fixtures or fabricated zeros", () => {
    const summary = summarizeAccounting([period("2026-04"), period("2026-05"), period("2026-09", "locked"), period("2026-10", "calculated"), period("2026-11"), period("2099-01")], [], [], "2026-10-16");
    expect(summary.reporting.fromMonth).toBe("2026-05");
    expect(summary.reporting.throughMonth).toBe("2026-10");
    expect(summary.reporting.payrolls.map(item => item.periodMonth)).toEqual(["2026-05-01", "2026-09-01"]);
  });
  it("keeps real zero-valued closed periods rather than dropping them", () => {
    const summary = summarizeAccounting([{ ...period("2026-09"), netTotal: 0 }], [], [], "2026-10-16");
    expect(summary.reporting.payrolls).toHaveLength(1);
    expect(summary.reporting.payrolls[0].netTotal).toBe(0);
  });
  it("partitions the latest real month's active slips by receipt state and deduplicates versions", () => {
    const summary = summarizeAccounting([], [], [slip({ id: "older", version: 1 }), slip({ id: "latest", version: 2, viewedAt: "2026-10-01" }), slip({ id: "confirmed", employeeId: "second", confirmedAt: "2026-10-01" }), slip({ id: "new", employeeId: "third" }), slip({ id: "revoked", employeeId: "fourth", status: "revoked" }), slip({ id: "future", employeeId: "future", periodMonth: "2099-01-01" }), slip({ id: "past", employeeId: "past", periodMonth: "2026-08-01" })], "2026-10-16");
    expect(summary.reporting.payslipMonth).toBe("2026-09");
    expect(summary.reporting.payslips).toEqual({ total: 3, unseen: 1, awaitingConfirmation: 1, confirmed: 1 });
    expect(summary.publishedPayslips).toBe(5);
  });
  it("keeps reporting empty when all records are future or draft", () => {
    const summary = summarizeAccounting([period("2099-01"), period("2026-10", "draft")], [], [slip({ periodMonth: "2099-01-01" })], "2026-10-16");
    expect(summary.reporting.payrolls).toEqual([]);
    expect(summary.reporting.payslipMonth).toBeUndefined();
    expect(summary.reporting.payslips.total).toBe(0);
  });
  it("handles year boundaries and leaves source arrays unchanged", () => {
    const periods = [period("2026-12"), period("2026-08")];
    const original = [...periods];
    expect(summarizeAccounting(periods, [], [], "2027-01-01").reporting.fromMonth).toBe("2026-08");
    expect(periods).toEqual(original);
  });
});
