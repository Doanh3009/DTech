import { PageHeader } from "@/components/shared/PageHeader";
import { BackLink } from "@/components/shared/BackLink";
import { PermissionDeniedState } from "@/components/shared/States";
import { InventoryItemEditor, ItemWarehouseSettings } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "warehouse.item.manage")) return <PermissionDeniedState />;
  const { id } = await params;
  return (
    <div className="page-stack">
      <BackLink href={`/warehouse/items/${id}`} />
      <PageHeader title="Chỉnh sửa hàng hóa" />
      <InventoryItemEditor id={id} />
      <ItemWarehouseSettings itemId={id} />
    </div>
  );
}
