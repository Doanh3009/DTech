// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/api/errors";
import { buildBusinessMisaCsv, collectBusinessMisaExportRows } from "./businessMisaExport";

describe("MISA CSV export", () => {
  it("exports only registered columns and preserves quoted, multiline Vietnamese data", () => {
    const csv = buildBusinessMisaCsv("reports", [{ id: "1", code: "BC01", name: 'Báo cáo, "thu nhập"\nKỳ 1', report: "income", line_number: 1, amount: -123.5, accounts: null, tenant_id: "private", secret: "hidden" }]);
    expect(csv).toBe('\uFEFF"code","name","report","line_number","amount","accounts"\r\n"BC01","Báo cáo, ""thu nhập""\nKỳ 1","income",1,-123.5,');
    expect(csv).not.toContain("private");
    expect(csv).not.toContain("hidden");
  });

  it.each(["=HYPERLINK(1)", "+SUM(1)", "-1+2", "@SUM(1)", "  =SUM(1)", "\t=SUM(1)", "\r\n+SUM(1)"])("neutralizes spreadsheet formulas in text: %j", value => {
    expect(buildBusinessMisaCsv("reports", [{ code: value }])).toContain(`"'${value}"`);
  });

  it("includes headers for an empty report", () => {
    expect(buildBusinessMisaCsv("reports", [])).toBe('\uFEFF"code","name","report","line_number","amount","accounts"');
  });

  it("collects all authorized pages once", async () => {
    const rows = Array.from({ length: 26 }, (_, index) => ({ id: String(index), code: `R${index}` }));
    const readPage = vi.fn(async (page: number) => ({ total: 26, rows: rows.slice((page - 1) * 25, page * 25) }));
    expect(await collectBusinessMisaExportRows(readPage)).toEqual(rows);
    expect(readPage.mock.calls).toEqual([[1], [2]]);
  });

  it("rejects oversized reports before reading further pages", async () => {
    const readPage = vi.fn(async () => ({ total: 5001, rows: [] }));
    await expect(collectBusinessMisaExportRows(readPage)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(readPage).toHaveBeenCalledTimes(1);
  });

  it.each(["changed total", "missing row", "duplicate row"])("rejects an inconsistent export: %s", async issue => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ id: String(index) }));
    const readPage = vi.fn(async (page: number) => page === 1 ? { total: 26, rows } : {
      total: issue === "changed total" ? 27 : 26,
      rows: issue === "missing row" ? [] : [{ id: issue === "duplicate row" ? "0" : "25" }]
    });
    await expect(collectBusinessMisaExportRows(readPage)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("propagates authorization failures and never continues pagination", async () => {
    const denied = new AppError("PERMISSION_DENIED");
    const readPage = vi.fn().mockRejectedValue(denied);
    await expect(collectBusinessMisaExportRows(readPage)).rejects.toBe(denied);
    expect(readPage).toHaveBeenCalledTimes(1);
  });
});
