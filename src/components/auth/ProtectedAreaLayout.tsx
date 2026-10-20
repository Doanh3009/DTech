import "server-only";

import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PermissionDeniedState } from "@/components/shared/States";
import { hasAreaAccess, type ProtectedArea } from "@/config/routeAccess";
import { isAccountEnabled } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export async function ProtectedAreaLayout({ area, children }: { area: ProtectedArea; children: ReactNode }) {
  const user = await getRequestUser();
  if (!user || !isAccountEnabled(user)) redirect("/login");
  if (!hasAreaAccess(user.permissions, area)) return <PermissionDeniedState />;
  return children;
}
