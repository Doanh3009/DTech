import { ModulesPage } from "@/features/system-admin/pages/ModulesPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("module.manage"); return <ModulesPage />; }
