import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import ExcelJS from "exceljs";
import { decodePDFRawStream, PDFDocument, PDFRawStream } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { defaultSystemSettings } from "@/config/systemSettings";
import { generatePayslipPdf } from "@/features/accounting/payslipPdf";
import { generatePayrollExcel } from "@/features/accounting/payrollExcel";
import { generateLeaveRequestPdf } from "@/features/leave/services/leavePdf";
import type { LeaveRequest } from "@/features/leave/types/leaveTypes";
import { generateReportWorkbook } from "@/features/timesheets/services/excelGenerator";
import { reportFieldRegistry, reportSheetPermission } from "@/features/timesheets/services/reportFieldRegistry";
import { generateWorkerAttendanceExcel } from "@/features/worker-attendance/services/workerAttendanceExcel";
import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";
import type { Permission } from "@/lib/auth/permissions";

async function artifact(name: string, bytes: Uint8Array) {
  if (process.env.EXPORT_ARTIFACT_DIR) { await mkdir(process.env.EXPORT_ARTIFACT_DIR, { recursive: true }); await writeFile(path.join(process.env.EXPORT_ARTIFACT_DIR, name), bytes); }
}
async function validPdf(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes);
  const fonts = document.context.enumerateIndirectObjects().filter(([, value]) => value.constructor.name === "PDFRawStream").map(([, value]) => decodePDFRawStream(value as PDFRawStream).decode()).filter(value => value[0] === 0 && value[1] === 1 && value[2] === 0 && value[3] === 0 || new TextDecoder().decode(value.slice(0, 4)) === "true");
  expect(fonts.length).toBeGreaterThanOrEqual(2);
  return document;
}
const leave: LeaveRequest = { id: "leave", requestNumber: "NP-2026-000001", employeeId: "employee", employeeCode: "NV001", employeeName: "Nguyễn Thị Thúy Hằng", departmentName: "Nhân sự", positionName: "Chuyên viên", leaveTypeId: "type", leaveTypeName: "Phép năm", deductsBalance: true, startDate: "2026-09-14", endDate: "2026-09-15", startDayPart: "full_day", endDayPart: "morning", calculatedDays: 1.5, reason: "Nghỉ phép giải quyết việc gia đình. Ắ Ằ Ẳ Ẵ Ặ Ấ Ầ Ẩ Ẫ Ậ Ứ Ừ Ử Ữ Ự Đ ₫.", status: "approved", version: 1, createdAt: "2026-09-01T00:00:00Z", warnings: [], attachments: [], approvalSteps: [] };

