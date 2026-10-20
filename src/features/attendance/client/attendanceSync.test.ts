import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AttendanceRecordResult, PendingAttendanceItem } from "@/features/attendance/types/attendanceTypes";

const queue = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn() }));
vi.mock("@/features/attendance/client/attendanceQueue", () => ({
  savePendingAttendance: queue.save,
  removePendingAttendance: queue.remove
}));

import { AttendanceSyncError, syncAttendanceItem } from "@/features/attendance/client/attendanceSync";

const item: PendingAttendanceItem = {
  clientEventId: "10000000-0000-4000-8000-000000000001",
  ownerAccountId: "account-1",
  intendedType: "check_in",
  capturedAtClient: "2026-09-14T01:00:00.000Z",
  capturedOffline: true,
  deviceMetadata: { appVersion: "test" },
  photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
  thumbnail: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
  photoWidth: 10,
  photoHeight: 10,
  createdAt: "2026-09-14T01:00:00.000Z",
  retryCount: 0,
  syncState: "local_pending"
};

function result(replay = false): AttendanceRecordResult {
  return {
    idempotentReplay: replay,
    event: {
      id: "20000000-0000-4000-8000-000000000001",
      clientEventId: item.clientEventId,
      employeeId: "employee-1",
      eventType: "check_in",
      attendanceDate: "2026-09-14",
      effectiveAt: item.capturedAtClient,
      capturedAtClient: item.capturedAtClient,
      receivedAtServer: item.capturedAtClient,
      geofenceStatus: "valid",
      attendanceStatus: "recorded",
      photoStatus: "uploaded",
      syncStatus: "synced",
      anomalyFlags: []
    }
  };
}

function response(data?: AttendanceRecordResult, code?: string): Response {
  return new Response(JSON.stringify(data ? { ok: true, data } : { ok: false, error: { code, message: "Phiên đã hết hạn." } }), {
    status: data ? 200 : 401,
    headers: { "content-type": "application/json" }
  });
}

describe("attendance offline synchronization", () => {
  beforeEach(() => {
    queue.save.mockReset().mockResolvedValue(undefined);
    queue.remove.mockReset().mockResolvedValue(undefined);
    vi.restoreAllMocks();
  });

  it("removes the local operation only after event and photo are confirmed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(result())).mockResolvedValueOnce(response(result()));
    await expect(syncAttendanceItem(item)).resolves.toEqual(result());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(queue.remove).toHaveBeenCalledWith(item.clientEventId);
  });

  it("retries the same operation id after a lost response", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("network lost"));
    await expect(syncAttendanceItem(item)).rejects.toThrow("network lost");
    expect(queue.remove).not.toHaveBeenCalled();
    const failed = queue.save.mock.calls.at(-1)?.[0] as PendingAttendanceItem;
    expect(failed.clientEventId).toBe(item.clientEventId);
    expect(failed.syncState).toBe("sync_failed");

    vi.restoreAllMocks();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(result(true))).mockResolvedValueOnce(response(result(true)));
    await syncAttendanceItem(failed);
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { clientEventId: string };
    expect(sent.clientEventId).toBe(item.clientEventId);
    expect(queue.remove).toHaveBeenCalledWith(item.clientEventId);
  });

  it("retains the queue when the session expires", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(undefined, "SESSION_EXPIRED"));
    await expect(syncAttendanceItem(item)).rejects.toEqual(expect.objectContaining<Partial<AttendanceSyncError>>({ category: "SESSION_EXPIRED" }));
    expect(queue.remove).not.toHaveBeenCalled();
    expect(queue.save.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ clientEventId: item.clientEventId, syncState: "sync_failed", lastErrorCategory: "SESSION_EXPIRED" }));
  });
});
