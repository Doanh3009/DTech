import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
import { DesignDnaPage } from "@/features/system-admin/pages/DesignDnaPage";

export default async function Page() {
  await authorizeSystemAdminPage("appearance.view");
  return <DesignDnaPage />;
}
