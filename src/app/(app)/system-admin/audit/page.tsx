import { AuditPage } from "@/features/system-admin/pages/AuditPage";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
export default async function Page() { await authorizeSystemAdminPage("audit.view"); return <AuditPage />; }
