import { OrganizationPage } from "@/features/system-admin/pages/OrganizationPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("organization_settings.view"); return <OrganizationPage />; }
