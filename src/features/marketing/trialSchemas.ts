import { z } from "zod";
import { intakeQualificationSchema } from "./intakeSchemas";

import businessIndustries from "@/config/businessIndustries.json";
export const trialIndustries = { ...Object.fromEntries(Object.entries(businessIndustries).map(([k,v])=>[k,v.label])) as Record<keyof typeof businessIndustries,string>, construction: "Xây dựng & thi công", trading: "Thương mại & phân phối", services: "Dịch vụ", garment: "May mặc", other: "Ngành khác" } as const;
export const trialCompanySizes = { under_20: "Dưới 20 người", "20_100": "20–100 người", "101_300": "101–300 người", over_300: "Trên 300 người" } as const;
export const trialStatusLabels = { new: "Mới tiếp nhận", contacted: "Đã liên hệ", qualified: "Phù hợp dùng thử", closed: "Đã đóng" } as const;
export const trialTransitions = { new: ["contacted","closed"], contacted: ["qualified","closed"], qualified: ["closed"], closed: [] } as const;
export const trialRequestSchema = z.object({
  requestId: z.string().uuid(),
  companyName: z.string().trim().min(2).max(180), contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(9).max(24).regex(/^[+0-9() .-]+$/).refine((value) => { const digits=value.replace(/\D/g, ""); return digits.length>=9 && digits.length<=15; }),
  industry: z.enum(["construction","trading","services","garment","other","metalworking","plastics_packaging","electronics","food_beverage"]),
  companySize: z.enum(["under_20","20_100","101_300","over_300"]),
  needs: z.string().trim().max(1500), consent: z.literal(true), website: z.string().max(0).optional(),
  qualification: intakeQualificationSchema.optional()
}).strict().refine(v=>!v.qualification||(v.needs.length>=10&&v.companyName.length<=120&&v.contactName.length<=100),{message:"Hoàn thiện thông tin khảo sát.",path:["needs"]});
export const trialReviewSchema = z.object({ rowVersion:z.number().int().positive(), status:z.enum(["contacted","qualified","closed"]), reason:z.string().trim().min(3).max(500) }).strict();
export type TrialRequestInput = z.infer<typeof trialRequestSchema>;
export type TrialStatus = keyof typeof trialStatusLabels;
export interface TrialRequestRecord { requestId:string; createdAt:string; companyName:string; contactName:string; email:string; phone:string; industry:keyof typeof trialIndustries; companySize:keyof typeof trialCompanySizes; needs:string; status:TrialStatus; rowVersion:number; reviewNote:string|null; reviewedAt:string|null; qualification?: z.infer<typeof intakeQualificationSchema>; customerId?:string }
