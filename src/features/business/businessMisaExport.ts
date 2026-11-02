import { AppError } from "@/lib/api/errors";
import { misaViews, type MisaView } from "./businessMisaViews";

export const businessMisaExportRowLimit = 5000;
export type BusinessMisaExportRow = Record<string, unknown>;
export interface BusinessMisaExportPage {
  rows: BusinessMisaExportRow[];
  total: number;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  let text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  if (/^[=+\-@]/.test(text.trimStart())) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildBusinessMisaCsv(view: MisaView, rows: readonly BusinessMisaExportRow[]): string {
  const columns = misaViews[view].columns;
  return "\uFEFF" + [
    columns.map(csvCell).join(","),
    ...rows.map(row => columns.map(column => csvCell(row[column])).join(","))
  ].join("\r\n");
}

export async function collectBusinessMisaExportRows(
  readPage: (page: number) => Promise<BusinessMisaExportPage>
): Promise<BusinessMisaExportRow[]> {
  const first = await readPage(1);
  if (!Number.isSafeInteger(first.total) || first.total < 0) throw new AppError("CONFLICT");
  if (first.total > businessMisaExportRowLimit) {
    throw new AppError("VALIDATION_ERROR", "Dữ liệu xuất vượt quá 5.000 dòng. Hãy thu hẹp khoảng ngày.");
  }

  const rows: BusinessMisaExportRow[] = [];
  const ids = new Set<string>();
  const pageCount = Math.max(1, Math.ceil(first.total / 25));
  for (let page = 1; page <= pageCount; page++) {
    const data = page === 1 ? first : await readPage(page);
    const expectedLength = Math.min(25, first.total - (page - 1) * 25);
    if (data.total !== first.total || !Array.isArray(data.rows) || data.rows.length !== expectedLength) {
      throw new AppError("CONFLICT");
    }
    for (const row of data.rows) {
      if (!row || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new AppError("CONFLICT");
      ids.add(row.id);
      rows.push(row);
    }
  }
  return rows;
}
