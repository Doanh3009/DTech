import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { safeWorksheetName } from "./spreadsheet";
describe("Excel sheet names", () => {
  it("makes user template punctuation safe", () => {
    expect(safeWorksheetName(new ExcelJS.Workbook(), "'Nhân sự / Công: [tháng]?*'" )).toBe("Nhân sự Công tháng");
    expect(safeWorksheetName(new ExcelJS.Workbook(), "  'Nhân sự'  " )).toBe("Nhân sự");
    expect(safeWorksheetName(new ExcelJS.Workbook(), "x".repeat(30) + "'abc" )).toBe("x".repeat(30));
  });
  it("makes truncated and case-insensitive duplicates distinct", () => {
    const book = new ExcelJS.Workbook(), title = "Danh sách nhân viên và bảng công tháng 09";
    const first = safeWorksheetName(book, title); book.addWorksheet(first);
    const second = safeWorksheetName(book, title.toLocaleUpperCase("vi"));
    expect(first.length).toBeLessThanOrEqual(31); expect(second.length).toBeLessThanOrEqual(31); expect(second).toMatch(/\(2\)$/);
    expect(() => book.addWorksheet(second)).not.toThrow();
  });
});
