import { z } from "zod";

import {
  dashboardProfileKeys,
  dashboardWidgetKeys,
  defaultDashboardSettings
} from "@/features/dashboard/registry";
import { dashboardLandingPages } from "@/features/dashboard/types";

export const configurableNavigationPaths = [
  "/dashboard",
  "/employees",
  "/employees/departments",
  "/employees/positions",
  "/employees/contracts",
  "/employees/insurance",
  "/attendance/today",
  "/attendance/logs",
  "/timesheets/matrix",
  "/timesheets",
  "/timesheets/adjustments",
  "/shifts",
  "/shifts/calendar",
  "/leave/manage",
  "/attendance",
  "/attendance/me",
  "/attendance/history",
  "/attendance/requests",
  "/attendance/notifications",
  "/leave",
  "/projects",
  "/projects/updates",
  "/worker-attendance",
  "/warehouse/items",
  "/warehouse/receipts",
  "/warehouse/issues",
  "/warehouse/transfers",
  "/warehouse/inventory",
  "/import-export",
  "/import-export/shipments",
  "/import-export/transport",
  "/import-export/contracts",
  "/import-export/documents",
  "/import-export/customs",
  "/import-export/partners",
  "/approvals",
  "/documents",
  "/reports"
] as const;

export const moduleKeys = [
  "human_resources",
  "attendance",
  "projects",
  "warehouse",
  "import_export",
  "reports"
] as const;

export type ModuleKey = (typeof moduleKeys)[number];

const localAssetPath = z.string().regex(/^\/[A-Za-z0-9/_-]+\.(png|jpe?g|webp|ico)$/i, "Đường dẫn tài sản không hợp lệ.");
const nullableAssetUrl = z.union([z.string().url().max(2_000), localAssetPath]).nullable();
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Mã màu phải có dạng #RRGGBB.");

export const brandingSettingsSchema = z
  .object({
    systemName: z.string().trim().min(2).max(100),
    loginSubtitle: z.string().trim().max(140),
    logoMainUrl: nullableAssetUrl,
    logoCompactUrl: nullableAssetUrl,
    logoDarkUrl: nullableAssetUrl,
    faviconUrl: nullableAssetUrl,
    assetVersion: z.number().int().nonnegative()
  })
  .strict();

export const appearanceSettingsSchema = z
  .object({
    primaryColor: hexColorSchema,
    density: z.enum(["comfortable", "standard", "compact"]),
    tableDensity: z.enum(["standard", "compact"]),
    defaultPageSize: z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)]),
    sidebarDefault: z.enum(["expanded", "collapsed"]),
    appearanceMode: z.literal("light")
  })
  .strict();

export const organizationSettingsSchema = z
  .object({
    companyName: z.string().trim().min(2).max(120),
    shortName: z.string().trim().min(2).max(30),
    address: z.string().trim().max(240),
    phone: z.string().trim().max(30),
    email: z.union([z.literal(""), z.string().email()]),
    taxCode: z.string().trim().max(30),
    representativeName: z.string().trim().max(100)
  })
  .strict();

export const localizationSettingsSchema = z
  .object({
    timezone: z.enum(["Asia/Ho_Chi_Minh"]),
    dateFormat: z.enum(["DD/MM/YYYY", "YYYY-MM-DD"]),
    timeFormat: z.literal("HH:mm"),
    weekStartsOn: z.literal("monday"),
    locale: z.literal("vi-VN")
  })
  .strict();

const navigationPathSchema = z.enum(configurableNavigationPaths);

export const navigationSettingsSchema = z
  .object({
    hiddenItems: z.array(navigationPathSchema).max(configurableNavigationPaths.length),
    itemOrder: z.array(navigationPathSchema).length(configurableNavigationPaths.length),
    defaultLandingPage: z.enum(["/dashboard", "/attendance", "/projects"]),
    groupsExpanded: z.boolean()
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.itemOrder).size !== configurableNavigationPaths.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["itemOrder"], message: "Thứ tự điều hướng không hợp lệ." });
    }
  });

