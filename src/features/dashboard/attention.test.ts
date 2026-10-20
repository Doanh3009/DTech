import { describe, expect, it } from "vitest";

import { normalizeAttention } from "@/features/dashboard/attention";

describe("dashboard attention", () => {
  it("sorts critical items first and combines alerts for one entity", () => {
    const result = normalizeAttention([
      { id: "a", type: "shipment", title: "SHP-001", context: "Thiếu C/O", priority: "MEDIUM", href: "/shipments/1" },
      { id: "b", type: "shipment", title: "SHP-001", context: "Vướng thông quan", priority: "CRITICAL", href: "/shipments/1" },
      { id: "c", type: "project", title: "Dự án A", priority: "HIGH", href: "/projects/1" }
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ href: "/shipments/1", priority: "CRITICAL" });
    expect(result[0].title).toContain("2 vấn đề");
  });
});
