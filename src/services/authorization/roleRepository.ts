import "server-only";

import { AppError } from "@/lib/api/errors";
import type { RoleDefinition, RoleInput, AccountRoleState } from "@/services/authorization/rbacService";
import {
  createRoleDefinition,
  assertAdminAccessRemains,
  getRoleCatalog,
  roleCatalog,
  updateRoleDefinition
} from "@/services/authorization/rbacService";

let roles: RoleDefinition[] = [...roleCatalog];

export function getRolesFromRepository(accounts: readonly AccountRoleState[] = []): RoleDefinition[] {
  const userCountByRoleId = new Map<string, number>();

  for (const account of accounts) {
    for (const roleId of account.roleIds) {
      userCountByRoleId.set(roleId, (userCountByRoleId.get(roleId) ?? 0) + 1);
    }
  }

  return roles.map((role) => ({
    ...role,
    userCount: userCountByRoleId.get(role.id) ?? 0
  }));
}

export function createRoleInRepository(input: RoleInput): RoleDefinition {
  const role = createRoleDefinition(input, roles);
  roles = [...roles, role];

  return role;
}

export function updateRoleInRepository(
  roleId: string,
  input: Partial<RoleInput>,
  accounts: readonly AccountRoleState[] = []
): RoleDefinition {
  const role = roles.find((item) => item.id === roleId);
  if (!role) {
    throw new AppError("NOT_FOUND", "Không tìm thấy vai trò.");
  }

  const updatedRole = updateRoleDefinition(role, input);
  if (accounts.length > 0) {
    assertAdminAccessRemains({
      accounts,
      roles: roles.map((item) => (item.id === roleId ? updatedRole : item))
    });
  }
  roles = roles.map((item) => (item.id === roleId ? updatedRole : item));

  return updatedRole;
}

export function resetRoleRepositoryForTests(): void {
  roles = getRoleCatalog();
}
