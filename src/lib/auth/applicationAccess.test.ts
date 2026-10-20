import { describe, expect, it } from "vitest";

import { canOpenPersonalAttendance, canSubmitPersonalAttendance } from "./applicationAccess";

describe("personal attendance access", () => {
  it("allows the personal action but not HR attendance management alone", () => {
    expect(canOpenPersonalAttendance(["attendance.self.view"])).toBe(true);
    expect(canOpenPersonalAttendance(["attendance.self.create"])).toBe(true);
    expect(canOpenPersonalAttendance(["attendance.view_all"])).toBe(false);
    expect(canOpenPersonalAttendance(["attendance.self_history"])).toBe(false);
    expect(canSubmitPersonalAttendance(["attendance.self.view"])).toBe(false);
    expect(canSubmitPersonalAttendance(["attendance.self.create"])).toBe(true);
  });
});
