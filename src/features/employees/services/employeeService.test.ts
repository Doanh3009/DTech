import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/api/errors";
import type { Permission } from "@/lib/auth/permissions";
import {
  archiveEmployee,
  buildEmployeeSummary,
  createEmployeeRecord,
  defaultEmployeeDataSet,
  findAccountForEmployee,
  getEmployeeDetail,
  getEmployeeDocuments,
  getEmployeeHistory,
  listEmployees,
  offboardEmployee,
  provisionAccountForEmployee,
  updateAccountRoles,
  updateEmployeeSensitiveProfile,
  updateEmployeeProfile,
  updateAccountStatus
} from "@/features/employees/services/employeeService";
import {
  assertNoAdminLockout,
  assertAdminAccessRemains,
  getEffectivePermissions
} from "@/services/authorization/rbacService";

const basicPermissions: Permission[] = ["employee.view"];
const sensitivePermissions: Permission[] = ["employee.view", "employee.view_sensitive"];

describe("employee domain service", () => {
  it("creates a minimal employee without creating an account", () => {
    const result = createEmployeeRecord(
      {
        employeeCode: "NV999",
        fullName: "Le Thi Thu",
        personalPhone: "0901111999",
        departmentId: defaultEmployeeDataSet.departments[0].id,
        positionId: defaultEmployeeDataSet.positions[0].id,
        employmentTypeId: defaultEmployeeDataSet.employmentTypes[0].id,
        joinDate: "2026-09-10",
        employmentStatus: "active"
      },
      "demo-admin"
    );

    expect(result.employee.employeeCode).toBe("NV999");
    expect(result.employee.profileCompleteness).toBeGreaterThan(50);
    expect(result.historyEvent.eventType).toBe("joined");
    expect(findAccountForEmployee(result.employee.id)).toBeUndefined();
  });

  it("rejects duplicate employee codes", () => {
    expect(() =>
      createEmployeeRecord(
        {
          employeeCode: "NV001",
          fullName: "Tran Van Duplicate",
          personalPhone: "0901111888",
          departmentId: defaultEmployeeDataSet.departments[0].id,
          positionId: defaultEmployeeDataSet.positions[0].id,
          employmentTypeId: defaultEmployeeDataSet.employmentTypes[0].id,
          joinDate: "2026-09-10",
          employmentStatus: "active"
        },
        "demo-admin"
      )
    ).toThrow(AppError);
  });

  it("does not return sensitive fields without employee.view_sensitive", () => {
    const detail = getEmployeeDetail("40000000-0000-4000-8000-000000000001", basicPermissions);

    expect(detail?.sensitive.allowed).toBe(false);
    expect(JSON.stringify(detail)).not.toContain("079092000001");
  });

  it("does not return account data without account.view", () => {
    const detail = getEmployeeDetail("40000000-0000-4000-8000-000000000001", basicPermissions);

    expect(detail?.account).toBeUndefined();
    expect(JSON.stringify(detail)).not.toContain("acct-an");
  });

  it("returns sensitive fields and sensitive documents only with permission", () => {
    const detail = getEmployeeDetail("40000000-0000-4000-8000-000000000001", sensitivePermissions);
    const documentsWithoutPermission = getEmployeeDocuments(
      "40000000-0000-4000-8000-000000000001",
      basicPermissions
    );
    const documentsWithPermission = getEmployeeDocuments(
      "40000000-0000-4000-8000-000000000001",
      sensitivePermissions
    );

    expect(detail?.sensitive.allowed).toBe(true);
    expect(JSON.stringify(detail)).toContain("079092000001");
    expect(documentsWithoutPermission).toHaveLength(0);
    expect(documentsWithPermission.some((document) => document.sensitive)).toBe(true);
  });

  it("searches sensitive identifiers only when permission is present", () => {
    const filters = {
      q: "079092000001",
      page: 1,
      pageSize: 10
    };

    expect(listEmployees(filters, basicPermissions).total).toBe(0);
    expect(listEmployees(filters, sensitivePermissions).total).toBe(1);
  });

  it("supports temporary worker records without accounts", () => {
    const worker = defaultEmployeeDataSet.employees.find((employee) => employee.employeeCode === "CN018");

    expect(worker).toBeDefined();
    expect(worker?.profileStatus).toBe("pending_hr_completion");
    expect(worker ? findAccountForEmployee(worker.id) : undefined).toBeUndefined();
  });

  it("provisions and disables an account without deleting employee history", () => {
    const employee = defaultEmployeeDataSet.employees.find((item) => item.employeeCode === "CN018");
    expect(employee).toBeDefined();

    const provisioned = provisionAccountForEmployee(
      employee!,
      {
        username: "cn018",
        password: "12345678",
        roleIds: ["role-employee"]
      },
      "demo-admin"
    );

    const statusUpdate = updateAccountStatus(
      [...defaultEmployeeDataSet.accounts, provisioned.account],
      provisioned.account.id,
      "disabled",
      "demo-admin",
      "Manual disable"
    );

    expect(provisioned.accountView).not.toHaveProperty("password");
    expect(provisioned.historyEvent.eventType).toBe("account_provisioned");
    expect(statusUpdate.account.status).toBe("disabled");
    expect(getEmployeeHistory(employee!.id).length).toBeGreaterThan(0);
  });

  it("archives and offboards without deleting the employee record", () => {
    const employee = defaultEmployeeDataSet.employees[0];
    const archive = archiveEmployee(employee, "demo-admin", "Record cleanup");
    const offboard = offboardEmployee({
      employee,
      account: findAccountForEmployee(employee.id),
      terminationDate: "2026-09-10",
      reason: "Nghi viec",
      actorAccountId: "demo-admin"
    });

    expect(archive.employee.id).toBe(employee.id);
    expect(archive.employee.profileStatus).toBe("archived");
    expect(offboard.employee.id).toBe(employee.id);
    expect(offboard.employee.employmentStatus).toBe("terminated");
    expect(offboard.account?.status).toBe("disabled");
    expect(buildEmployeeSummary(offboard.employee).employeeCode).toBe(employee.employeeCode);
  });

  it("rejects duplicate employee codes and manager cycles when editing", () => {
    const first = defaultEmployeeDataSet.employees[0];
    const second = { ...defaultEmployeeDataSet.employees[1], managerEmployeeId: first.id };
    const dataSet = {
      ...defaultEmployeeDataSet,
      employees: [first, second, ...defaultEmployeeDataSet.employees.slice(2)]
    };

    expect(() =>
      updateEmployeeProfile(first, { employeeCode: second.employeeCode }, "demo-admin", dataSet)
    ).toThrow(AppError);
    expect(() =>
      updateEmployeeProfile(first, { managerEmployeeId: second.id }, "demo-admin", dataSet)
    ).toThrow(AppError);
  });

  it("rejects a CCCD already linked to another employee", () => {
    const employee = defaultEmployeeDataSet.employees[1];
    const existingNumber = defaultEmployeeDataSet.sensitiveProfiles[0].nationalIdNumber;

    expect(() =>
      updateEmployeeSensitiveProfile(
        employee,
        undefined,
        { nationalIdNumber: existingNumber, reason: "Đối chiếu hồ sơ" },
        "demo-admin"
      )
    ).toThrow(AppError);
  });
});

