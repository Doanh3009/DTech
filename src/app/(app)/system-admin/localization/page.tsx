import { LocalizationPage } from "@/features/system-admin/pages/LocalizationPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("localization.manage"); return <LocalizationPage />; }
