import type ExcelJS from "exceljs";

/** Excel rejects punctuation and duplicate sheet names, including duplicates after truncation. */
export function safeWorksheetName(workbook: ExcelJS.Workbook, requested: string): string {
  const truncate = (value: string, length: number) => value.slice(0, length).replace(/[\uD800-\uDBFF]$/, "").replace(/'+$/, "").trimEnd();
  const base = requested.normalize("NFC").replace(/[\u0000-\u001f\u007f[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().replace(/^'+|'+$/g, "").trim() || "Trang tính";
  const names = new Set(workbook.worksheets.map(sheet => sheet.name.toLocaleLowerCase("vi")));
  let result = truncate(base, 31), index = 2;
  while (names.has(result.toLocaleLowerCase("vi"))) { const suffix = ` (${index++})`; result = truncate(base, 31 - suffix.length) + suffix; }
  return result;
}
