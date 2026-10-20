import { describe, expect, it } from "vitest";

import { getLocalAuditLogs, recordAuditLog } from "@/services/audit/auditLog";

describe("audit log", () => {
  it("redacts sensitive values before retaining an entry", async () => {
    await recordAuditLog({
      actorId: "demo-admin",
      action: "employee.sensitive_updated",
      entityType: "employee",
      entityId: "employee-1",
      before: { nationalIdNumber: "012345678901", bankAccountNumber: "123456789" },
      after: { nationalIdNumber: "109876543210", bankAccountNumber: "987654321" }
    });

    const entry = getLocalAuditLogs()[0];
    expect(entry.before).toEqual({ nationalIdNumber: "[REDACTED]", bankAccountNumber: "[REDACTED]" });
    expect(JSON.stringify(entry)).not.toContain("012345678901");
  });
});
