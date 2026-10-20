import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

const firstRoute: Array<[Permission, string]> = [
  ["branding.view", "/system-admin/branding"],
  ["appearance.view", "/system-admin/appearance"],
  ["navigation.manage", "/system-admin/navigation"],
  ["module.manage", "/system-admin/modules"],
  ["organization_settings.view", "/system-admin/organization"],
  ["localization.manage", "/system-admin/localization"],
  ["config_history.view", "/system-admin/config-history"],
  ["audit.view", "/system-admin/audit"]
];

export default async function SystemAdminPage() {
  const user = await getRequestUser();
  const route = user ? firstRoute.find(([permission]) => can(user.permissions, permission))?.[1] : undefined;
  redirect(route ?? "/system-admin/security");
}