/**
 * Keeps a saved navigation layout usable when a release adds new registered
 * destinations. Publishing remains strict; only persisted older versions are
 * upgraded by appending missing routes in registry order.
 */
export function normalizeStoredNavigationSettings(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const stored = value as Record<string, unknown>;
  if (!Array.isArray(stored.itemOrder) || !Array.isArray(stored.hiddenItems)) return value;

  const knownPaths = new Set<string>(configurableNavigationPaths);
  const itemOrder = [...new Set(stored.itemOrder.filter(
    (path): path is (typeof configurableNavigationPaths)[number] =>
      typeof path === "string" && knownPaths.has(path)
  ))];
  for (const path of configurableNavigationPaths) {
    if (!itemOrder.includes(path)) itemOrder.push(path);
  }

  return {
    hiddenItems: [...new Set(stored.hiddenItems.filter(
      (path): path is (typeof configurableNavigationPaths)[number] =>
        typeof path === "string" && knownPaths.has(path)
    ))],
    itemOrder,
    defaultLandingPage: ["/dashboard", "/attendance", "/projects"].includes(String(stored.defaultLandingPage))
      ? stored.defaultLandingPage
      : "/dashboard",
    groupsExpanded: typeof stored.groupsExpanded === "boolean" ? stored.groupsExpanded : true
  };
}

const dashboardProfileSchema = z.enum(dashboardProfileKeys);
const dashboardWidgetSchema = z.enum(dashboardWidgetKeys);
const dashboardLandingPageSchema = z.enum(dashboardLandingPages);

export const dashboardSettingsSchema = z
  .object({
    presetOrder: z.array(dashboardProfileSchema).length(dashboardProfileKeys.length),
    presets: z.array(z.object({
      profile: dashboardProfileSchema,
      landingPage: dashboardLandingPageSchema,
      enabledWidgets: z.array(dashboardWidgetSchema).max(dashboardWidgetKeys.length)
    }).strict()).length(dashboardProfileKeys.length)
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.presetOrder).size !== dashboardProfileKeys.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["presetOrder"], message: "Thứ tự preset không hợp lệ." });
    }
    if (new Set(value.presets.map((preset) => preset.profile)).size !== dashboardProfileKeys.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["presets"], message: "Danh sách preset không hợp lệ." });
    }
    value.presets.forEach((preset, index) => {
      if (new Set(preset.enabledWidgets).size !== preset.enabledWidgets.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["presets", index, "enabledWidgets"], message: "Widget bị trùng." });
      }
    });
  });

/**
 * Keeps role dashboard customizations usable when a release adds a profile or
 * widget. Persisted values are filtered against the registry, while newly
 * registered profiles receive their defaults.
 */
export function normalizeStoredDashboardSettings(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const stored = value as Record<string, unknown>;
  if (!Array.isArray(stored.presetOrder) || !Array.isArray(stored.presets)) return value;

  const knownProfiles = new Set<string>(dashboardProfileKeys);
  const knownWidgets = new Set<string>(dashboardWidgetKeys);
  const knownLandingPages = new Set<string>(dashboardLandingPages);
  const presetOrder = [...new Set(stored.presetOrder.filter(
    (profile): profile is (typeof dashboardProfileKeys)[number] =>
      typeof profile === "string" && knownProfiles.has(profile)
  ))];
  for (const profile of dashboardProfileKeys) {
    if (!presetOrder.includes(profile)) presetOrder.push(profile);
  }

  const storedPresets = new Map<string, Record<string, unknown>>();
  for (const candidate of stored.presets) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const preset = candidate as Record<string, unknown>;
    if (typeof preset.profile === "string" && knownProfiles.has(preset.profile) && !storedPresets.has(preset.profile)) {
      storedPresets.set(preset.profile, preset);
    }
  }

  const defaults = new Map(defaultDashboardSettings.presets.map((preset) => [preset.profile, preset]));
  const presets = dashboardProfileKeys.map((profile) => {
    const fallback = defaults.get(profile)!;
    const saved = storedPresets.get(profile);
    const enabledWidgets = saved && Array.isArray(saved.enabledWidgets)
      ? [...new Set(saved.enabledWidgets.filter(
          (widget): widget is (typeof dashboardWidgetKeys)[number] =>
            typeof widget === "string" && knownWidgets.has(widget)
        ))]
      : [...fallback.enabledWidgets];
    const landingPage = saved && typeof saved.landingPage === "string" && knownLandingPages.has(saved.landingPage)
      ? saved.landingPage
      : fallback.landingPage;
    return { profile, landingPage, enabledWidgets };
  });

  return { presetOrder, presets };
}

