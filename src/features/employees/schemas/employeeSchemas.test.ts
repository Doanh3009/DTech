import { describe, expect, it } from "vitest";

import { createEmployeeSchema, patchEmployeeSchema, provisionAccountSchema } from "@/features/employees/schemas/employeeSchemas";

const minimalEmployee = {
  employeeCode: "NV-001",
  fullName: "Nguyễn Văn An",
  departmentId: "11111111-1111-4111-8111-111111111111",
  positionId: "22222222-2222-4222-8222-222222222222",
  employmentTypeId: "33333333-3333-4333-8333-333333333333",
  employmentStatus: "active"
};

describe("employee schemas", () => {
  it("accepts a minimal employee without exposing joinDate on the form", () => {
    expect(createEmployeeSchema.parse(minimalEmployee).joinDate).toBeUndefined();
  });
  it.each(["2026-02-30", "2025-02-29", "2026-13-01"])("rejects an impossible calendar date %s", (dateOfBirth) => {
    expect(createEmployeeSchema.safeParse({ ...minimalEmployee, dateOfBirth }).success).toBe(false);
  });
  it("accepts a real leap day", () => {
    expect(createEmployeeSchema.parse({ ...minimalEmployee, dateOfBirth: "2024-02-29" }).dateOfBirth).toBe("2024-02-29");
  });

  it("rejects a DB role identifier that is not a UUID", () => {
    const result = provisionAccountSchema.safeParse({
      requestId: "10000000-0000-4000-8000-000000000001",
      username: "nv001",
      password: "12345678",
      roleIds: ["role-employee"]
    });
    expect(result.success).toBe(false);
  });

  it("accepts account provisioning without an admin-supplied password", () => {
    const result = provisionAccountSchema.safeParse({
      requestId: "10000000-0000-4000-8000-000000000001",
      username: "nv001",
      roleIds: ["11111111-1111-4111-8111-111111111111"]
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBeUndefined();
  });
});

describe("employee profile patch contract", () => {
  it.each([undefined, null, 0, -1, 1.5, "1", 2147483647, Number.NaN])("requires a bounded integer rowVersion (%s)", (rowVersion) => {
    expect(patchEmployeeSchema.safeParse({ rowVersion, fullName: "Nguyễn Văn An" }).success).toBe(false);
  });

  it("accepts both supported version bounds", () => {
    for (const rowVersion of [1, 2147483646]) expect(patchEmployeeSchema.safeParse({ rowVersion, fullName: "Nguyễn Văn An" }).success).toBe(true);
  });

  it.each([{ rowVersion: 1 }, { rowVersion: 1, reason: "Chỉnh sửa" }, { rowVersion: 1, note: undefined }])("rejects a command without changed profile fields", (input) => {
    expect(patchEmployeeSchema.safeParse(input).success).toBe(false);
  });

  it.each(["nationalIdNumber", "personalTaxCode", "emergencyContactName", "profileStatus", "normalizedPhone", "requestId"])("rejects unsupported profile key %s", (key) => {
    expect(patchEmployeeSchema.safeParse({ rowVersion: 1, fullName: "Nguyễn Văn An", [key]: "unsupported" }).success).toBe(false);
  });

  it("preserves explicit clears and omits fields that were not supplied", () => {
    const input = patchEmployeeSchema.parse({ rowVersion: 1, displayName: null, personalEmail: "  ", managerEmployeeId: null, dateOfBirth: null, personalPhone: null });
    expect(input).toEqual({ rowVersion: 1, displayName: null, personalEmail: null, managerEmployeeId: null, dateOfBirth: null, personalPhone: null });
    expect(input).not.toHaveProperty("note");
  });

  it.each(["employeeCode", "fullName", "departmentId", "positionId", "employmentTypeId", "joinDate", "employmentStatus"])("cannot clear required field %s", (key) => {
    expect(patchEmployeeSchema.safeParse({ rowVersion: 1, [key]: null }).success).toBe(false);
  });

  it.each([
    { employmentStatus: "terminated" },
    { employmentStatus: "terminated", terminationDate: "2026-10-22" },
    { employmentStatus: "terminated", terminationReason: "Nghỉ việc" },
    { employmentStatus: "terminated", terminationDate: "2026-10-22", terminationReason: "ab" },
    { terminationDate: "2026-02-30" },
    { terminationReason: "a".repeat(501) }
  ])("rejects incomplete or invalid termination inputs", (input) => {
    expect(patchEmployeeSchema.safeParse({ rowVersion: 1, ...input }).success).toBe(false);
  });

  it("accepts a complete lifecycle command and trimmed reasons", () => {
    const input = patchEmployeeSchema.parse({ rowVersion: 1, employmentStatus: "terminated", terminationDate: "2026-10-22", terminationReason: " Nghỉ theo nguyện vọng " });
    expect(input.terminationReason).toBe("Nghỉ theo nguyện vọng");
  });

  it.each([
    { joinDate: "2026-10-22", terminationDate: "2026-10-21" },
    { joinDate: "2026-10-22", officialDate: "2026-10-21" },
    { probationStartDate: "2026-10-22", probationEndDate: "2026-10-21" }
  ])("rejects invalid date order when both fields are supplied", (input) => {
    expect(patchEmployeeSchema.safeParse({ rowVersion: 1, ...input }).success).toBe(false);
  });
});
