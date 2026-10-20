import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const scopeFields = {
  scopeType: z.enum(["company", "department", "project", "employee"]),
  scopeId: z.string().uuid().optional()
};
const validScope = <T extends { scopeType: string; scopeId?: string }>(value: T) => value.scopeType === "company" ? !value.scopeId : Boolean(value.scopeId);

export const shiftInputSchema = z.object({
  id: z.string().uuid().optional(), code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,29}$/),
  name: z.string().trim().min(2).max(100), startTime: time, endTime: time,
  breakMinutes: z.number().int().min(0).max(720), lateGraceMinutes: z.number().int().min(0).max(180),
  earlyLeaveGraceMinutes: z.number().int().min(0).max(180), checkInEarliestMinutes: z.number().int().min(0).max(720),
  checkInLatestMinutes: z.number().int().min(0).max(720), checkOutEarliestMinutes: z.number().int().min(0).max(720),
  checkOutLatestMinutes: z.number().int().min(0).max(720), crossMidnight: z.boolean(), active: z.boolean(),
  effectiveFrom: z.string().date().optional(), reason: z.string().trim().min(3).max(500).optional()
}).superRefine((value, context) => {
  if (value.id && !value.effectiveFrom) context.addIssue({ code: "custom", path: ["effectiveFrom"], message: "Cần chọn ngày áp dụng." });
  if (value.id && !value.reason) context.addIssue({ code: "custom", path: ["reason"], message: "Cần nhập lý do thay đổi." });
});
export const shiftAssignmentInputSchema = z.object({ ...scopeFields, shiftId: z.string().uuid(), effectiveFrom: z.string().date(), effectiveTo: z.string().date().optional(), weekdays: z.array(z.number().int().min(0).max(6)).min(1) }).refine(validScope, { message: "Phạm vi chưa hợp lệ." });
export const calendarDayInputSchema = z.object({ ...scopeFields, id: z.string().uuid().optional(), date: z.string().date(), name: z.string().trim().min(2).max(120), dayType: z.enum(["holiday", "company_holiday", "makeup_workday", "special"]), isWorkingDay: z.boolean(), active: z.boolean() }).refine(validScope, { message: "Phạm vi chưa hợp lệ." });
export const periodInputSchema = z.object({ code: z.string().trim().regex(/^[A-Z0-9_-]{2,30}$/), name: z.string().trim().min(2).max(100), startDate: z.string().date(), endDate: z.string().date() }).refine(value => value.endDate >= value.startDate, { message: "Ngày kết thúc phải sau ngày bắt đầu." });
export const periodVersionSchema = z.object({ rowVersion: z.number().int().positive() });
export const periodUnlockSchema = periodVersionSchema.extend({ reason: z.string().trim().min(3).max(500) });
export const adjustmentInputSchema = z.object({ employeeId: z.string().uuid(), workDate: z.string().date(), adjustmentType: z.enum(["add_missing_check_in", "add_missing_check_out", "adjust_effective_time", "mark_leave", "mark_business_trip", "correct_status", "correct_work_fraction", "note_only", "other"]), effectiveTime: z.string().datetime().optional(), timeTarget: z.enum(["check_in", "check_out"]).optional(), correctedStatus: z.enum(["full_work", "late", "early_leave", "missing_check_in", "missing_check_out", "annual_leave", "unpaid_leave", "absent", "business_trip", "holiday", "rest_day", "worker_site", "needs_review"]).optional(), correctedWorkFraction: z.number().min(0).max(1).optional(), hrNote: z.string().trim().max(1000).optional(), reason: z.string().trim().min(3).max(500), rowVersion: z.number().int().positive() }).superRefine((value,context)=>{
  if(["add_missing_check_in","add_missing_check_out","adjust_effective_time"].includes(value.adjustmentType)&&!value.effectiveTime)context.addIssue({code:"custom",path:["effectiveTime"],message:"Cần chọn thời gian hiệu lực."});
  if(value.adjustmentType==="adjust_effective_time"&&!value.timeTarget)context.addIssue({code:"custom",path:["timeTarget"],message:"Cần chọn lượt vào hoặc ra."});
  if(value.adjustmentType==="correct_status"&&!value.correctedStatus)context.addIssue({code:"custom",path:["correctedStatus"],message:"Cần chọn trạng thái công."});
  if(value.adjustmentType==="correct_work_fraction"&&value.correctedWorkFraction===undefined)context.addIssue({code:"custom",path:["correctedWorkFraction"],message:"Cần nhập ngày công."});
});
export const exceptionResolutionSchema = z.object({ status: z.enum(["resolved", "ignored"]), note: z.string().trim().min(3).max(500) });
export const reportTemplateInputSchema = z.object({ id:z.string().uuid().optional(), code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/), name: z.string().trim().min(2).max(120), reportType: z.enum(["timesheet", "employee_list", "employee_profile"]), active: z.boolean(), definition: z.object({ freezeHeader: z.boolean(), autoFilter: z.boolean(), includeBranding: z.boolean().optional(), sheets: z.array(z.object({ key: z.string().trim().min(1), name: z.string().trim().min(1).max(31), enabled: z.boolean(), columns: z.array(z.object({ key: z.string(), label: z.string(), enabled: z.boolean(), order: z.number().int() })).optional() })).min(1) }) });
export const reportExportInputSchema = z.object({ templateId: z.string().uuid(), periodId: z.string().uuid().optional(), employeeId: z.string().uuid().optional() });
