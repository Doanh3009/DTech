import { HistoryPage } from "@/features/system-admin/pages/HistoryPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("config_history.view"); return <HistoryPage />; }
