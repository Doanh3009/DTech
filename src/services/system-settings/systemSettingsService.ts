import { z } from "zod";
import { cache } from "react";

import { erpModuleKeys } from "@/config/erpModules";
import {
  defaultSystemSettings,
  isSystemSettingsGroup,
  normalizeStoredDashboardSettings,
  normalizeStoredNavigationSettings,
  parseSystemSettingsGroup,
  systemSettingsSchemas,
  type SystemSettingsDocument,
  type SystemSettingsGroup
} from "@/config/systemSettings";
import { AppError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { recordAuditLog } from "@/services/audit/auditLog";
import { executeSettingsCommand, SETTINGS_VERSION_MAX } from "./systemSettingsCommands";

export interface SettingsVersion {
  id: string;
  group: SystemSettingsGroup;
  version: number;
  snapshot: SystemSettingsDocument[SystemSettingsGroup];
  changeType: "publish" | "restore";
  createdAt: string;
  createdBy: string;
}

interface StoredSettingsGroup {
  value: SystemSettingsDocument[SystemSettingsGroup];
  version: number;
}

const localSettings = new Map<SystemSettingsGroup, StoredSettingsGroup>(
  (Object.keys(defaultSystemSettings) as SystemSettingsGroup[]).map((group) => [
    group,
    { value: structuredClone(defaultSystemSettings[group]), version: 1 }
  ])
);
const localVersions: SettingsVersion[] = [];
let lastSettingsReadFailureLog = 0;
const SETTINGS_CACHE_MS = 30_000;
const SETTINGS_READ_TIMEOUT_MS = 2_000;
const SETTINGS_RETRY_MS = 1_000;
let settingsSnapshot: { value: SystemSettingsDocument; expiresAt: number } | undefined;
let settingsRead: Promise<SystemSettingsDocument> | undefined;
let settingsReadFailure: { error: AppError; retryAt: number } | undefined;
let settingsGeneration = 0;

function safeDefault<TGroup extends SystemSettingsGroup>(group: TGroup): SystemSettingsDocument[TGroup] {
  return structuredClone(defaultSystemSettings[group]);
}

function normalizeStoredSettings(group: SystemSettingsGroup, value: unknown): unknown {
  if (group === "navigation") return normalizeStoredNavigationSettings(value);
  if (group === "dashboard") return normalizeStoredDashboardSettings(value);
  return value;
}

async function loadSystemSettings(): Promise<SystemSettingsDocument> {
  const groups = Object.keys(systemSettingsSchemas) as SystemSettingsGroup[];
  const result = structuredClone(defaultSystemSettings);
  const client = getSupabaseServiceClient();

  if (client) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SETTINGS_READ_TIMEOUT_MS);
    let data: Array<{ group_key: string; value: unknown }> | null = null;
    let error: unknown;
    try {
      const response = await client.from("system_settings").select("group_key,value,version").abortSignal(controller.signal);
      data = response.data;
      error = response.error;
    } catch (cause) {
      error = cause;
    } finally {
      clearTimeout(timeout);
    }
    if (!error && data) {
      let modulesVerified = false;
      for (const row of data) {
        if (!isSystemSettingsGroup(row.group_key)) continue;
        const storedValue = normalizeStoredSettings(row.group_key, row.value);
        const parsed = systemSettingsSchemas[row.group_key].safeParse(storedValue);
        if (parsed.success) {
          result[row.group_key] = parsed.data as never;
          if (row.group_key === "modules") modulesVerified = true;
        } else {
          logger.error("system_settings.invalid_stored_value", { metadata: { group: row.group_key } });
        }
      }
      // Activation must come from a valid stored group, never the all-enabled defaults.
      if (!modulesVerified) {
        logger.error("system_settings.modules_unverified");
        throw new AppError("NETWORK_ERROR", "Chưa thể xác minh cấu hình module. Vui lòng thử lại.");
      }
      return result;
    }
    if (Date.now() - lastSettingsReadFailureLog > 60_000) {
      logger.error("system_settings.read_failed");
      lastSettingsReadFailureLog = Date.now();
    }
    throw new AppError("NETWORK_ERROR", "Chưa thể tải cấu hình hệ thống. Vui lòng thử lại.");
  }

  // In-memory settings support development/tests only, never a deployed fallback.
  if (process.env.NODE_ENV === "production") {
    throw new AppError("NETWORK_ERROR", "Dịch vụ cấu hình hệ thống chưa sẵn sàng.");
  }

  for (const group of groups) {
    const stored = localSettings.get(group);
    if (!stored) continue;
    const parsed = systemSettingsSchemas[group].safeParse(normalizeStoredSettings(group, stored.value));
    result[group] = (parsed.success ? parsed.data : safeDefault(group)) as never;
  }
  return result;
}

