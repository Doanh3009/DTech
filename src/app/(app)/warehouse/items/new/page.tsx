import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";
import { PermissionDeniedState } from "@/components/shared/States";
import { InventoryItemEditor } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page() {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "warehouse.item.manage")) return <PermissionDeniedState />;
  return <div className="page-stack"><BackLink href="/warehouse/items" /><PageHeader title="Thêm hàng hóa" /><InventoryItemEditor /></div>;
}
