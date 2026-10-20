import { SecurityPage } from "@/features/system-admin/pages/SecurityPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("system_admin.access"); return <SecurityPage />; }
