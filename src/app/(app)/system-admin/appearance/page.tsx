import { AppearancePage } from "@/features/system-admin/pages/AppearancePage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("appearance.view"); return <AppearancePage />; }
