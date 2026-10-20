import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { InventoryItemDetail } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getRequestUser()]);
  if (!user || !can(user.permissions, "warehouse.item.view")) return <PermissionDeniedState />;
  return (
    <div className="page-stack">
      <PageHeader title="Chi tiết hàng hóa" />
      <InventoryItemDetail
        canManage={Boolean(user && can(user.permissions, "warehouse.item.manage"))}
        canViewLedger={Boolean(user && can(user.permissions, "warehouse.ledger.view"))}
        id={id}
      />
    </div>
  );
}