describe("rbac foundation", () => {
  it("unions permissions across multiple roles", () => {
    const permissions = getEffectivePermissions(["role-supervisor", "role-employee"]);

    expect(permissions).toContain("worker_attendance.view");
    expect(permissions).toContain("leave.view");
  });

  it("prevents disabling the last account with admin management permissions", () => {
    expect(() =>
      assertNoAdminLockout({
        accounts: [
          {
            accountId: "demo-admin",
            status: "active",
            roleIds: ["role-admin"]
          }
        ],
        targetAccountId: "demo-admin",
        nextStatus: "disabled"
      })
    ).toThrow(AppError);
  });

  it("updates multiple roles and keeps the last administrator protected", () => {
    const updated = updateAccountRoles(
      defaultEmployeeDataSet.accounts,
      "acct-an",
      ["role-employee", "role-supervisor"]
    );
    expect(updated.account.roleIds).toEqual(["role-employee", "role-supervisor"]);

    expect(() =>
      updateAccountRoles(defaultEmployeeDataSet.accounts, "demo-admin", ["role-employee"])
    ).toThrow(AppError);
  });

  it("prevents removing admin permissions from the last admin-capable role", () => {
    expect(() =>
      assertAdminAccessRemains({
        accounts: [{ accountId: "demo-admin", status: "active", roleIds: ["role-admin"] }],
        roles: []
      })
    ).toThrow(AppError);
  });
});
