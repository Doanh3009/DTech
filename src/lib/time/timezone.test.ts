import { describe, expect, it } from "vitest";

import { getBusinessDateKey } from "@/lib/time/timezone";

describe("getBusinessDateKey", () => {
  it("advances to the Vietnamese business date at midnight", () => {
    expect(getBusinessDateKey("2026-09-23T17:00:00.000Z")).toBe("2026-09-24");
  });

  it("keeps the Vietnamese business date between midnight and 06:59", () => {
    expect(getBusinessDateKey("2026-09-23T23:59:59.000Z")).toBe("2026-09-24");
  });

  it("does not advance before Vietnamese midnight", () => {
    expect(getBusinessDateKey("2026-09-23T16:59:59.999Z")).toBe("2026-09-23");
  });

  it("rejects invalid values", () => {
    expect(() => getBusinessDateKey("not-a-date")).toThrow(RangeError);
  });
});
