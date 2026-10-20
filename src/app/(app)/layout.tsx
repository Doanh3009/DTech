import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/shared/States";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { getTestControlsEnvironment } from "@/features/testing/server";

async function AuthenticatedAppShell({ children }: Readonly<{ children: ReactNode }>) {
  const user = await getRequestUser();
  if (!user) redirect("/login");
  const testEnvironment = await getTestControlsEnvironment(user.username);
  return <AppShell user={user} testEnvironment={testEnvironment}>{children}</AppShell>;
}

export default function InternalAppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <Suspense fallback={<LoadingState title="Đang mở hệ thống" />}><AuthenticatedAppShell>{children}</AuthenticatedAppShell></Suspense>;
}
