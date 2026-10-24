import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SystemSettingsDocument, SystemSettingsGroup } from "@/config/systemSettings";
import { AppError } from "@/lib/api/errors";

export const SETTINGS_VERSION_MAX = 2_147_483_646;
export const settingsVersionSchema = z.number().int().min(0).max(SETTINGS_VERSION_MAX);
const receiptSchema = z.object({
  requestId: z.string().uuid(),
  versions: z.record(z.number().int().min(1).max(SETTINGS_VERSION_MAX + 1))
}).strict();

export interface SettingsCommandInput {
  actorId: string;
  requestId: string;
  groups: Partial<SystemSettingsDocument>;
  expectedVersions: Partial<Record<SystemSettingsGroup, number>>;
  changeType: "publish" | "restore";
}

export function isSettingsCommandTableMissing(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export function settingsCommandError(error: { message?: string; code?: string }): AppError {
  switch (error.message) {
    case "SETTINGS_VERSION_CONFLICT": return new AppError("CONFLICT", "Cấu hình đã thay đổi. Vui lòng tải lại trước khi lưu.");
    case "SETTINGS_REQUEST_CONFLICT": return new AppError("CONFLICT", "Mã yêu cầu đã được dùng cho thay đổi khác. Vui lòng tải lại cấu hình.");
    case "SETTINGS_ACTOR_FORBIDDEN": return new AppError("PERMISSION_DENIED");
    case "SETTINGS_INVALID_INPUT": return new AppError("VALIDATION_ERROR", "Cấu hình hoặc phiên bản không hợp lệ.");
    default: return new AppError("NETWORK_ERROR", "Chưa thể xác nhận lưu cấu hình. Vui lòng thử lại cùng yêu cầu.");
  }
}

/** null is allowed only for a positively identified, unmigrated legacy database. */
export async function executeSettingsCommand(client: SupabaseClient, input: SettingsCommandInput, allowLegacy = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const { data, error } = await client.rpc("publish_system_settings_command", {
      p_actor_id: input.actorId,
      p_request_id: input.requestId,
      p_groups: input.groups,
      p_expected_versions: input.expectedVersions,
      p_change_type: input.changeType
    }).abortSignal(controller.signal);
    if (error) {
      if (error.code === "PGRST202") {
        if (allowLegacy) {
          const probe = await client.from("system_settings_commands").select("request_id").limit(0).abortSignal(controller.signal);
          if (isSettingsCommandTableMissing(probe.error)) return null;
          // A migrated table with a missing RPC is a broken rollout, never a legacy write path.
        }
        throw new AppError("NETWORK_ERROR", "Chức năng lưu đồng bộ đang chờ cập nhật hệ thống.");
      }
      throw settingsCommandError(error);
    }
    const receipt = receiptSchema.safeParse(data);
    if (!receipt.success || receipt.data.requestId !== input.requestId
      || Object.keys(receipt.data.versions).sort().join(",") !== Object.keys(input.groups).sort().join(",")
      || Object.entries(receipt.data.versions).some(([group, version]) => version !== (input.expectedVersions[group as SystemSettingsGroup] ?? -1) + 1)) {
      throw new AppError("NETWORK_ERROR", "Chưa thể xác nhận kết quả lưu cấu hình. Vui lòng thử lại cùng yêu cầu.");
    }
    return receipt.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("NETWORK_ERROR", "Chưa thể xác nhận lưu cấu hình. Vui lòng thử lại cùng yêu cầu.");
  } finally {
    clearTimeout(timer);
  }
}
