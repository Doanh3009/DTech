import { describe, expect, it } from "vitest";
import { summarizeAccounting } from "@/features/accounting/accountingSummaryRules";
import type { PayrollPeriod, Payslip } from "@/features/accounting/types";
import { accountingDashboardData } from "./accountingPresentation";

const period = (id: string, status: PayrollPeriod["status"], month = "2026-09-01"): PayrollPeriod => ({ id, status, periodMonth: month, lineCount: 5, grossTotal: 200, deductionTotal: 20, netTotal: 180, rowVersion: 1, updatedAt: "2026-10-16" });
const slip: Payslip = { id: "slip", payrollLineId: "line", employeeId: "employee", employeeCode: "NV01", employeeName: "Nhân viên", periodMonth: "2026-09-01", status: "published", version: 1, snapshot: {} };
const access = { payroll: true, salary: true, payslip: true };

describe("meaningful accountant dashboard", () => {
  it("distinguishes publication from recoverable notification delivery work", () => {
    const data = accountingDashboardData(summarizeAccounting([period("sent", "published")], [], [], "2026-10-16", ["sent"]), access);
    expect(data.items?.[0]).toMatchObject({ title: "Gửi lại thông báo · 09/2026", href: "/accounting/payroll/sent" });
    expect(data.metrics?.find(metric => metric.label === "Kỳ cần xử lý")?.value).toBe(1);
  });
  it("connects every uncompleted stage to real work, including locked sending", () => {
    const summary = summarizeAccounting([period("draft", "draft"), period("calc", "calculated"), period("review", "reviewed"), period("lock", "locked"), period("published", "published")], [], [], "2026-10-16");
    const data = accountingDashboardData(summary, access);
    expect(data.metrics?.find(metric => metric.label === "Kỳ cần xử lý")?.value).toBe(4);
    expect(data.items?.map(item => item.title)).toEqual(["Duyệt lương · 09/2026", "Duyệt lương · 09/2026", "Duyệt phiếu lương · 09/2026", "Duyệt lương · 09/2026"]);
    expect(data.items?.every(item => item.href.startsWith("/accounting/payroll/"))).toBe(true);
  });
  it("replaces all-time future status charts with period-scoped real totals and receipt state", () => {
    const data = accountingDashboardData(summarizeAccounting([period("real", "locked"), period("future", "published", "2099-01-01")], [], [slip], "2026-10-16"), access);
    expect(data.charts?.map(chart => chart.key)).toEqual(["payroll-fund", "payslip-status"]);
    expect(data.charts?.[0]).toMatchObject({ kind: "bar", context: "05/2026 – 10/2026", series: [{ label: "09/2026", value: 180, href: "/accounting/payroll/real" }] });
    expect(data.charts?.[1].series[0]).toMatchObject({ label: "Chưa xem", value: 1, href: "/accounting/payslips?month=2026-09&receipt=unseen" });
  });
  it("preserves honest empty states and does not fabricate a line or percentage", () => {
    const data = accountingDashboardData(summarizeAccounting([], [], [], "2026-10-16"), access);
    expect(data.charts).toHaveLength(2);
    expect(data.charts?.every(chart => chart.series.length === 0 && chart.emptyLabel)).toBe(true);
  });
  it("never exposes payroll charts or work to a personal-only user", () => {
    const summary = summarizeAccounting([period("private", "draft")], [], [slip], "2026-10-16");
    const data = accountingDashboardData(summary, { payroll: false, salary: false, payslip: true });
    expect(data.items).toEqual([]);
    expect(data.charts?.map(chart => chart.key)).toEqual(["payslip-status"]);
    expect(data.metrics?.map(metric => metric.label)).toEqual(["Phiếu chưa xem"]);
  });
});
