"use client";

import { removePendingAttendance, savePendingAttendance } from "./attendanceQueue";
import { retryDelayMilliseconds } from "@/features/attendance/services/attendanceRules";
import type { AttendanceRecordResult, PendingAttendanceItem } from "@/features/attendance/types/attendanceTypes";
import { withAttendanceSyncLock } from "@/features/attendance/client/attendanceSyncLock";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export class AttendanceSyncError extends Error {
  constructor(readonly category: string, message: string) {
    super(message);
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as ApiResponse<T>;
  if (!response.ok || !body.ok || !body.data) {
    throw new AttendanceSyncError(body.error?.code ?? "NETWORK", body.error?.message ?? "Chưa thể đồng bộ.");
  }
  return body.data;
}

async function syncAttendanceItemUnlocked(item: PendingAttendanceItem): Promise<AttendanceRecordResult> {
  const syncing: PendingAttendanceItem = { ...item, syncState: "syncing" };
  let serverEventId = syncing.serverEventId;
  await savePendingAttendance(syncing);

  try {
    let eventId = serverEventId;
    let result: AttendanceRecordResult;
    if (!eventId) {
      const response = await fetch("/api/v1/attendance/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          clientEventId: syncing.clientEventId,
          intendedType: syncing.intendedType,
          capturedAtClient: syncing.capturedAtClient,
          capturedOffline: syncing.capturedOffline,
          location: syncing.location,
          deviceMetadata: syncing.deviceMetadata
        })
      });
      result = await readResponse<AttendanceRecordResult>(response);
      eventId = result.event.id;
      serverEventId = eventId;
      await savePendingAttendance({ ...syncing, serverEventId: eventId });
    } else {
      result = {
        idempotentReplay: true,
        event: {
          id: eventId,
          clientEventId: syncing.clientEventId,
          employeeId: "",
          eventType: syncing.intendedType,
          attendanceDate: syncing.capturedAtClient.slice(0, 10),
          effectiveAt: syncing.capturedAtClient,
          capturedAtClient: syncing.capturedAtClient,
          receivedAtServer: syncing.capturedAtClient,
          geofenceStatus: "valid",
          attendanceStatus: "recorded",
          photoStatus: "pending_upload",
          syncStatus: "syncing",
          anomalyFlags: []
        }
      };
    }

    const formData = new FormData();
    formData.set("photo", syncing.photo, "attendance.jpg");
    formData.set("thumbnail", syncing.thumbnail, "attendance-thumbnail.jpg");
    formData.set("width", String(syncing.photoWidth));
    formData.set("height", String(syncing.photoHeight));
    formData.set("capturedAt", syncing.capturedAtClient);
    const photoResponse = await fetch(`/api/v1/attendance/events/${eventId}/photo`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(25_000)
    });
    const uploaded = await readResponse<AttendanceRecordResult>(photoResponse);
    await removePendingAttendance(syncing.clientEventId);
    return uploaded;
  } catch (error) {
    const retryCount = syncing.retryCount + 1;
    const category = error instanceof AttendanceSyncError ? error.category : "NETWORK";
    await savePendingAttendance({
      ...syncing,
      // navigator.onLine can be true with an unreachable mobile data connection.
      // Preserve the capture's offline provenance for a later retry.
      capturedOffline: syncing.capturedOffline || category === "NETWORK",
      serverEventId,
      retryCount,
      syncState: "sync_failed",
      lastErrorCategory: category,
      nextRetryAt: new Date(Date.now() + retryDelayMilliseconds(retryCount)).toISOString()
    });
    throw error;
  }
}

export function syncAttendanceItem(item: PendingAttendanceItem): Promise<AttendanceRecordResult> {
  return withAttendanceSyncLock(item.ownerAccountId, () => syncAttendanceItemUnlocked(item));
}
