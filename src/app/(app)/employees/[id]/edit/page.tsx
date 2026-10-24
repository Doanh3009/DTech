import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";
import { PermissionDeniedState } from "@/components/shared/States";
import { EmployeeEditForm } from "@/features/employees/components/EmployeeEditForm";
import {
  findEmployee,
  buildEmployeeSummary,
  getEmployeePickerOptions
} from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "employee.edit")) {
    return <PermissionDeniedState />;
  }

  const { id } = await params;
  const dataSet = await getEmployeeDataSetAsync();
  const employee = findEmployee(id, dataSet);
  if (!employee) notFound();
  const managers = getEmployeePickerOptions(dataSet, { activeOnly: true }).filter((item) => item.id !== id);
  const currentManager = employee.managerEmployeeId ? findEmployee(employee.managerEmployeeId, dataSet) : undefined;
  if (currentManager && !managers.some((item) => item.id === currentManager.id)) {
    managers.push(buildEmployeeSummary(currentManager, dataSet));
  }

  return (
    <div className="page-stack">
      <BackLink href={`/employees/${id}`} />
      <PageHeader title={`Chỉnh sửa ${employee.fullName}`} />
      <EmployeeEditForm
        canOffboard={can(user.permissions, "employee.offboard")}
        departments={dataSet.departments.filter((item) => item.active || item.id === employee.departmentId)}
        employee={employee}
        employmentTypes={dataSet.employmentTypes.filter((item) => item.active || item.id === employee.employmentTypeId)}
        managers={managers}
        positions={dataSet.positions.filter((item) => item.active || item.id === employee.positionId)}
      />
    </div>
  );
}
