import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { generatePayslipPdf } from "./payslipPdf";

describe("generatePayslipPdf", () => {
  it("creates a private-ready A4 PDF with Vietnamese employee data", async () => {
    const bytes = await generatePayslipPdf({
      employeeCode: "NV001",
      employeeName: "Nguyễn Văn Cường",
      periodMonth: "2026-09-01",
      version: 1,
      publishedAt: "2026-09-16T08:00:00.000Z",
      snapshot: { workDays: 22, baseSalary: 14_000_000, allowance: 1_000_000, bonus: 500_000, deduction: 250_000, netSalary: 15_250_000 }
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getPage(0).getSize()).toMatchObject({ width: 595.28, height: 841.89 });
  });
});
