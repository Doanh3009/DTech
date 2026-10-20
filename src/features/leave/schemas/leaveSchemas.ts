import { z } from "zod";

const dayPart = z.enum(["full_day","morning","afternoon"]);
export const leaveRequestInputSchema = z.object({ leaveTypeId: z.string().uuid(), startDate: z.string().date(), endDate: z.string().date(), startDayPart: dayPart.default("full_day"), endDayPart: dayPart.default("full_day"), reason: z.string().trim().max(3000).default("") });
export const leaveRequestUpdateSchema = leaveRequestInputSchema.extend({ version: z.number().int().positive() });
export const leaveVersionSchema = z.object({ version: z.number().int().positive() });
export const leaveDecisionSchema = z.object({ version: z.number().int().positive(), comment: z.string().trim().max(1000).optional() });
export const leaveRejectSchema = leaveDecisionSchema.extend({ comment: z.string().trim().min(3).max(1000) });
export const leaveReasonActionSchema = z.object({ version: z.number().int().positive(), reason: z.string().trim().min(3).max(1000) });
export const leaveAdjustmentSchema = z.object({ employeeId: z.string().uuid(), year: z.number().int().min(2000).max(2200), leaveTypeId: z.string().uuid(), direction: z.enum(["add","subtract"]), amount: z.number().positive().max(365), reason: z.string().trim().min(3).max(500), effectiveDate: z.string().date(), idempotencyKey: z.string().uuid() });
export const leaveGrantSchema = z.object({ employeeIds: z.array(z.string().uuid()).min(1).max(1000), year: z.number().int().min(2000).max(2200), leaveTypeId: z.string().uuid(), amount: z.number().positive().max(365), reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().uuid() });
export const leaveTypeInputSchema = z.object({ code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,29}$/), name: z.string().trim().min(2).max(100), tone: z.enum(["neutral","info","success","warning"]), deductsBalance: z.boolean(), requiresReason: z.boolean(), requiresAttachment: z.boolean(), allowsHalfDay: z.boolean(), allowsMultiDay: z.boolean(), workflowId: z.string().uuid(), active: z.boolean() });
export const leaveWorkflowInputSchema = z.object({ code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,29}$/), name: z.string().trim().min(2).max(100), active: z.boolean().default(true), version: z.number().int().positive().optional(), steps: z.array(z.object({ approverSource: z.enum(["direct_manager","department_manager","specific_user","specific_role","hr_role"]), specificAccountId: z.string().uuid().optional(), specificRoleCode: z.string().trim().min(1).max(50).optional() }).superRefine((step, context) => {
  if (step.approverSource === "specific_user" && !step.specificAccountId) context.addIssue({ code: "custom", path: ["specificAccountId"], message: "Chọn người duyệt." });
  if (step.approverSource === "specific_role" && !step.specificRoleCode) context.addIssue({ code: "custom", path: ["specificRoleCode"], message: "Chọn vai trò người duyệt." });
})).min(1).max(10) });
export const leavePolicyInputSchema = z.object({ weekendDays: z.array(z.number().int().min(0).max(6)).max(6).transform(days => [...new Set(days)].sort()), allowNegativeBalance: z.boolean(), allowWithdrawPending: z.boolean(), cancellationRequiresApproval: z.boolean(), carryoverEnabled: z.boolean(), carryoverMaxDays: z.number().min(0).max(365) });
export const leaveYearSchema = z.coerce.number().int().min(2000).max(2200);
export const leaveRequestFiltersSchema = z.object({ startDate: z.string().date().optional(), endDate: z.string().date().optional(), employeeId: z.string().uuid().optional(), leaveTypeId: z.string().uuid().optional(), status: z.enum(["draft", "submitted", "pending_approval", "approved", "rejected", "withdrawn", "cancelled"]).optional() }).refine(value => !value.startDate || !value.endDate || value.startDate <= value.endDate, { message: "Khoảng ngày không hợp lệ.", path: ["endDate"] });
