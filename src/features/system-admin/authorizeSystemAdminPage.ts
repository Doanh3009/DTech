import { redirect } from "next/navigation";

import { can, isAccountEnabled, type Permission } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export async function authorizeSystemAdminPage(permission: Permission): Promise<void> {
  const user = await getRequestUser();
  if (
    !user ||
    !isAccountEnabled(user) ||
    !can(user.permissions, "system_admin.access") ||
    !can(user.permissions, permission)
  ) {
    redirect("/dashboard");
  }
}
