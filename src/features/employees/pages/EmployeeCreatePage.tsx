import { PageHeader } from "@/components/shared/PageHeader";
import { FormPageLayout } from "@/components/shared/PageLayouts";
import { BackLink } from "@/components/shared/BackLink";
import { PermissionDeniedState } from "@/components/shared/States";
import { can } from "@/lib/auth/permissions";
import { EmployeeCreateForm } from "@/features/employees/components/EmployeeCreateForm";
import {
  getEmployeeFilterOptions,
  getEmployeePickerOptions
} from "@/features/employees/services/employeeService";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { getRequestUser } from "@/services/auth/getRequestUser";

export async function EmployeeCreatePage() {
  const user = await getRequestUser();

  if (!user || !can(user.permissions, "employee.create")) {
    return <PermissionDeniedState />;
  }

  const dataSet = await getEmployeeDataSetAsync();
  const filterOptions = getEmployeeFilterOptions(dataSet);

  return (
    <FormPageLayout>
      <BackLink href="/employees" />
      <PageHeader
        title="Tạo hồ sơ nhân viên"
      />
      <EmployeeCreateForm
        departments={filterOptions.departments}
        employmentTypes={filterOptions.employmentTypes}
        managers={getEmployeePickerOptions(dataSet, { activeOnly: true })}
        positions={filterOptions.positions}
      />
    </FormPageLayout>
  );
}
