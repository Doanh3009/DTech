import { Children, isValidElement, type ComponentProps, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeEditForm } from "@/features/employees/components/EmployeeEditForm";
import { defaultEmployeeDataSet } from "@/features/employees/services/employeeService";

const mocks = vi.hoisted(() => ({ user: vi.fn(), dataSet: vi.fn() }));
vi.mock("@/services/auth/getRequestUser", () => ({ getRequestUser: mocks.user }));
vi.mock("@/features/employees/services/employeeRepository", () => ({ getEmployeeDataSetAsync: mocks.dataSet }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); }, useRouter: () => ({}) }));

import Page from "./page";

function fixture() {
  const dataset = structuredClone(defaultEmployeeDataSet);
  const employee = dataset.employees[0];
  const manager = dataset.employees[1];
  employee.managerEmployeeId = manager.id;
  manager.employmentStatus = "terminated";
  manager.profileStatus = "archived";
  for (const item of dataset.departments) item.active = false;
  for (const item of dataset.positions) item.active = false;
  for (const item of dataset.employmentTypes) item.active = false;
  return { dataset, employee, manager };
}

async function formProps(id: string) {
  const page = await Page({ params: Promise.resolve({ id }) });
  const form = Children.toArray(page.props.children).find((child) => isValidElement(child) && child.type === EmployeeEditForm) as ReactElement<ComponentProps<typeof EmployeeEditForm>>;
  expect(form).toBeDefined();
  return form.props;
}

beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ permissions: ["employee.edit", "employee.offboard"] }); });

describe("employee edit page choices", () => {
  it("preserves existing inactive references without offering unrelated inactive choices", async () => {
    const { dataset, employee, manager } = fixture();
    mocks.dataSet.mockResolvedValue(dataset);
    const props = await formProps(employee.id);
    expect(props.departments.map((item) => item.id)).toEqual([employee.departmentId]);
    expect(props.positions.map((item) => item.id)).toEqual([employee.positionId]);
    expect(props.employmentTypes.map((item) => item.id)).toEqual([employee.employmentTypeId]);
    expect(props.managers.some((item) => item.id === manager.id)).toBe(true);
    expect(props.managers.some((item) => item.id === employee.id)).toBe(false);
    expect(props.canOffboard).toBe(true);
  });

  it("passes offboard permission separately from general editing", async () => {
    const { dataset, employee } = fixture();
    mocks.user.mockResolvedValue({ permissions: ["employee.edit"] });
    mocks.dataSet.mockResolvedValue(dataset);
    expect((await formProps(employee.id)).canOffboard).toBe(false);
  });

  it("does not read the employee dataset for an offboard-only or unauthorized viewer", async () => {
    mocks.user.mockResolvedValue({ permissions: ["employee.offboard"] });
    await Page({ params: Promise.resolve({ id: "unread" }) });
    expect(mocks.dataSet).not.toHaveBeenCalled();
  });
});
