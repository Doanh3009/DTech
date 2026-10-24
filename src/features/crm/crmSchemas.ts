import { z } from "zod";
import { erpModuleKeys, industryKeys, getIndustryPreset, type IndustryKey } from "@/config/erpModules";
import { trialCompanySizes } from "@/features/marketing/trialSchemas";

export const companyTypes = { limited: "Công ty TNHH", joint_stock: "Công ty cổ phần", private: "Doanh nghiệp tư nhân", household: "Hộ kinh doanh", other: "Loại hình khác" } as const;
export const rolloutWindows = { now: "Trong tháng này", quarter: "Trong 3 tháng", later: "Sau 3 tháng", exploring: "Đang tìm hiểu" } as const;
export const crmStages = { discovery: "Khảo sát", configuration: "Thiết lập", provisioning: "Cấp môi trường", trial: "Đang dùng thử", active: "Đã bàn giao", paused: "Tạm dừng", closed: "Đã đóng" } as const;
export const crmTransitions: Record<CrmStage, readonly CrmStage[]> = { discovery: ["configuration", "paused", "closed"], configuration: ["discovery", "provisioning", "paused", "closed"], provisioning: ["configuration", "trial", "paused", "closed"], trial: ["provisioning", "active", "paused", "closed"], active: ["provisioning", "paused", "closed"], paused: ["discovery", "configuration", "provisioning", "trial", "active", "closed"], closed: ["discovery"] };
const text = (max: number) => z.string().trim().max(max).refine(v => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v));
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)]);
const url = z.union([z.literal(""), z.string().url().max(240).refine(v => { const u = new URL(v); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; })]);
export const crmProfileSchema = z.object({
  companyName: text(120).pipe(z.string().min(2)), taxCode: text(30), companyType: z.enum(["limited", "joint_stock", "private", "household", "other"]),
  industry: z.enum(industryKeys), companySize: z.enum(Object.keys(trialCompanySizes) as [keyof typeof trialCompanySizes, ...Array<keyof typeof trialCompanySizes>]),
  province: text(100), address: text(240), website: url, branchCount: z.number().int().min(1).max(10000),
  contactName: text(100).pipe(z.string().min(2)), contactRole: text(100), email: z.string().trim().toLowerCase().email().max(254),
  phone: text(24).pipe(z.string().regex(/^[+0-9() .-]{9,24}$/)).refine(v => v.replace(/\D/g, "").length >= 9 && v.replace(/\D/g, "").length <= 15),
  needs: text(2000), currentTools: text(500), rolloutWindow: z.enum(["now", "quarter", "later", "exploring"]), ownerName: text(100), nextContactOn: date
}).strict();
const optionalPattern = (pattern: RegExp, max: number) => z.union([z.literal(""), text(max).pipe(z.string().regex(pattern))]);
export const readinessLabels = { database: "Không gian dữ liệu đã sẵn sàng", configuration: "Đã áp dụng cấu hình khách hàng", account: "Đã cấp tài khoản quản trị", access: "Đã kiểm tra đăng nhập và phân quyền", data: "Đã thống nhất dữ liệu dùng thử" } as const;
export const crmSetupSchema = z.object({
  industryPreset: z.enum(industryKeys), enabledModules: z.array(z.enum(erpModuleKeys)).max(erpModuleKeys.length).refine(v => new Set(v).size === v.length),
  shortName: text(30), systemName: text(100), workflow: text(2000),
  deploymentId: optionalPattern(/^[a-z][a-z0-9-]{2,49}$/, 50), projectRef: optionalPattern(/^[a-z]{20}$/, 20), organizationId: optionalPattern(/^[a-z]{20}$/, 20),
  baseUrl: z.union([z.literal(""), z.string().url().max(240).refine(v => { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); })]).transform(v=>v?new URL(v).origin:""),
  region: z.string().regex(/^[a-z]+-[a-z]+-\d+$/), environment: z.enum(["staging", "production"]),
  adminUsername: optionalPattern(/^[a-z][a-z0-9._-]{2,31}$/, 32), adminDisplayName: text(100), adminEmployeeCode: optionalPattern(/^[A-Z][A-Z0-9-]{2,39}$/, 40),
  trialStartsOn: date, trialEndsOn: date, checks: z.object({ database: z.boolean(), configuration: z.boolean(), account: z.boolean(), access: z.boolean(), data: z.boolean() }).strict()
}).strict().refine(v => !v.trialStartsOn || !v.trialEndsOn || v.trialStartsOn <= v.trialEndsOn, { path: ["trialEndsOn"], message: "Ngày kết thúc phải từ ngày bắt đầu." });
export type CrmProfile = z.infer<typeof crmProfileSchema>;
export type CrmSetup = z.infer<typeof crmSetupSchema>;
export type CrmStage = keyof typeof crmStages;
export const crmSaveSchema = z.object({ customerId: z.string().uuid(), rowVersion: z.number().int().nonnegative(), profile: crmProfileSchema, setup: crmSetupSchema, stage: z.enum(["discovery", "configuration", "provisioning", "trial", "active", "paused", "closed"]), reason: text(500).pipe(z.string().min(3)) }).strict();
export const crmConvertSchema = z.object({ customerId: z.string().uuid(), requestId: z.string().uuid(), rowVersion: z.number().int().positive() }).strict();
export const crmActivitySchema = z.object({ rowVersion: z.number().int().positive(), activityId: z.string().uuid(), kind: z.enum(["note", "call", "email", "meeting"]), note: text(2000).pipe(z.string().min(3)) }).strict();
export interface CrmCustomer { customerId: string; sourceRequestId: string | null; profile: CrmProfile; setup: CrmSetup; stage: CrmStage; rowVersion: number; createdAt: string; updatedAt: string }
export interface CrmActivity { activityId: string; kind: string; note: string; createdAt: string; actorName: string }
export function emptyProfile(): CrmProfile { return { companyName: "", taxCode: "", companyType: "other", industry: "general", companySize: "under_20", province: "", address: "", website: "", branchCount: 1, contactName: "", contactRole: "", email: "", phone: "", needs: "", currentTools: "", rolloutWindow: "exploring", ownerName: "", nextContactOn: "" }; }
export function emptySetup(industry: IndustryKey = "general"): CrmSetup { return { industryPreset: industry, enabledModules: [...getIndustryPreset(industry).modules], shortName: "", systemName: "", workflow: "", deploymentId: "", projectRef: "", organizationId: "", baseUrl: "", region: "ap-southeast-1", environment: "staging", adminUsername: "admin", adminDisplayName: "", adminEmployeeCode: "SYS-ADMIN", trialStartsOn: "", trialEndsOn: "", checks: { database: false, configuration: false, account: false, access: false, data: false } }; }
export function provisioningIssues(profile: CrmProfile, setup: CrmSetup): string[] {
  return [...(!profile.address || !profile.contactRole || !profile.needs ? ["Thông tin khảo sát"] : []), ...(!setup.enabledModules.length ? ["Module"] : []), ...(["shortName", "systemName", "deploymentId", "projectRef", "organizationId", "baseUrl", "adminUsername", "adminDisplayName", "adminEmployeeCode"] as const).filter(k => setup[k].length < 2)];
}
