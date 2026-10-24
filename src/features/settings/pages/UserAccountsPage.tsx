import { PageHeader } from "@/components/shared/PageHeader";
import { UserAccountsTable } from "@/features/settings/components/UserAccountsTable";
import { CreateUserAccountButton } from "@/features/settings/components/CreateUserAccountButton";
import { AccountRecoveryPanel } from "@/features/settings/components/AccountRecoveryPanel";
import { SettingsShell } from "@/features/settings/components/SettingsShell";
import { getEmployeeDataSetAsync } from "@/features/employees/services/employeeRepository";
import { listAccounts } from "@/features/employees/services/employeeService";
import { PermissionDeniedState } from "@/components/shared/States";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { can } from "@/lib/auth/permissions";
import { listPersistedRoles } from "@/services/authorization/rolePersistenceService";

export async function UserAccountsPage() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "user.view")) return <PermissionDeniedState />;
  const [dataSet, roles] = await Promise.all([getEmployeeDataSetAsync(), listPersistedRoles()]);
  const accounts = listAccounts(dataSet, roles);
  const accountEmployeeIds = new Set(dataSet.accounts.map((account) => account.employeeId).filter(Boolean));
  const employeesWithoutAccount = dataSet.employees
    .filter((employee) => employee.profileStatus !== "archived" && employee.employmentStatus !== "terminated" && !accountEmployeeIds.has(employee.id))
    .sort((first, second) => first.employeeCode.localeCompare(second.employeeCode))
    .map((employee) => ({ id: employee.id, employeeCode: employee.employeeCode, name: employee.fullName }));

  return (
    <SettingsShell activePath="/settings/users">
      <div className="page-stack">
        <PageHeader action={can(user.permissions, "account.create") ? <CreateUserAccountButton employees={employeesWithoutAccount} roles={can(user.permissions, "account.assign_role") ? roles : roles.filter((role) => role.code === "employee")} /> : null} title="Người dùng" />
        <UserAccountsTable accounts={accounts} canDelete={can(user.permissions, "account.delete")} currentAccountId={user.id} />
        {can(user.permissions, "account.create") || can(user.permissions, "account.delete") ? <AccountRecoveryPanel canCreate={can(user.permissions, "account.create")} canDelete={can(user.permissions, "account.delete")} /> : null}
      </div>
    </SettingsShell>
  );
}
