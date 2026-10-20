import { describe, expect, it } from "vitest";

import { attendanceAdjustmentRequestSchema, attendanceAdjustmentReviewSchema } from "./adjustmentRequestSchemas";

describe("attendance adjustment request validation", () => {
  const request = { attendanceDate: "2026-09-16", requestType: "missing_check_out", requestedTime: "17:30", reason: "Quên chấm công khi rời công ty" };

  it("accepts a valid missing checkout request", () => {
    expect(attendanceAdjustmentRequestSchema.safeParse(request).success).toBe(true);
  });

  it("rejects an impossible date and time", () => {
    expect(attendanceAdjustmentRequestSchema.safeParse({ ...request, attendanceDate: "2026-02-30" }).success).toBe(false);
    expect(attendanceAdjustmentRequestSchema.safeParse({ ...request, requestedTime: "25:00" }).success).toBe(false);
  });

  it("requires a reason and a review decision", () => {
    expect(attendanceAdjustmentRequestSchema.safeParse({ ...request, reason: "" }).success).toBe(false);
    expect(attendanceAdjustmentReviewSchema.safeParse({ approve: true }).success).toBe(true);
    expect(attendanceAdjustmentReviewSchema.safeParse({ approve: "yes" }).success).toBe(false);
    expect(attendanceAdjustmentReviewSchema.safeParse({ approve: false, note: "" }).success).toBe(false);
  });
});
