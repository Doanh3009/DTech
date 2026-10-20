import { describe, expect, it } from "vitest";

import { withAttendanceSyncLock } from "@/features/attendance/client/attendanceSyncLock";

describe("attendance sync lock", () => {
  it("serializes queue work for the same account", async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = withAttendanceSyncLock("account-1", async () => {
      order.push("first-start");
      await firstGate;
      order.push("first-end");
    });
    const second = withAttendanceSyncLock("account-1", async () => { order.push("second"); });
    await Promise.resolve();
    expect(order).toEqual(["first-start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });
});