export const moduleSettingsSchema = z
  .object({
    human_resources: z.boolean(),
    attendance: z.boolean(),
    projects: z.boolean(),
    warehouse: z.boolean(),
    import_export: z.boolean(),
    reports: z.boolean()
  })
  .strict();

export const payslipSettingsSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  title: z.string().trim().min(2).max(120),
  footer: z.string().trim().max(180),
  primaryColor: hexColorSchema,
  showWorkDays: z.boolean(),
  showBaseSalary: z.boolean(),
  showAllowance: z.boolean(),
  showBonus: z.boolean(),
  showDeduction: z.boolean()
}).strict();

export const featureFlagDefinitionSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
    moduleKey: z.string().regex(/^[a-z][a-z0-9_-]*$/),
    enabled: z.boolean(),
    config: z.record(z.unknown()).default({})
  })
  .strict();

export type FeatureFlagDefinition = z.infer<typeof featureFlagDefinitionSchema>;

export const systemSettingsSchemas = {
  branding: brandingSettingsSchema,
  appearance: appearanceSettingsSchema,
  organization: organizationSettingsSchema,
  localization: localizationSettingsSchema,
  navigation: navigationSettingsSchema,
  dashboard: dashboardSettingsSchema,
  modules: moduleSettingsSchema,
  payslip: payslipSettingsSchema
} as const;

export type BrandingSettings = z.infer<typeof brandingSettingsSchema>;
export type AppearanceSettings = z.infer<typeof appearanceSettingsSchema>;
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;
export type LocalizationSettings = z.infer<typeof localizationSettingsSchema>;
export type NavigationSettings = z.infer<typeof navigationSettingsSchema>;
export type DashboardSettings = z.infer<typeof dashboardSettingsSchema>;
export type ModuleSettings = z.infer<typeof moduleSettingsSchema>;
export type PayslipSettings = z.infer<typeof payslipSettingsSchema>;
export type SystemSettingsGroup = keyof typeof systemSettingsSchemas;

export interface SystemSettingsDocument {
  branding: BrandingSettings;
  appearance: AppearanceSettings;
  organization: OrganizationSettings;
  localization: LocalizationSettings;
  navigation: NavigationSettings;
  dashboard: DashboardSettings;
  modules: ModuleSettings;
  payslip: PayslipSettings;
}

export const defaultSystemSettings: SystemSettingsDocument = {
  branding: {
    systemName: "Hệ thống nội bộ Châu Tuấn",
    loginSubtitle: "Quản lý nhân sự, công trường và vận hành",
    logoMainUrl: "/brand/chau-tuan-logo.png",
    logoCompactUrl: null,
    logoDarkUrl: null,
    faviconUrl: null,
    assetVersion: 0
  },
  appearance: {
    primaryColor: "#2E9B67",
    density: "standard",
    tableDensity: "standard",
    defaultPageSize: 20,
    sidebarDefault: "expanded",
    appearanceMode: "light"
  },
  organization: {
    companyName: "Công ty Châu Tuấn",
    shortName: "CHÂU TUẤN",
    address: "",
    phone: "",
    email: "",
    taxCode: "",
    representativeName: ""
  },
  localization: {
    timezone: "Asia/Ho_Chi_Minh",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm",
    weekStartsOn: "monday",
    locale: "vi-VN"
  },
  navigation: {
    hiddenItems: [],
    itemOrder: [...configurableNavigationPaths],
    defaultLandingPage: "/dashboard",
    groupsExpanded: true
  },
  dashboard: structuredClone(defaultDashboardSettings),
  modules: {
    human_resources: true,
    attendance: true,
    projects: true,
    warehouse: true,
    import_export: true,
    reports: true
  },
  payslip: {
    companyName: "CÔNG TY CHÂU TUẤN",
    title: "PHIẾU LƯƠNG THÁNG {month}",
    footer: "Tài liệu nội bộ · Dữ liệu lương riêng tư",
    primaryColor: "#2E9B67",
    showWorkDays: true,
    showBaseSalary: true,
    showAllowance: true,
    showBonus: true,
    showDeduction: true
  }
};

