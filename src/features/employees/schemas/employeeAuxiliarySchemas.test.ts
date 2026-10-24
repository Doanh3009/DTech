import { describe, expect, it } from "vitest";
import { archiveEmployeeSchema, sensitiveProfilePatchSchema } from "./employeeSchemas";

const sensitive = { rowVersion: 4, bankName: "Ngân hàng", reason: "Điều chỉnh hồ sơ" };

describe("employee auxiliary command schemas", () => {
  it("preserves omitted fields and accepts explicit null clears", () => {
    const result = sensitiveProfilePatchSchema.parse({ ...sensitive, bankName: null });
    expect(result.bankName).toBeNull();
    expect(result).not.toHaveProperty("nationalIdNumber");
  });

  it("normalizes blank nullable form fields to explicit clears", () => {
    expect(sensitiveProfilePatchSchema.parse({ ...sensitive, bankName: " \t " }).bankName).toBeNull();
  });

  it.each([undefined, null, "4", 0, -1, 1.5, 2147483647])("rejects invalid sensitive versions %s", (rowVersion) => {
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, rowVersion }).success).toBe(false);
  });

  it.each([undefined, null, "", " \t ", "ab", "x".repeat(501)])("requires a valid reason for every sensitive correction", (reason) => {
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, reason }).success).toBe(false);
  });

  it.each(["employeeId", "updatedBy", "nationalIdFrontFileId", "profileStatus", "fullName", "requestId"])("rejects unsupported sensitive key %s", (key) => {
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, [key]: "value" }).success).toBe(false);
  });

  it("rejects an empty data patch", () => {
    expect(sensitiveProfilePatchSchema.safeParse({ rowVersion: 4, reason: "Điều chỉnh" }).success).toBe(false);
  });

  it.each(["12345678", "1234567890123", "12345ABCD"])("validates the identity number %s", (nationalIdNumber) => {
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, nationalIdNumber }).success).toBe(false);
  });

  it.each(["2026-02-30", "2025-02-29", "infinity", "2026/01/01"])("rejects invalid calendar dates %s", (nationalIdIssuedDate) => {
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, nationalIdIssuedDate }).success).toBe(false);
  });

  it("validates provided date ordering and bounds text lengths", () => {
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, nationalIdIssuedDate: "2026-10-22", nationalIdExpiryDate: "2026-10-21" }).success).toBe(false);
    expect(sensitiveProfilePatchSchema.safeParse({ ...sensitive, bankName: "x".repeat(201) }).success).toBe(false);
  });

  it("requires an exact archive contract", () => {
    expect(archiveEmployeeSchema.parse({ rowVersion: 4, reason: " Lưu hồ sơ " })).toEqual({ rowVersion: 4, reason: "Lưu hồ sơ" });
    expect(archiveEmployeeSchema.safeParse({ reason: "Lưu hồ sơ" }).success).toBe(false);
    expect(archiveEmployeeSchema.safeParse({ rowVersion: "4", reason: "Lưu hồ sơ" }).success).toBe(false);
    expect(archiveEmployeeSchema.safeParse({ rowVersion: 4, reason: "Lưu hồ sơ", employmentStatus: "terminated" }).success).toBe(false);
  });
});
