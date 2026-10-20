import type { summarizeAccounting } from "@/features/accounting/accountingSummaryRules";
import type { DashboardWidgetData } from "./types";

const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;
const payrollActions = { draft: "Duyệt lương", calculated: "Duyệt lương", reviewed: "Duyệt lương", locked: "Duyệt phiếu lương", published: "Gửi lại thông báo" };

export function accountingDashboardData(summary: ReturnType<typeof summarizeAccounting>, access: { payroll: boolean; salary: boolean; payslip: boolean }): DashboardWidgetData {
  const reporting = summary.reporting;
  const receiptHref = reporting.payslipMonth ? `/accounting/payslips?month=${reporting.payslipMonth}` : "/accounting/payslips";
  return {
    metrics: [
      ...(access.salary ? [{ label: "Hồ sơ lương", value: summary.salaryProfiles, href: "/accounting/salaries" }] : []),
      ...(access.payroll ? [
        { label: "Kỳ cần xử lý", value: summary.pendingPayrolls.length, href: "/accounting/payroll?status=pending", tone: summary.pendingPayrolls.length ? "warning" as const : "success" as const },
        { label: "Chờ duyệt phiếu", value: summary.awaitingPublication, href: "/accounting/payroll?status=locked" }
      ] : []),
      ...(access.payslip ? [{ label: "Phiếu chưa xem", value: summary.unseenPayslips, href: "/accounting/payslips?month=all&receipt=unseen" }] : [])
    ],
    charts: [
      ...(access.payroll ? [{
        key: "payroll-fund", title: "Thực nhận đã chốt", kind: "bar" as const, unit: "VNĐ",
        context: `${monthLabel(reporting.fromMonth)} – ${monthLabel(reporting.throughMonth)}`,
        emptyLabel: "Chưa có kỳ lương đã chốt trong 6 tháng này",
        series: reporting.payrolls.map(period => ({ label: monthLabel(period.periodMonth), value: period.netTotal, href: `/accounting/payroll/${period.id}` }))
      }] : []),
      ...(access.payslip ? [{
        key: "payslip-status", title: access.payroll ? "Tiếp nhận phiếu lương" : "Phiếu lương của tôi", kind: "donut" as const, unit: "phiếu",
        context: reporting.payslipMonth ? monthLabel(reporting.payslipMonth) : `Đến ${monthLabel(reporting.throughMonth)}`,
        emptyLabel: "Chưa có phiếu lương đã phát hành",
        series: reporting.payslips.total ? [
          { label: "Chưa xem", value: reporting.payslips.unseen, tone: "warning" as const, href: `${receiptHref}&receipt=unseen` },
          { label: "Chờ xác nhận", value: reporting.payslips.awaitingConfirmation, tone: "info" as const, href: `${receiptHref}&receipt=pending` },
          { label: "Đã xác nhận", value: reporting.payslips.confirmed, tone: "success" as const, href: `${receiptHref}&receipt=confirmed` }
        ] : []
      }] : access.salary ? [{ key: "salary-profiles", title: "Hồ sơ lương", kind: "bar" as const, unit: "nhân viên", series: [{ label: "Đã thiết lập lương", value: summary.salaryProfiles, href: "/accounting/salaries" }] }] : [])
    ],
    items: access.payroll ? summary.pendingPayrolls.map(period => ({
      id: period.id, type: "payroll", title: `${payrollActions[period.status]} · ${monthLabel(period.periodMonth)}`,
      context: `${period.lineCount} nhân viên · ${new Intl.NumberFormat("vi-VN").format(period.netTotal)} đ`,
      priority: period.status === "draft" ? "HIGH" as const : "MEDIUM" as const,
      href: `/accounting/payroll/${period.id}`, status: period.status
    })) : []
  };
}
