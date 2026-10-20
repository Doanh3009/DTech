import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { generatePayrollExcel } from "./payrollExcel";

describe("generatePayrollExcel", () => {
  it("exports only the supplied payroll snapshot with safe spreadsheet cells", async () => {
    const bytes = await generatePayrollExcel({
      id: "period-1", periodMonth: "2026-09-01", status: "locked", rowVersion: 1,
      lineCount: 1, grossTotal: 15_000_000, deductionTotal: 500_000, netTotal: 14_500_000,
      updatedAt: "2026-09-16T00:00:00.000Z",
      lines: [{ id: "line-1", employeeId: "employee-1", employeeCode: "=NV001", employeeName: "Nguyễn Văn A", workDays: 22, baseSalary: 14_000_000, allowance: 1_000_000, bonus: 0, deduction: 500_000, netSalary: 14_500_000, rowVersion: 1 }]
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Bảng lương");
    expect(sheet?.getCell("A4").value).toBe("'=NV001");
    expect(sheet?.getCell("B4").value).toBe("Nguyễn Văn A");
    expect(sheet?.getCell("I4").value).toBe(14_500_000);
    expect(sheet?.getCell("J4").value).toBe("Đã duyệt lương");
    expect(sheet?.getColumn(7).values).toContain("Giám đốc phê duyệt");
    expect(sheet?.getCell("C5").value).toMatchObject({ formula: "SUM(C4:C4)", result: 22 });
    expect(sheet?.getCell("H5").value).toMatchObject({ formula: "SUM(H4:H4)", result: 500_000 });
    expect(sheet?.getCell("I5").value).toMatchObject({ formula: "SUM(I4:I4)", result: 14_500_000 });
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    expect(sheet?.getColumn(8).numFmt).toBe('#,##0 "₫"');
  });
  it("exports cashout separately with its days and HR daily rate", async () => {
    const bytes = await generatePayrollExcel({
      id: "cashout-period", periodMonth: "2025-12-01", status: "calculated", rowVersion: 2, lineCount: 1,
      grossTotal: 2_800_000, deductionTotal: 20_000, netTotal: 2_780_000, updatedAt: "2026-01-01T00:00:00Z",
      lines: [{ id: "cashout-line", employeeId: "employee", employeeCode: "NV001", employeeName: "Nhân viên",
        workDays: 1, baseSalary: 1_000_000, allowance: 100_000, bonus: 50_000, leaveCashoutAmount: 1_650_000,
        deduction: 20_000, netSalary: 2_780_000, rowVersion: 2,
        calculation: { leaveCashout: [{ year: 2025, leaveTypeName: "Phép năm", days: 5.5, dailyRate: 300_000 }] } }]
    });
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const main = workbook.getWorksheet("Bảng lương"), detail = workbook.getWorksheet("Quyết toán phép");
    expect(main?.getCell("F4").value).toBe(50_000);
    expect(main?.getCell("G4").value).toBe(1_650_000);
    expect(main?.getCell("I4").value).toBe(2_780_000);
    expect(detail?.getRow(2).values).toEqual([undefined, "NV001", "Nhân viên", 2025, "Phép năm", 5.5, 300_000, 1_650_000]);
  });
});
