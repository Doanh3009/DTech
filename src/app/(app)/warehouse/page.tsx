import { PageHeader } from "@/components/shared/PageHeader";
import { WarehouseOverview } from "@/features/warehouse/components/WarehouseOverview";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
export default async function Page() {
  const user = await getRequestUser();
  const actions: Array<"receipt" | "issue" | "transfer" | "count"> = [];
  if (user) {
    if (can(user.permissions, "warehouse.receipt.create")) actions.push("receipt");
    if (can(user.permissions, "warehouse.issue.create")) actions.push("issue");
    if (can(user.permissions, "warehouse.transfer.create")) actions.push("transfer");
    if (can(user.permissions, "warehouse.stock_count.create")) actions.push("count");
  }
  return <div className="page-stack"><PageHeader title="Kho vật tư"/><WarehouseOverview actions={actions}/></div>;
}
