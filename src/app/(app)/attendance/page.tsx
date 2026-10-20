import { redirect } from "next/navigation";

import { PermissionDeniedState } from "@/components/shared/States";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  if (!user) return <PermissionDeniedState />;

  if (
    can(user.permissions, "attendance.self") ||
    can(user.permissions, "attendance.self.view") ||
    can(user.permissions, "attendance.self.create")
  ) {
    redirect("/attendance/me");
  }

  return <PermissionDeniedState />;
}
