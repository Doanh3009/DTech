import { describe, expect, it } from "vitest";

import { sortPendingAttendance } from "@/features/attendance/client/attendanceQueue";
import type { PendingAttendanceItem } from "@/features/attendance/types/attendanceTypes";

function pending(clientEventId: string, createdAt: string): PendingAttendanceItem {
  return {
    clientEventId, createdAt, capturedAtClient: createdAt, capturedOffline: true, ownerAccountId: "account-1",
    intendedType: "check_in", deviceMetadata: {}, photo: new Blob(), thumbnail: new Blob(), photoWidth: 1,
    photoHeight: 1, retryCount: 0, syncState: "local_pending"
  };
}

describe("attendance queue order", () => {
  it("keeps offline operations in capture order", () => {
    const result = sortPendingAttendance([
      pending("b", "2026-09-14T08:01:00.000Z"),
      pending("c", "2026-09-14T08:00:00.000Z"),
      pending("a", "2026-09-14T08:00:00.000Z")
    ]);
    expect(result.map((item) => item.clientEventId)).toEqual(["a", "c", "b"]);
  });
});