function refreshSettings(): Promise<SystemSettingsDocument> {
  if (!settingsRead) {
    if (settingsReadFailure && settingsReadFailure.retryAt > Date.now()) {
      return Promise.reject(settingsReadFailure.error);
    }
    const generation = settingsGeneration;
    const pending = loadSystemSettings().then((value) => {
      if (generation === settingsGeneration) {
        settingsSnapshot = { value, expiresAt: Date.now() + SETTINGS_CACHE_MS };
        settingsReadFailure = undefined;
      }
      return value;
    }).catch((error: unknown) => {
      const failure = error instanceof AppError
        ? error
        : new AppError("NETWORK_ERROR", "Chưa thể tải cấu hình hệ thống. Vui lòng thử lại.");
      if (generation === settingsGeneration) settingsReadFailure = { error: failure, retryAt: Date.now() + SETTINGS_RETRY_MS };
      throw failure;
    });
    settingsRead = pending;
    void pending.finally(() => { if (settingsRead === pending) settingsRead = undefined; }).catch(() => undefined);
  }
  return settingsRead;
}

export const readSystemSettings = cache(async (): Promise<SystemSettingsDocument> => {
  for (;;) {
    if (settingsSnapshot && settingsSnapshot.expiresAt > Date.now()) return structuredClone(settingsSnapshot.value);
    const generation = settingsGeneration;
    try {
      const value = await refreshSettings();
      // A publish during this read takes precedence over the earlier database response.
      if (generation === settingsGeneration) return structuredClone(value);
    } catch (error) {
      if (generation === settingsGeneration) throw error;
    }
  }
});

/** Rendering only. Authorization and business services must use the strict readers. */
export const readPresentationSettings = cache(async (): Promise<SystemSettingsDocument> => {
  try {
    return await readSystemSettings();
  } catch {
    const value = structuredClone(settingsSnapshot?.value ?? defaultSystemSettings);
    for (const key of erpModuleKeys) value.modules[key] = false;
    return value;
  }
});

export async function readSettingsGroup<TGroup extends SystemSettingsGroup>(
  group: TGroup
): Promise<SystemSettingsDocument[TGroup]> {
  const settings = await readSystemSettings();
  return settings[group];
}

export function invalidateSystemSettingsCache(): void {
  settingsGeneration += 1;
  if (settingsSnapshot) settingsSnapshot.expiresAt = 0;
  settingsRead = undefined;
  settingsReadFailure = undefined;
}

