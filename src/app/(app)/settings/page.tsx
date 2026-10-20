import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { SettingsIndex, type SettingsCatalogItem } from "@/features/shared-platforms/components/SettingsIndex";
import { listSettingsCatalog } from "@/features/shared-platforms/services/configurationRepository";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "settings.view")) return <PermissionDeniedState />;
  const catalog = await listSettingsCatalog(user);
  const items: SettingsCatalogItem[] = catalog.map(({ key, group_key, label, route }) => ({ key, group_key, label, route }));
  return <div className="page-stack"><PageHeader title="Cấu hình nghiệp vụ" /><SettingsIndex items={items} /></div>;
}
