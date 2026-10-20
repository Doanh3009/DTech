import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SystemAdminShell } from "@/features/system-admin/components/SystemAdminShell";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { can, isAccountEnabled } from "@/lib/auth/permissions";

export default async function SystemAdminLayout({ children }: { children: ReactNode }) {
  const user = await getRequestUser();
  if (!user || !isAccountEnabled(user) || !can(user.permissions, "system_admin.access")) redirect("/dashboard");
  return <SystemAdminShell permissions={user.permissions}>{children}</SystemAdminShell>;
}
