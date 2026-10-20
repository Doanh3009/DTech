import { PDFDocument, rgb } from "pdf-lib";
import { embedVietnamesePdfFonts, wrapPdfText } from "@/lib/documents/pdfFonts";

import type { PayslipSettings } from "@/config/systemSettings";

type PayslipPdfInput = {
  employeeCode: string;
  employeeName: string;
  periodMonth: string;
  version: number;
  publishedAt?: string;
  snapshot: Record<string, unknown>;
  template?: PayslipSettings;
};

const number = (value: unknown) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value ?? 0));

function pdfColor(hex: string) {
  return rgb(...([1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]));
}

export async function generatePayslipPdf(input: PayslipPdfInput): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const { regular, bold: semibold } = await embedVietnamesePdfFonts(document);
  let page = document.addPage([595.28, 841.89]);
  const dark = rgb(0.14, 0.19, 0.24);
  const muted = rgb(0.4, 0.45, 0.51);
  const template = input.template ?? {
    companyName: "CÔNG TY CHÂU TUẤN",
    title: "PHIẾU LƯƠNG THÁNG {month}",
    footer: "Tài liệu nội bộ · Dữ liệu lương riêng tư",
    primaryColor: "#2E9B67",
    showWorkDays: true,
    showBaseSalary: true,
    showAllowance: true,
    showBonus: true,
    showDeduction: true
  };
  const green = pdfColor(template.primaryColor);
  const left = 52;
  let y = 782;

  const ensure = (height: number) => { if (y - height < 78) { page = document.addPage([595.28, 841.89]); y = 782; } };
  for (const text of wrapPdfText(template.companyName, semibold, 11, 491)) { ensure(18); page.drawText(text, { x: left, y, font: semibold, size: 11, color: green }); y -= 18; }
  y -= 16;
  for (const text of wrapPdfText(template.title.replace("{month}", input.periodMonth.slice(0, 7)), semibold, 20, 491)) { ensure(26); page.drawText(text, { x: left, y, font: semibold, size: 20, color: dark }); y -= 26; }
  page.drawText(`Phiên bản ${input.version}`, { x: left, y, font: regular, size: 9, color: muted });
  y -= 34;

  const field = (label: string, value: string) => {
    const lines = wrapPdfText(value, semibold, 10, 323);
    ensure(Math.max(24, lines.length * 15 + 9));
    page.drawText(label, { x: left, y, font: regular, size: 10, color: muted });
    lines.forEach((text, index) => page.drawText(text, { x: 220, y: y - index * 15, font: semibold, size: 10, color: dark }));
    y -= Math.max(24, lines.length * 15 + 9);
  };
  field("Nhân viên", input.employeeName);
  field("Mã nhân viên", input.employeeCode);
  if (template.showWorkDays) field("Ngày công", String(input.snapshot.workDays ?? 0));
  if (template.showBaseSalary) field("Lương cơ bản", `${number(input.snapshot.baseSalary)} VND`);
  if (template.showAllowance) field("Phụ cấp", `${number(input.snapshot.allowance)} VND`);
  if (template.showBonus) field("Thưởng", `${number(input.snapshot.bonus)} VND`);
  if (Number(input.snapshot.leaveCashoutAmount ?? 0) > 0) field("Thanh toán phép dư", `${number(input.snapshot.leaveCashoutAmount)} VND`);
  if (Array.isArray(input.snapshot.leaveCashout)) for (const entry of input.snapshot.leaveCashout as Record<string, unknown>[]) {
    field(`Phép năm ${String(entry.year)}`, `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(entry.days))} ngày × ${number(entry.dailyRate)} VND`);
  }
  if (template.showDeduction) field("Khấu trừ", `${number(input.snapshot.deduction)} VND`);
  ensure(136);
  y -= 8;
  page.drawRectangle({ x: left, y: y - 52, width: 491, height: 68, color: rgb(0.92, 0.97, 0.94), borderColor: rgb(0.72, 0.87, 0.78), borderWidth: 1 });
  page.drawText("THỰC NHẬN", { x: left + 18, y: y - 12, font: semibold, size: 11, color: muted });
  page.drawText(`${number(input.snapshot.netSalary)} VND`, { x: left + 18, y: y - 39, font: semibold, size: 20, color: green });
  y -= 92;
  field("Ngày phát hành", input.publishedAt ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(input.publishedAt)) : "—");
  for (const outputPage of document.getPages()) wrapPdfText(template.footer, regular, 8, 491).slice(0, 2).forEach((text, index) => outputPage.drawText(text, { x: left, y: 48 - index * 12, font: regular, size: 8, color: muted }));
  return document.save();
}
