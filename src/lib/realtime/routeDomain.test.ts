import { describe, expect, it } from "vitest";

import { realtimeDomainForPath } from "@/lib/realtime/routeDomain";

describe("realtime route domains", () => {
  it("maps specific prefixes before broader module paths", () => {
    expect(realtimeDomainForPath("/project-monitoring/issues")).toBe("projects");
    expect(realtimeDomainForPath("/worker-attendance/today")).toBe("worker-attendance");
    expect(realtimeDomainForPath("/warehouse/inventory")).toBe("warehouse");
  });

  it("does not refresh unrelated public routes", () => {
    expect(realtimeDomainForPath("/login")).toBeUndefined();
  });
});
