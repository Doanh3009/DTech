import { BrandingPage } from "@/features/system-admin/pages/BrandingPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("branding.view"); return <BrandingPage />; }
