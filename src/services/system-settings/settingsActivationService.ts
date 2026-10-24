import "server-only";
import { z } from "zod";
import {
  defaultSystemSettings,
  isSystemSettingsGroup,
  normalizeStoredDashboardSettings,
  normalizeStoredNavigationSettings,
  systemSettingsSchemas,
  type SystemSettingsDocument,
  type SystemSettingsGroup
} from "@/config/systemSettings";
import { erpModuleKeys } from "@/config/erpModules";
import { AppError } from "@/lib/api/errors";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { requirePermission } from "@/services/authorization/requirePermission";
import { invalidateSystemSettingsCache } from "./systemSettingsService";
import { executeSettingsCommand, isSettingsCommandTableMissing, SETTINGS_VERSION_MAX, settingsVersionSchema } from "./systemSettingsCommands";

export const activationGroupKeys = ["branding", "organization", "localization", "modules"] as const;
export const activationPermissions: readonly Permission[] = [
  "system_admin.access", "branding.manage", "organization_settings.manage", "localization.manage", "module.manage"
];
const fullModulesSchema = systemSettingsSchemas.modules.superRefine((value, context) => {
  for (const key of erpModuleKeys) {
    if (typeof value[key] !== "boolean") context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: "Cần chọn trạng thái module." });
  }
});
export const settingsActivationSchema = z.object({
  requestId: z.string().uuid(),
  groups: z.object({
    branding: systemSettingsSchemas.branding,
    organization: systemSettingsSchemas.organization,
    localization: systemSettingsSchemas.localization,
    modules: fullModulesSchema
  }).strict(),
  expectedVersions: z.object({
    branding: settingsVersionSchema,
    organization: settingsVersionSchema,
    localization: settingsVersionSchema,
    modules: settingsVersionSchema
  }).strict(),
  changeType: z.literal("publish").default("publish")
}).strict();

export interface SettingsActivationState {
  settings: SystemSettingsDocument;
  versions: Record<SystemSettingsGroup, number>;
  ready: boolean;
}

export function requireSettingsActivationPermission(user: AuthenticatedUser | null): AuthenticatedUser {
  const actor = requirePermission(user, "system_admin.access");
  for (const permission of activationPermissions) requirePermission(actor, permission);
  return actor;
}

export async function readSettingsActivationState(): Promise<SettingsActivationState> {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("NETWORK_ERROR", "Dịch vụ cấu hình hệ thống chưa sẵn sàng.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    // Values and versions must be from the same query, never the presentation cache.
    const { data, error } = await client.from("system_settings").select("group_key,value,version").abortSignal(controller.signal);
    if (error || !Array.isArray(data)) throw new AppError("NETWORK_ERROR", "Chưa thể đọc cấu hình ERP. Vui lòng thử lại.");
    const settings = structuredClone(defaultSystemSettings);
    const versions = Object.fromEntries(Object.keys(defaultSystemSettings).map((key) => [key, 0])) as Record<SystemSettingsGroup, number>;
    const seen = new Set<SystemSettingsGroup>();
    for (const row of data) {
      if (!isSystemSettingsGroup(row.group_key)) continue;
      const group = row.group_key;
      if (seen.has(group)) throw new AppError("NETWORK_ERROR", "Cấu hình ERP không hợp lệ. Cần kiểm tra dữ liệu đã lưu.");
      seen.add(group);
      const stored = group === "navigation" ? normalizeStoredNavigationSettings(row.value)
        : group === "dashboard" ? normalizeStoredDashboardSettings(row.value) : row.value;
      const parsed = systemSettingsSchemas[group].safeParse(stored);
      const version = z.number().int().min(1).max(SETTINGS_VERSION_MAX + 1).safeParse(row.version);
      if (!parsed.success || !version.success) throw new AppError("NETWORK_ERROR", "Cấu hình ERP không hợp lệ. Cần kiểm tra dữ liệu đã lưu.");
      settings[group] = parsed.data as never;
      versions[group] = version.data;
    }
    if (activationGroupKeys.some((key) => versions[key] === 0)) throw new AppError("NETWORK_ERROR", "Cấu hình ERP chưa đầy đủ. Cần kiểm tra dữ liệu đã lưu.");
    const probe = await client.from("system_settings_commands").select("request_id").limit(0).abortSignal(controller.signal);
    if (probe.error && !isSettingsCommandTableMissing(probe.error)) throw new AppError("NETWORK_ERROR", "Chưa thể kiểm tra trạng thái thiết lập ERP.");
    if (!probe.error && !Array.isArray(probe.data)) throw new AppError("NETWORK_ERROR", "Chưa thể xác minh trạng thái thiết lập ERP.");
    return { settings, versions, ready: !probe.error };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("NETWORK_ERROR", "Chưa thể đọc cấu hình ERP. Vui lòng thử lại.");
  } finally {
    clearTimeout(timer);
  }
}

export async function activateSystemSettings(user: AuthenticatedUser | null, input: unknown) {
  const actor = requireSettingsActivationPermission(user);
  if (!z.string().uuid().safeParse(actor.id).success) throw new AppError("PERMISSION_DENIED");
  const parsed = settingsActivationSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Cấu hình ERP hoặc phiên bản chưa hợp lệ.");
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("NETWORK_ERROR", "Dịch vụ cấu hình hệ thống chưa sẵn sàng.");
  try {
    await executeSettingsCommand(client, { actorId: actor.id, ...parsed.data });
  } finally {
    // A transport failure can occur after commit. Never keep serving a stale local cache.
    invalidateSystemSettingsCache();
  }
  // A lost response here is safe to retry with the same immutable request ID/body.
  return { ...await readSettingsActivationState(), requestId: parsed.data.requestId };
}
