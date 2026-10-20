import { redirect } from "next/navigation";

import { resolveLandingPage } from "@/features/dashboard/registry";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { readSettingsGroup } from "@/services/system-settings/systemSettingsService";

export default async function HomePage() {
  const user = await getRequestUser();
  if (!user) redirect("/login");
  const settings = await readSettingsGroup("dashboard");
  redirect(resolveLandingPage(user, settings));
}
