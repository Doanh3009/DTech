import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";
import { PayslipTemplatePage } from "@/features/system-admin/pages/PayslipTemplatePage";

export default async function Page() {
  await authorizeSystemAdminPage("module.manage");
  return <PayslipTemplatePage />;
}
