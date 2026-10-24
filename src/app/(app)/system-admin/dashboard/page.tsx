import { redirect } from "next/navigation";
import { authorizeSystemAdminPage } from "@/features/system-admin/authorizeSystemAdminPage";

export default async function Page() {
  await authorizeSystemAdminPage("navigation.manage");
  redirect("/system-admin/navigation");
}
