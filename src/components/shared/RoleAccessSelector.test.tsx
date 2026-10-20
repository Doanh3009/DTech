import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { applicationsForRoles, RoleAccessSelector } from "@/components/shared/RoleAccessSelector";
import { normalizeEmployeeRoleIds, toggleEmployeeRole } from "@/services/authorization/employeeAccessPolicy";
import type { RoleDefinition } from "@/services/authorization/rbacService";

const roles: RoleDefinition[] = [
  { id: "role-hr", code: "hr", name: "Nhân sự", description: "", isSystem: false, permissionKeys: ["employee.view"], userCount: 0 },
  { id: "role-warehouse", code: "warehouse", name: "Kho", description: "", isSystem: false, permissionKeys: ["warehouse.view"], userCount: 0 }
];

describe("RoleAccessSelector", () => {
  it("shows employee as the selectable default business role", () => {
    const employeeRole: RoleDefinition = { id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: ["attendance.self.create"], userCount: 0 };
    const onToggle = vi.fn();
    render(<RoleAccessSelector onToggle={onToggle} roles={[employeeRole, ...roles]} selectedRoleIds={[employeeRole.id]} />);
    expect(screen.getByRole("checkbox", { name: /Nhân viên/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Nhân viên/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Nhân viên/ }));
    expect(onToggle).toHaveBeenCalledWith("role-employee");
  });

  it("does not stack the default employee role on a business role", () => {
    const employeeRole: RoleDefinition = { id: "role-employee", code: "employee", name: "Nhân viên", description: "", isSystem: true, permissionKeys: [], userCount: 0 };
    const availableRoles = [employeeRole, ...roles];
    expect(toggleEmployeeRole([employeeRole.id], "role-hr", availableRoles)).toEqual(["role-hr"]);
    expect(normalizeEmployeeRoleIds([employeeRole.id, "role-hr"], availableRoles)).toEqual(["role-hr"]);
    expect(toggleEmployeeRole(["role-hr"], "role-hr", availableRoles)).toEqual([employeeRole.id]);
  });

  it("unions module access from every selected access group", () => {
    expect(applicationsForRoles(roles, ["role-hr", "role-warehouse"]).map((application) => application.label))
      .toEqual(expect.arrayContaining(["Nhân sự", "Kho"]));
  });

  it("shows the module preview and delegates group selection", () => {
    const onToggle = vi.fn();
    render(<RoleAccessSelector onToggle={onToggle} roles={roles} selectedRoleIds={["role-hr"]} />);
    const preview = screen.getByText("Module được truy cập").closest("section");
    expect(preview).not.toBeNull();
    expect(within(preview!).getByText("Nhân sự")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /Kho/ }));
    expect(onToggle).toHaveBeenCalledWith("role-warehouse");
  });
});
