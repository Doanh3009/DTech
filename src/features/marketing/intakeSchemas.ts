import { z } from "zod";

// Kept independent of CRM so the public form never imports operator code.
export const intakeQualificationSchema = z.object({
  companyType: z.enum(["limited", "joint_stock", "private", "household", "other"]),
  taxCode: z.string().trim().max(30),
  companyWebsite: z.union([z.literal(""), z.string().url().max(240).refine(v => { const u = new URL(v); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; })]),
  contactRole: z.string().trim().min(2).max(100), province: z.string().trim().min(2).max(100), address: z.string().trim().min(5).max(240),
  branchCount: z.number().int().min(1).max(10000), currentTools: z.string().trim().max(500),
  rolloutWindow: z.enum(["now", "quarter", "later", "exploring"])
}).strict();
