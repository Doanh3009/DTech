import type ExcelJS from "exceljs";
import { sanitizeSpreadsheetCell } from "@/lib/security/filePolicy";
import { safeWorksheetName } from "@/lib/documents/spreadsheet";
import type { ReportField } from "./reportFieldRegistry";

type Row = Record<string, unknown>;
const identityKeys = new Set(["employeeCode", "employeeName", "departmentName"]);
const dayMarkers: Record<string, string> = {
  annual_leave: "P", unpaid_leave: "KL", absent: "V", holiday: "L", rest_day: "N",
  missing_check_in: "?", missing_check_out: "?", needs_review: "?", business_trip: "CT"
};
const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const employeeKey = (row: Row) => String(row.employeeId ?? row.employeeCode ?? "");

function datesInPeriod(daily: Row[], period?: { startDate: string; endDate: string }) {
  const dates = daily.map((row) => String(row.workDate ?? "")).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
  const start = period?.startDate ?? dates[0];
  const end = period?.endDate ?? dates.at(-1);
  if (!start || !end) return [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(last.getTime()) || last < cursor) throw new Error("Ngày của kỳ công chưa hợp lệ.");
  const result: string[] = [];
  while (cursor <= last) {
    if (result.length >= 366) throw new Error("Bảng chấm công chỉ hỗ trợ kỳ tối đa 366 ngày.");
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

function fallbackSummary(days: Row[]): Row {
  const sum = (key: string) => days.reduce((total, row) => total + number(row[key]), 0);
  const leave = (status: string) => days.filter((row) => row.status === status).reduce((total, row) => total + number(row.leaveFraction), 0);
  return {
    actualWorkdays: sum("workFraction"), annualLeaveDays: leave("annual_leave"),
    unpaidLeaveDays: leave("unpaid_leave"), absentDays: days.filter((row) => row.status === "absent").length,
    lateMinutes: sum("lateMinutes"), earlyLeaveMinutes: sum("earlyLeaveMinutes"), exceptionCount: sum("exceptionCount")
  };
}

export function addTimesheetMatrix(workbook: ExcelJS.Workbook, input: {
  name: string; title: string; daily: Row[]; summaries: Row[]; fields: ReportField[];
  period?: { startDate: string; endDate: string }; freezeHeader: boolean; autoFilter: boolean;
}) {
  const dates = datesInPeriod(input.daily, input.period);
  const identity = input.fields.filter((field) => identityKeys.has(field.key));
  const totals = input.fields.filter((field) => !identityKeys.has(field.key));
  const columnCount = identity.length + dates.length + totals.length;
  const sheet = workbook.addWorksheet(safeWorksheetName(workbook, input.name), {
    views: input.freezeHeader ? [{ state: "frozen", ySplit: 3, xSplit: identity.length }] : undefined,
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:3" }
  });
  sheet.mergeCells(1, 1, 1, columnCount);
  sheet.getCell(1, 1).value = sanitizeSpreadsheetCell(input.title) as string;
  sheet.getCell(1, 1).font = { name: "Arial", bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  sheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  sheet.getRow(1).height = 28;
  sheet.mergeCells(2, 1, 2, columnCount);
  sheet.getCell(2, 1).value = "P: Phép năm · KL: Nghỉ không lương · V: Vắng · CT: Công tác · L: Ngày lễ · N: Ngày nghỉ · ?: Cần kiểm tra";
  sheet.getCell(2, 1).alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(2).height = 30;
  const header = sheet.getRow(3);
  header.values = [...identity.map((field) => sanitizeSpreadsheetCell(field.label) as string), ...dates.map((date) => `${date.slice(8)}/${date.slice(5, 7)}\n${weekdays[new Date(`${date}T00:00:00Z`).getUTCDay()]}`), ...totals.map((field) => sanitizeSpreadsheetCell(field.label) as string)];
  header.font = { name: "Arial", bold: true, color: { argb: "FF17202E" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F5F3" } };
  header.alignment = { wrapText: true, horizontal: "center", vertical: "middle" };
  header.height = 36;
  identity.forEach((field, index) => { sheet.getColumn(index + 1).width = field.width ?? 22; });
  dates.forEach((_, index) => { sheet.getColumn(identity.length + index + 1).width = 7; });
  totals.forEach((field, index) => { const column = sheet.getColumn(identity.length + dates.length + index + 1); column.width = Math.max(12, field.label.length + 1); column.numFmt = field.format === "decimal" ? "0.##" : "0"; });

  const groups = new Map<string, { person: Row; days: Map<string, Row>; summary?: Row }>();
  for (const summary of input.summaries) groups.set(employeeKey(summary), { person: summary, days: new Map(), summary });
  for (const day of input.daily) {
    const key = employeeKey(day);
    const group = groups.get(key) ?? { person: day, days: new Map<string, Row>() };
    group.days.set(String(day.workDate), day);
    groups.set(key, group);
  }
  const numericTotals = Array.from({ length: columnCount }, () => 0);
  for (const group of [...groups.values()].sort((a, b) => String(a.person.employeeCode).localeCompare(String(b.person.employeeCode), "vi"))) {
    const summary = group.summary ?? fallbackSummary([...group.days.values()]);
    const values: ExcelJS.CellValue[] = identity.map((field) => sanitizeSpreadsheetCell(group.person[field.key] ?? "") as string);
    for (const date of dates) {
      const day = group.days.get(date);
      // A blank day stays blank; it must never become an invented absence.
      values.push(day ? number(day.workFraction) > 0 ? number(day.workFraction) : dayMarkers[String(day.status)] ?? "?" : "");
    }
    values.push(...totals.map((field) => number(summary[field.key])));
    const row = sheet.addRow(values);
    row.font = { name: "Arial", size: 10 };
    row.alignment = { vertical: "middle" };
    row.height = 23;
    values.forEach((value, index) => { if (typeof value === "number") numericTotals[index] += value; });
    dates.forEach((date, index) => {
      const day = group.days.get(date);
      const cell = row.getCell(identity.length + index + 1);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.numFmt = "0.##";
      if (!day) return;
      if (day.status === "rest_day" || day.status === "holiday") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      if (number(day.exceptionCount) > 0 || dayMarkers[String(day.status)] === "?") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE4B5" } };
      const notes = [
        day.shiftName ? `Ca: ${day.shiftName}` : "", `Công: ${number(day.workFraction)}`, `Nghỉ: ${number(day.leaveFraction)}`,
        number(day.lateMinutes) ? `Đi trễ: ${number(day.lateMinutes)} phút` : "",
        number(day.earlyLeaveMinutes) ? `Về sớm: ${number(day.earlyLeaveMinutes)} phút` : "",
        day.hrNote ? String(day.hrNote) : ""
      ].filter(Boolean);
      cell.note = notes.join("\n");
    });
  }
  const lastDataRow = sheet.rowCount;
  const total = sheet.addRow(["TỔNG CỘNG"]);
  total.font = { name: "Arial", bold: true };
  total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7F5F3" } };
  for (let index = identity.length; index < columnCount; index += 1) {
    const cell = total.getCell(index + 1);
    const letter = sheet.getColumn(index + 1).letter;
    cell.value = lastDataRow >= 4 ? { formula: `SUM(${letter}4:${letter}${lastDataRow})`, result: numericTotals[index] } : 0;
    cell.numFmt = "0.##";
  }
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber >= 3) row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { bottom: { style: "hair", color: { argb: "FFD9DEE5" } }, right: { style: "hair", color: { argb: "FFD9DEE5" } } };
    });
  });
  if (input.autoFilter) sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, lastDataRow), column: columnCount } };
}
