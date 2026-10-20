import { z } from "zod";

export const insuranceInputSchema = z.object({
  employeeId: z.string().uuid(),
  socialInsuranceNumber: z.string().trim().min(5).max(30),
  participationStatus: z.enum(["active", "suspended", "ended", "not_participating"]),
  startDate: z.string().date().optional(),
  contributionBase: z.number().min(0).max(1_000_000_000_000).optional(),
  contributionRatePercent: z.number().min(0).max(100).optional(),
  contributionMonth: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/).optional(),
  paymentStatus: z.enum(["pending", "paid", "overdue"]),
  socialInsuranceEnabled: z.boolean(),
  healthInsuranceEnabled: z.boolean(),
  unemploymentInsuranceEnabled: z.boolean(),
  changeType: z.enum(["joined", "adjusted", "suspended", "resumed", "ended"]),
  effectiveDate: z.string().date(),
  reason: z.string().trim().min(3).max(500),
  recordContribution: z.boolean().optional(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional()
});

export const insuranceContributionInputSchema = z.object({
  employeeId: z.string().uuid(),
  contributionMonth: z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/, "Kỳ đóng chưa hợp lệ."),
  contributionBase: z.number().finite().min(0).max(1_000_000_000_000).optional(),
  contributionRatePercent: z.number().finite().min(0).max(100).optional(),
  paidAmount: z.number().finite().min(0).max(1_000_000_000_000).optional(),
  paymentStatus: z.enum(["pending", "paid", "overdue"]),
  paidDate: z.string().date().optional(),
  note: z.string().trim().max(500).optional(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional()
}).strict().superRefine((value, context) => {
  if (value.paymentStatus !== "paid" && ((value.paidAmount ?? 0) > 0 || value.paidDate)) {
    context.addIssue({ code: "custom", path: ["paymentStatus"], message: "Chọn Đã đóng khi ghi nhận số tiền hoặc ngày đóng." });
  }
});