describe("export artifacts rendered by independent readers", () => {
  it("embeds actual TrueType fonts with every Vietnamese glyph", async () => {
    const alphabet = "CÔNG TY CHÂU TUẤN PHIẾU LƯƠNG Nguyễn Văn Cường 0123456789 ₫ ẮẰẲẴẶẤẦẨẪẬỨỪỬỮỰĐđ – ×";
    for (const name of ["IBMPlexSans-Regular.ttf", "IBMPlexSans-SemiBold.ttf"]) {
      const font = fontkit.create(await readFile(path.join(process.cwd(), "assets/fonts/pdf", name)));
      expect(Array.from(alphabet).filter(c => !font.hasGlyphForCodePoint(c.codePointAt(0)!))).toEqual([]);
    }
    const bytes = await generatePayslipPdf({ employeeCode: "NV001", employeeName: "Nguyễn Văn Cường", periodMonth: "2026-09-01", version: 1, publishedAt: "2026-10-15T01:00:00Z", snapshot: { workDays: 22, baseSalary: 12_000_000, allowance: 1_000_000, bonus: 500_000, deduction: 200_000, netSalary: 13_300_000 } });
    expect((await validPdf(bytes)).getPageCount()).toBe(1); await artifact("payslip-fixed.pdf", bytes);
  });
  it("renders a readable Vietnamese leave PDF and wraps long fields", async () => {
    const bytes = await generateLeaveRequestPdf(leave, defaultSystemSettings); await validPdf(bytes); await artifact("leave-fixed.pdf", bytes);
    const long = await generatePayslipPdf({ employeeCode: "NV001", employeeName: "Nguyễn Văn Cường ".repeat(35), periodMonth: "2025-12-01", version: 2, snapshot: { leaveCashoutAmount: 9_000_000, netSalary: 20_000_000, leaveCashout: Array.from({ length: 30 }, () => ({ year: 2025, days: 1.5, dailyRate: 200_000 })) } });
    expect((await validPdf(long)).getPageCount()).toBeGreaterThan(1); await artifact("payslip-long-fixed.pdf", long);
  });
  it("exports payroll and worker XLSX files with real numeric cells", async () => {
    const payroll = await generatePayrollExcel({ id: "period", periodMonth: "2026-09-01", status: "locked", rowVersion: 1, lineCount: 1, grossTotal: 13_500_000, deductionTotal: 200_000, netTotal: 13_300_000, updatedAt: "2026-10-15T00:00:00Z", lines: [{ id: "line", employeeId: "employee", employeeCode: "NV001", employeeName: "Nguyễn Văn Cường", workDays: 22, baseSalary: 12_000_000, allowance: 1_000_000, bonus: 500_000, deduction: 200_000, netSalary: 13_300_000, rowVersion: 1 }] });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(payroll as unknown as ExcelJS.Buffer); expect(workbook.getWorksheet(1)!.getCell("I4").value).toBe(13_300_000); await artifact("payroll-fixed.xlsx", payroll);
    const worker = await generateWorkerAttendanceExcel([{ date: "2026-09-01", worksiteName: "Công trường Châu Tuấn", shiftName: "Ca ngày", supervisorName: "Võ Hoàng Phương", submittedAt: "2026-09-01T01:00:00Z", photos: [], entries: [{ employeeCode: "NV001", workerName: "Nguyễn Văn Cường", status: "present" }] } as unknown as WorkerAttendanceSession], "2026-09");
    await artifact("workers-fixed.xlsx", worker);
  });
  it("opens every registered report sheet and all template families", async () => {
    const permissions = [...new Set([...Object.values(reportSheetPermission), ...Object.values(reportFieldRegistry).flatMap(fields => fields.map(f => f.permission).filter(Boolean))])] as Permission[];
    const data = Object.fromEntries(Object.entries(reportFieldRegistry).map(([key, fields]) => [key, [Object.fromEntries(fields.map(field => [field.key, field.format === "decimal" || field.format === "number" ? 1.5 : field.format === "date" ? "2026-09-01" : field.format === "datetime" ? "2026-09-01T01:00:00Z" : field.format === "boolean" ? true : field.format === "link" ? "https://example.test/document" : field.format === "status" ? "approved" : "Nguyễn Văn Cường"]))]]));
    data.daily = [{ ...data.daily?.[0], employeeId: "employee", employeeCode: "NV001", employeeName: "Nguyễn Văn Cường", workDate: "2026-09-01", status: "full_work", workFraction: 1 }];
    data.summary = [{ ...data.summary?.[0], employeeId: "employee", employeeCode: "NV001", employeeName: "Nguyễn Văn Cường", actualWorkdays: 1 }];
    for (const reportType of ["timesheet", "employee_list", "employee_profile"] as const) {
      const bytes = await generateReportWorkbook({ template: { id: "template", code: "QA", name: "Mẫu kiểm tra", reportType, version: 1, active: true, definition: { freezeHeader: true, autoFilter: true, sheets: Object.keys(reportFieldRegistry).map(key => ({ key, name: key.slice(0, 31), enabled: true })) } }, permissions, data, title: "Báo cáo kiểm tra tiếng Việt", period: { startDate: "2026-09-01", endDate: "2026-09-30" } });
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer); expect(workbook.worksheets.length).toBe(Object.keys(reportFieldRegistry).length); await artifact(`reports-${reportType}-fixed.xlsx`, bytes);
    }
  });
});