export async function publishSettingsGroup<TGroup extends SystemSettingsGroup>(input: {
  group: TGroup;
  value: unknown;
  actorId: string;
  changeType?: "publish" | "restore";
}): Promise<{ value: SystemSettingsDocument[TGroup]; version: number }> {
  const value = parseSystemSettingsGroup(input.group, input.value);
  const before = await readSettingsGroup(input.group);
  const localStored = localSettings.get(input.group);
  let version = (localStored?.version ?? 0) + 1;
  const now = new Date().toISOString();
  const versionId = globalThis.crypto.randomUUID();
  const client = getSupabaseServiceClient();
  let persistedAtomically = false;
  if (!client && process.env.NODE_ENV === "production") {
    throw new AppError("NETWORK_ERROR", "Dịch vụ cấu hình hệ thống chưa sẵn sàng.");
  }

  if (client) {
    const { data: current, error: currentError } = await client
      .from("system_settings")
      .select("version")
      .eq("group_key", input.group)
      .maybeSingle();
    if (currentError) throw new AppError("NETWORK_ERROR", "Chưa thể đọc phiên bản cấu hình. Vui lòng thử lại.");
    if (current && !z.number().int().min(1).max(SETTINGS_VERSION_MAX).safeParse(current.version).success) {
      throw new AppError("CONFLICT", "Phiên bản cấu hình không thể cập nhật. Cần kiểm tra dữ liệu đã lưu.");
    }
    version = (current?.version ?? 0) + 1;

    try {
      const receipt = await executeSettingsCommand(client, {
        actorId: input.actorId,
        requestId: versionId,
        groups: { [input.group]: value },
        expectedVersions: { [input.group]: version - 1 },
        changeType: input.changeType ?? "publish"
      }, true);
      persistedAtomically = receipt !== null;
    } catch (error) {
      invalidateSystemSettingsCache();
      throw error;
    }

    if (!persistedAtomically) {
      const { error } = await client.from("system_settings").upsert({
        group_key: input.group,
        value,
        version,
        updated_by: z.string().uuid().safeParse(input.actorId).success ? input.actorId : null,
        updated_at: now
      });
      if (error) throw new AppError("SERVER_ERROR", "Không thể lưu cấu hình.");

      const { error: versionError } = await client.from("settings_versions").insert({
        id: versionId,
        group_key: input.group,
        version,
        snapshot: value,
        change_type: input.changeType ?? "publish",
        created_by: z.string().uuid().safeParse(input.actorId).success ? input.actorId : null,
        created_at: now
      });
      if (versionError) logger.error("system_settings.version_write_failed", { metadata: { group: input.group } });
    }
  }

  localSettings.set(input.group, { value: structuredClone(value), version });
  settingsGeneration += 1;
  settingsReadFailure = undefined;
  if (settingsSnapshot) {
    settingsSnapshot = {
      value: { ...settingsSnapshot.value, [input.group]: structuredClone(value) },
      // Publishing a cosmetic group must not extend an older module verification.
      expiresAt: settingsSnapshot.expiresAt
    };
  }
  localVersions.unshift({
    id: versionId,
    group: input.group,
    version,
    snapshot: structuredClone(value),
    changeType: input.changeType ?? "publish",
    createdAt: now,
    createdBy: input.actorId
  });

  if (!persistedAtomically) await recordAuditLog({
    actorId: input.actorId,
    action: input.changeType === "restore" ? "system_settings.restore" : "system_settings.publish",
    entityType: "system_settings",
    entityId: input.group,
    before: before as Record<string, unknown>,
    after: value as Record<string, unknown>,
    metadata: { version }
  });

  return { value, version };
}

export async function listSettingsVersions(): Promise<SettingsVersion[]> {
  const client = getSupabaseServiceClient();
  if (client) {
    const { data, error } = await client
      .from("settings_versions")
      .select("id,group_key,version,snapshot,change_type,created_at,created_by")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      return data.flatMap((row) => {
        if (!isSystemSettingsGroup(row.group_key)) return [];
        const parsed = systemSettingsSchemas[row.group_key].safeParse(normalizeStoredSettings(row.group_key, row.snapshot));
        if (!parsed.success) return [];
        const entry: SettingsVersion = {
            id: row.id,
            group: row.group_key,
            version: row.version,
            snapshot: parsed.data,
            changeType: row.change_type === "restore" ? "restore" : "publish",
            createdAt: row.created_at,
            createdBy: row.created_by ?? "system"
        };
        return [entry];
      });
    }
    throw new AppError("NETWORK_ERROR", "Chưa thể đọc lịch sử cấu hình. Vui lòng thử lại.");
  }
  if (process.env.NODE_ENV === "production") throw new AppError("NETWORK_ERROR", "Dịch vụ cấu hình hệ thống chưa sẵn sàng.");
  return [...localVersions];
}

export async function restoreSettingsVersion(versionId: string, actorId: string): Promise<SettingsVersion> {
  const versions = await listSettingsVersions();
  const selected = versions.find((version) => version.id === versionId);
  if (!selected) throw new AppError("NOT_FOUND", "Không tìm thấy phiên bản cấu hình.");

  await publishSettingsGroup({
    group: selected.group,
    value: selected.snapshot,
    actorId,
    changeType: "restore"
  });
  return selected;
}

export function resetLocalSystemSettingsForTests(): void {
  settingsGeneration += 1;
  settingsSnapshot = undefined;
  settingsRead = undefined;
  settingsReadFailure = undefined;
  lastSettingsReadFailureLog = 0;
  localVersions.splice(0, localVersions.length);
  for (const group of Object.keys(defaultSystemSettings) as SystemSettingsGroup[]) {
    localSettings.set(group, { value: structuredClone(defaultSystemSettings[group]), version: 1 });
  }
}
