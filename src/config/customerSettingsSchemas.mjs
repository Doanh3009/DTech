import { z } from "zod";
import registry from "./erpRegistry.json" with { type: "json" };

// Shared runtime validators for the application and plain Node deployment tools.
const localAssetPath = z.string().regex(/^\/[A-Za-z0-9/_-]+\.(png|jpe?g|webp|ico)$/i, "Đường dẫn tài sản không hợp lệ.");
const nullableAssetUrl = z.union([z.string().url().max(2_000), localAssetPath]).nullable();

export const brandingSettingsSchema = z.object({
  systemName: z.string().trim().min(2).max(100),
  loginSubtitle: z.string().trim().max(140),
  logoMainUrl: nullableAssetUrl,
  logoCompactUrl: nullableAssetUrl,
  logoDarkUrl: nullableAssetUrl,
  faviconUrl: nullableAssetUrl,
  assetVersion: z.number().int().nonnegative()
}).strict();

export const organizationSettingsSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(2).max(30),
  address: z.string().trim().max(240),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().email()]),
  taxCode: z.string().trim().max(30),
  representativeName: z.string().trim().max(100)
}).strict();

export const localizationSettingsSchema = z.object({
  timezone: z.enum(["Asia/Ho_Chi_Minh"]),
  dateFormat: z.enum(["DD/MM/YYYY", "YYYY-MM-DD"]),
  timeFormat: z.literal("HH:mm"),
  weekStartsOn: z.literal("monday"),
  locale: z.literal("vi-VN")
}).strict();

export const moduleSettingsSchema = z.object({
  human_resources: z.boolean(),
  attendance: z.boolean(),
  projects: z.boolean(),
  warehouse: z.boolean(),
  import_export: z.boolean(),
  reports: z.boolean(),
  accounting: z.boolean().optional(),
  operations: z.boolean().optional(),
  messaging: z.boolean().optional(),
  industryPreset: z.enum(Object.keys(registry.industries)).optional()
}).strict();
