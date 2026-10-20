import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PermissionDeniedState } from "@/components/shared/States";
import { hasAreaAccess } from "@/config/routeAccess";
import { DashboardAnalyticsFallback, DashboardShell, DashboardView } from "@/features/dashboard/components/DashboardView";
import { getDashboardReadModel } from "@/features/dashboard/services/dashboardService";
import { isAccountEnabled } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export async function DashboardPage() {
  const user = await getRequestUser();
  if (!user || !isAccountEnabled(user)) redirect("/login");
  if (!hasAreaAccess(user.permissions, "dashboard")) return <PermissionDeniedState />;

  return <DashboardShell>
    <Suspense fallback={<DashboardAnalyticsFallback />}>
      <DashboardAnalytics user={user} />
    </Suspense>
  </DashboardShell>;
}

async function DashboardAnalytics({ user }: { user: AuthenticatedUser }) {
  const model = await getDashboardReadModel(user);
  return <DashboardView initialModel={model} />;
}
