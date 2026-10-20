import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";
import { PermissionDeniedState } from "@/components/shared/States";
import { EmployeeEditForm } from "@/features/employees/components/EmployeeEditForm";
import {
  findEmployee,
  getEmployeeFilterOptions,
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
  const options = getEmployeeFilterOptions(dataSet);

  return (
    <div className="page-stack">
      <BackLink href={`/employees/${id}`} />
      <PageHeader title={`Chỉnh sửa ${employee.fullName}`} />
      <EmployeeEditForm
        departments={options.departments}
        employee={employee}
        employmentTypes={options.employmentTypes}
        managers={getEmployeePickerOptions(dataSet, { activeOnly: true }).filter((item) => item.id !== id)}
        positions={options.positions}
      />
    </div>
  );
}
