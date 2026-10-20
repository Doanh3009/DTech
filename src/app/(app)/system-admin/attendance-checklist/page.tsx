import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
import { WorkerChecklistPage } from "@/features/system-admin/pages/WorkerChecklistPage";

export default async function Page() {
  await authorizeSystemAdminPage("system_admin.access");
  return <WorkerChecklistPage />;
}
