import { z } from "zod";

const reasonSchema = z.string().trim().min(3, "Lý do cần ít nhất 3 ký tự.").max(500, "Lý do quá dài.");

export const salaryInputSchema = z.object({ employeeId: z.string().uuid(), baseSalary: z.number().min(0).max(1_000_000_000_000), allowance: z.number().min(0).max(1_000_000_000_000).default(0), bonus: z.number().min(0).max(1_000_000_000_000).default(0), deduction: z.number().min(0).max(1_000_000_000_000).default(0), effectiveDate: z.string().date(), note: z.string().trim().max(1000).optional(), reason: reasonSchema });
export const salaryDeleteSchema = z.object({ reason: reasonSchema });
export const payrollCreateSchema = z.object({ timesheetPeriodId: z.string().uuid(), note: z.string().trim().max(1000).optional() });
export const payrollActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("calculate"), rowVersion: z.number().int().positive(), payBasis: z.enum(["actual", "paid_time"]).optional() }),
  z.object({ action: z.literal("approve_salary"), rowVersion: z.number().int().positive() }),
  z.object({ action: z.literal("review"), rowVersion: z.number().int().positive() }),
  z.object({ action: z.literal("lock"), rowVersion: z.number().int().positive() }),
  z.object({ action: z.literal("publish"), rowVersion: z.number().int().positive() }),
  z.object({ action: z.literal("publish_employee"), rowVersion: z.number().int().positive(), employeeId: z.string().uuid() }),
  z.object({ action: z.literal("retry_delivery"), rowVersion: z.number().int().positive(), employeeId: z.string().uuid().optional() }),
  z.object({ action: z.literal("reopen"), rowVersion: z.number().int().positive(), reason: reasonSchema }),
  z.object({ action: z.literal("update_line"), rowVersion: z.number().int().positive(), lineId: z.string().uuid(), lineRowVersion: z.number().int().positive(), baseSalary: z.number().min(0), allowance: z.number().min(0), bonus: z.number().min(0), deduction: z.number().min(0), reason: reasonSchema })
]);
export const payslipRevokeSchema = z.object({ reason: reasonSchema });
