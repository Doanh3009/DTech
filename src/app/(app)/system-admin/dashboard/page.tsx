import { DashboardSettingsPage } from "@/features/system-admin/pages/DashboardSettingsPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";

export default async function Page() {
  await authorizeSystemAdminPage("navigation.manage");
  return <DashboardSettingsPage />;
}
