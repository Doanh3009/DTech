import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
import { SetupPage } from "@/features/system-admin/pages/SetupPage";

export default async function Page() {
  await authorizeSystemAdminPage("branding.manage");
  await authorizeSystemAdminPage("organization_settings.manage");
  await authorizeSystemAdminPage("localization.manage");
  await authorizeSystemAdminPage("module.manage");
  return <SetupPage />;
}
