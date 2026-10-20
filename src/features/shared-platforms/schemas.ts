import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const approvalDecisionSchema = z.object({ comment: z.string().trim().max(500).optional() }).strict();
export const approvalRejectSchema = z.object({ comment: z.string().trim().min(3).max(500) }).strict();
export const approvalReassignSchema = z.object({ toAccountId: uuidSchema, reason: z.string().trim().min(3).max(500) }).strict();
export const delegationSchema = z.object({ fromAccountId: uuidSchema, toAccountId: uuidSchema, startAt: z.string().datetime(), endAt: z.string().datetime(), scope: z.string().trim().min(2).max(60), reason: z.string().trim().min(3).max(500) }).strict().refine(value => new Date(value.endAt) > new Date(value.startAt), { message: "Thời gian kết thúc phải sau thời gian bắt đầu.", path: ["endAt"] });

export const workflowInputSchema = z.object({
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,49}$/), name: z.string().trim().min(3).max(120), domainType: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,49}$/),
  expectedProcessingHours: z.number().int().positive().max(8760).optional(),
  steps: z.array(z.object({ stepName: z.string().trim().min(2).max(100), approverSource: z.enum(["direct_manager","department_manager","project_manager","specific_role","specific_user","hr_resolver","warehouse_manager","domain_resolver"]), resolverConfig: z.record(z.unknown()).default({}) }).strict()).min(1).max(12)
}).strict();

export const notificationPreferencesSchema = z.object({ categories: z.record(z.boolean()) }).strict();
export const notificationTemplateSchema = z.object({ titleTemplate: z.string().trim().min(2).max(160), messageTemplate: z.string().trim().min(2).max(500) }).strict();
export const systemNoticeSchema = z.object({ title: z.string().trim().min(3).max(160), message: z.string().trim().min(3).max(500), startAt: z.string().datetime(), endAt: z.string().datetime(), audienceType: z.enum(["all_users","specific_roles","specific_departments"]), audienceIds: z.array(uuidSchema).max(100).default([]), priority: z.enum(["normal","important","critical"]), status: z.enum(["draft","active","inactive"]) }).strict().refine(value => new Date(value.endAt) > new Date(value.startAt), { message: "Thời gian kết thúc phải sau thời gian bắt đầu.", path: ["endAt"] }).refine(value => value.audienceType === "all_users" || value.audienceIds.length > 0, { message: "Cần chọn ít nhất một đối tượng nhận.", path: ["audienceIds"] });

export const companyDocumentSchema = z.object({ title: z.string().trim().min(2).max(180), documentTypeId: uuidSchema, expiryDate: z.union([z.literal(""), z.string().date()]).optional() }).strict();
export const documentVersionSchema = z.object({ changeNote: z.string().trim().min(3).max(500) }).strict();
