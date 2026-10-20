import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AppError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getBusinessDateKey } from "@/lib/time/timezone";

type Row = Record<string, unknown>;

async function removeExpiredEvidence(
  client: SupabaseClient,
  table: "attendance_photos" | "worker_attendance_photos",
  relation: "attendance_events" | "worker_attendance_sessions",
  cutoffDate: string
) {
  const { data, error } = await client
    .from(table)
    .select(`id,file_id,thumbnail_file_id,${relation}!inner(attendance_date)`)
    .eq("evidence_status", "available")
    .lt(`${relation}.attendance_date`, cutoffDate)
    .limit(500);
  if (error) throw new AppError("SERVER_ERROR", "Không thể đọc danh sách ảnh hết hạn.");

  const photos = (data ?? []) as Row[];
  if (!photos.length) return 0;
  const assetIds = [...new Set(photos.flatMap((photo) => [photo.file_id, photo.thumbnail_file_id]).filter((id): id is string => typeof id === "string"))];
  const { data: assets, error: assetError } = assetIds.length
    ? await client.from("file_assets").select("id,bucket,object_path").in("id", assetIds)
    : { data: [], error: null };
  if (assetError) throw new AppError("SERVER_ERROR", "Không thể đọc metadata ảnh hết hạn.");

  const pathsByBucket = new Map<string, string[]>();
  for (const asset of (assets ?? []) as Row[]) {
    const bucket = String(asset.bucket), path = String(asset.object_path);
    pathsByBucket.set(bucket, [...(pathsByBucket.get(bucket) ?? []), path]);
  }
  for (const [bucket, paths] of pathsByBucket) {
    const { error: storageError } = await client.storage.from(bucket).remove(paths);
    if (storageError) throw new AppError("SERVER_ERROR", "Không thể xóa ảnh chấm công hết hạn khỏi storage.");
  }

  const photoIds = photos.map((photo) => String(photo.id));
  const deletedAt = new Date().toISOString();
  const { error: updateError } = await client.from(table).update({
    file_id: null,
    thumbnail_file_id: null,
    evidence_status: "expired",
    evidence_deleted_at: deletedAt
  }).in("id", photoIds);
  if (updateError) throw new AppError("SERVER_ERROR", "Không thể đánh dấu ảnh chấm công hết hạn.");
  if (assetIds.length) {
    const { error: deleteError } = await client.from("file_assets").delete().in("id", assetIds);
    if (deleteError) throw new AppError("SERVER_ERROR", "Không thể dọn metadata tệp ảnh hết hạn.");
  }
  return photos.length;
}

export async function purgeExpiredAttendanceEvidence(client: SupabaseClient) {
  const cutoffDate = getBusinessDateKey(new Date(Date.now() - 45 * 86_400_000));
  const personal = await removeExpiredEvidence(client, "attendance_photos", "attendance_events", cutoffDate);
  const worker = await removeExpiredEvidence(client, "worker_attendance_photos", "worker_attendance_sessions", cutoffDate);
  return { attendancePhotosExpired: personal, workerAttendancePhotosExpired: worker, retentionDays: 45 };
}

export async function runDailyMaintenance() {
  const client = getSupabaseServiceClient();
  if (!client) throw new AppError("SERVER_ERROR", "Database chưa được cấu hình.");
  const jobKey = "daily-maintenance", idempotencyKey = getBusinessDateKey();
  const { data, error } = await client.from("operational_job_runs").insert({ job_key: jobKey, idempotency_key: idempotencyKey, status: "running" }).select("id").single();
  if (error?.code === "23505") return { status: "skipped", reason: "already_run", idempotencyKey };
  if (error || !data) throw new AppError("SERVER_ERROR", "Không thể claim maintenance job.");
  const id = String(data.id);
  try {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const attemptCutoff = new Date(Date.now() - 86_400_000).toISOString();
    const [expiredSessions, oldAttempts, expiredIdempotency, failedWebhooks, failedImports, photoRetention] = await Promise.all([
      client.from("app_sessions").delete({ count: "exact" }).lt("expires_at", cutoff),
      client.from("auth_login_attempts").delete({ count: "exact" }).lt("updated_at", attemptCutoff),
      client.from("api_idempotency_records").delete({ count: "exact" }).lt("expires_at", new Date().toISOString()),
      client.from("webhook_deliveries").select("id", { head: true, count: "exact" }).in("status", ["failed", "dead_letter"]),
      client.from("import_jobs").select("id", { head: true, count: "exact" }).eq("status", "failed"),
      purgeExpiredAttendanceEvidence(client)
    ]);
    const result = {
      expiredSessionsRemoved: expiredSessions.count || 0,
      oldLoginWindowsRemoved: oldAttempts.count || 0,
      expiredIdempotencyRemoved: expiredIdempotency.count || 0,
      failedWebhooks: failedWebhooks.count || 0,
      failedImports: failedImports.count || 0,
      ...photoRetention
    };
    await client.from("operational_job_runs").update({ status: "completed", completed_at: new Date().toISOString(), result }).eq("id", id);
    logger.info("operations.daily_maintenance_completed", { entityId: id, metadata: result });
    return { status: "completed", idempotencyKey, ...result };
  } catch (error) {
    await client.from("operational_job_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_code: error instanceof Error ? error.name : "UNKNOWN" }).eq("id", id);
    logger.error("operations.daily_maintenance_failed", { entityId: id });
    throw error;
  }
}
