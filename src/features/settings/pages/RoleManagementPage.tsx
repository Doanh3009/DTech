import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { RoleTable } from "@/features/settings/components/RoleTable";
import { SettingsShell } from "@/features/settings/components/SettingsShell";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { getPermissionGroups } from "@/services/authorization/rbacService";
import { listPersistedPermissionKeys, listPersistedRoles } from "@/services/authorization/rolePersistenceService";

export async function RoleManagementPage() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "role.view")) return <PermissionDeniedState />;
  const [roles, persistedPermissionKeys] = await Promise.all([
    listPersistedRoles(),
    listPersistedPermissionKeys()
  ]);
  const permissionGroups = getPermissionGroups()
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => persistedPermissionKeys.has(permission.key))
    }))
    .filter((group) => group.permissions.length > 0);

  return (
    <SettingsShell activePath="/settings/roles">
      <div className="page-stack">
        <PageHeader title="Nhóm quyền truy cập" />
        <RoleTable canManage={can(user.permissions, "role.manage")} permissionGroups={permissionGroups} roles={roles} />
      </div>
    </SettingsShell>
  );
}