export function isSystemSettingsGroup(value: string): value is SystemSettingsGroup {
  return Object.hasOwn(systemSettingsSchemas, value);
}

export function parseSystemSettingsGroup<TGroup extends SystemSettingsGroup>(
  group: TGroup,
  value: unknown
): SystemSettingsDocument[TGroup] {
  return systemSettingsSchemas[group].parse(value) as SystemSettingsDocument[TGroup];
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [red, green, blue] = hexToRgb(hex).map(channelToLinear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function mix(hex: string, target: "#000000" | "#FFFFFF", amount: number): string {
  const source = hexToRgb(hex);
  const destination = hexToRgb(target);
  const channels = source.map((channel, index) => Math.round(channel + (destination[index] - channel) * amount));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export interface BrandColorTokens {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySubtle: string;
  primaryBorder: string;
  primaryForeground: "#FFFFFF" | "#111827";
  focusRing: string;
  contrast: number;
}

export function deriveBrandColorTokens(primaryColor: string): BrandColorTokens {
  const configuredPrimary = hexColorSchema.parse(primaryColor).toUpperCase();
  const primary = ["#0F766E", "#19A94A", "#46A36D", "#2E9B67"].includes(configuredPrimary)
    ? "#268558"
    : configuredPrimary;
  const whiteContrast = contrastRatio(primary, "#FFFFFF");
  const blackContrast = contrastRatio(primary, "#111827");
  const primaryForeground = whiteContrast >= blackContrast ? "#FFFFFF" : "#111827";

  if (primary === "#268558") {
    return {
      primary,
      primaryHover: "#21734D",
      primaryActive: "#1C6241",
      primarySubtle: "#EAF7F0",
      primaryBorder: "#B8DDCA",
      primaryForeground: "#FFFFFF",
      focusRing: "#26855838",
      contrast: whiteContrast
    };
  }

  return {
    primary,
    primaryHover: mix(primary, primaryForeground === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.16),
    primaryActive: mix(primary, primaryForeground === "#FFFFFF" ? "#000000" : "#FFFFFF", 0.26),
    primarySubtle: mix(primary, "#FFFFFF", 0.9),
    primaryBorder: mix(primary, "#FFFFFF", 0.62),
    primaryForeground,
    focusRing: `${primary}38`,
    contrast: Math.max(whiteContrast, blackContrast)
  };
}

export function moduleForPath(pathname: string): ModuleKey | null {
  if (pathname.startsWith("/employees")) return "human_resources";
  if (pathname.startsWith("/attendance") || pathname.startsWith("/timesheets") || pathname.startsWith("/leave") || pathname.startsWith("/shifts")) return "attendance";
  if (pathname.startsWith("/projects") || pathname.startsWith("/worker-attendance")) return "projects";
  if (pathname.startsWith("/warehouse") || pathname.startsWith("/settings/warehouse")) return "warehouse";
  if (pathname.startsWith("/import-export") || pathname.startsWith("/settings/import-export")) return "import_export";
  if (pathname.startsWith("/reports")) return "reports";
  return null;
}

export function isPathEnabled(pathname: string, modules: ModuleSettings): boolean {
  const moduleKey = moduleForPath(pathname);
  return moduleKey ? modules[moduleKey] : true;
}
