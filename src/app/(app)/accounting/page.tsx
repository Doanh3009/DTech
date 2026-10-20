import { redirect } from "next/navigation";

import { visibleApplications } from "@/config/moduleRegistry";
import { PermissionDeniedState } from "@/components/shared/States";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  if (!user) return <PermissionDeniedState />;
  const accounting = visibleApplications(user).find((application) => application.id === "accounting");
  if (!accounting) return <PermissionDeniedState />;
  redirect(accounting.defaultRoute);
}
