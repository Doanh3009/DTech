import { describe, expect, it } from "vitest";

import { globalSearchCore } from "@/features/search/services/globalSearchCore";
import type { SearchProvider } from "@/features/search/types";
import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";

function user(permissions: Permission[]): AuthenticatedUser {
  return { id: "test", displayName: "Test", username: "test", email: "test@example.com", status: "active", permissions };
}

const employeeProvider: SearchProvider = {
  key: "employee",
  entityTypes: ["employee"],
  requiredAny: ["employee.view"],
  search: async () => [{ entityType: "employee", entityId: "1", title: "Nguyễn Văn A", reference: "NV001", icon: "user", deepLink: "/employees/1/profile", score: 0 }]
};

const shipmentProvider: SearchProvider = {
  key: "shipment",
  entityTypes: ["shipment"],
  requiredAny: ["shipment.view"],
  search: async () => [{ entityType: "shipment", entityId: "2", title: "SHP-001", icon: "ship", deepLink: "/import-export/shipments/2/overview", score: 0 }]
};

describe("GlobalSearchService", () => {
  it("does not invoke or expose providers without backend permission", async () => {
    const response = await globalSearchCore(user(["employee.view"]), { query: "NV001" }, [employeeProvider, shipmentProvider]);
    expect(response.results.map((item) => item.entityType)).toEqual(["employee"]);
  });

  it("returns partial results when one provider fails", async () => {
    const failed: SearchProvider = { ...shipmentProvider, search: async () => { throw new Error("offline"); } };
    const response = await globalSearchCore(user(["employee.view", "shipment.view"]), { query: "NV001" }, [employeeProvider, failed]);
    expect(response.results).toHaveLength(1);
    expect(response.unavailableTypes).toContain("shipment");
  });

  it("rejects broad one-character searches", async () => {
    await expect(globalSearchCore(user(["employee.view"]), { query: "N" }, [employeeProvider])).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
