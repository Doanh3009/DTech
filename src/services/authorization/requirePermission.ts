import type { AuthenticatedUser, Permission } from "@/lib/auth/permissions";
import { can, isAccountEnabled } from "@/lib/auth/permissions";
import { AppError } from "@/lib/api/errors";

export function requireAuthenticatedUser(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) {
    throw new AppError("AUTHENTICATION_REQUIRED");
  }

  if (!isAccountEnabled(user)) {
    throw new AppError("PERMISSION_DENIED", "Tài khoản đã bị vô hiệu hóa.");
  }

  return user;
}

export function requirePermission(
  user: AuthenticatedUser | null,
  permission: Permission
): AuthenticatedUser {
  const authenticatedUser = requireAuthenticatedUser(user);
  if (!can(authenticatedUser.permissions, permission)) {
    throw new AppError("PERMISSION_DENIED");
  }

  return authenticatedUser;
}
