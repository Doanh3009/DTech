import { describe, expect, it } from "vitest";

import { createEmployeeSchema, provisionAccountSchema } from "@/features/employees/schemas/employeeSchemas";

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

  it("rejects a DB role identifier that is not a UUID", () => {
    const result = provisionAccountSchema.safeParse({
      username: "nv001",
      password: "12345678",
      roleIds: ["role-employee"]
    });
    expect(result.success).toBe(false);
  });

  it("accepts account provisioning without an admin-supplied password", () => {
    const result = provisionAccountSchema.safeParse({
      username: "nv001",
      roleIds: ["11111111-1111-4111-8111-111111111111"]
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.password).toBeUndefined();
  });
});
