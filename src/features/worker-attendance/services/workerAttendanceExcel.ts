import ExcelJS from "exceljs";

import type { WorkerAttendanceSession } from "@/features/worker-attendance/types/workerAttendanceTypes";
import { sanitizeSpreadsheetCell } from "@/lib/security/filePolicy";
import { appConfig } from "@/config/app";

const statusLabels: Record<string, string> = {
  present: "Có mặt",
  late: "Đi muộn",
  absent: "Vắng",
  leave: "Nghỉ",
  transferred: "Điều chuyển",
  unconfirmed: "Chưa xác nhận"
};

export async function generateWorkerAttendanceExcel(sessions: WorkerAttendanceSession[], month: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = appConfig.name;
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Chấm công công trường", { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = `BẢNG CHẤM CÔNG CÔNG TRƯỜNG ${month}`;
  sheet.getCell("A1").font = { bold: true, size: 15 };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.addRow([]);
  sheet.addRow(["Ngày", "Công trường", "Mã NV", "Họ tên", "Trạng thái", "Ca", "Giám sát", "Ảnh", "Giờ gửi", "Ghi chú"]);
  for (const session of sessions) {
    for (const entry of session.entries) {
      sheet.addRow([
        session.date,
        sanitizeSpreadsheetCell(session.worksiteName),
        sanitizeSpreadsheetCell(entry.employeeCode),
        sanitizeSpreadsheetCell(entry.workerName),
        statusLabels[entry.status] ?? entry.status,
        sanitizeSpreadsheetCell(session.shiftName),
        sanitizeSpreadsheetCell(session.supervisorName),
        session.photos.length,
        session.submittedAt ? new Date(session.submittedAt) : "",
        sanitizeSpreadsheetCell(entry.note ?? "")
      ]);
    }
  }
  sheet.columns = [{ width: 13 }, { width: 24 }, { width: 14 }, { width: 28 }, { width: 16 }, { width: 16 }, { width: 24 }, { width: 9 }, { width: 20 }, { width: 28 }];
  sheet.getRow(3).font = { bold: true };
  sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F7F8" } };
  sheet.getColumn(9).numFmt = "dd/mm/yyyy hh:mm";
  sheet.autoFilter = { from: "A3", to: "J3" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
