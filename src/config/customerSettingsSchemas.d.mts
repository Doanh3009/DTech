import type { z } from "zod";
import type registry from "./erpRegistry.json";

export interface BrandingSettingsValue {
  systemName: string;
  loginSubtitle: string;
  logoMainUrl: string | null;
  logoCompactUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  assetVersion: number;
}
export interface OrganizationSettingsValue {
  companyName: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  taxCode: string;
  representativeName: string;
}
export interface LocalizationSettingsValue {
  timezone: "Asia/Ho_Chi_Minh";
  dateFormat: "DD/MM/YYYY" | "YYYY-MM-DD";
  timeFormat: "HH:mm";
  weekStartsOn: "monday";
  locale: "vi-VN";
}
export interface ModuleSettingsValue {
  human_resources: boolean;
  attendance: boolean;
  projects: boolean;
  warehouse: boolean;
  import_export: boolean;
  reports: boolean;
  accounting?: boolean;
  operations?: boolean;
  messaging?: boolean;
  industryPreset?: keyof typeof registry.industries;
}
export const brandingSettingsSchema: z.ZodType<BrandingSettingsValue>;
export const organizationSettingsSchema: z.ZodType<OrganizationSettingsValue>;
export const localizationSettingsSchema: z.ZodType<LocalizationSettingsValue>;
export const moduleSettingsSchema: z.ZodType<ModuleSettingsValue>;
