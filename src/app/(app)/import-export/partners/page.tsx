import { PartnerView } from "@/features/import-export/components/ImportExportViews";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
import { requireAuthenticatedUser } from "@/services/authorization/requirePermission";

export default async function Page() {
  const user = requireAuthenticatedUser(await getRequestUser());
  return <div className="page-stack"><PartnerView canManage={can(user.permissions, "partner.manage")} /></div>;
}
