import { describe, expect, it } from "vitest";

import { formatCalendarDate, parseCalendarDate } from "@/features/timesheets/components/CalendarSettings";

describe("CalendarSettings date format", () => {
  it("uses the Vietnamese day/month/year format", () => {
    expect(formatCalendarDate("2026-04-30")).toBe("30/04/2026");
    expect(parseCalendarDate("30/04/2026")).toBe("2026-04-30");
  });

  it("rejects invalid calendar dates", () => {
    expect(parseCalendarDate("31/02/2026")).toBeUndefined();
    expect(parseCalendarDate("04/30/2026")).toBeUndefined();
  });
});
