import { NavigationPage } from "@/features/system-admin/pages/NavigationPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("navigation.manage"); return <NavigationPage />; }
