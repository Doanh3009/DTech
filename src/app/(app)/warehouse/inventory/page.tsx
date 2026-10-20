import { PageHeader } from "@/components/shared/PageHeader";
import { InventoryView } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
export default async function Page(){const user=await getRequestUser();return <div className="page-stack"><PageHeader title="Tồn kho"/><InventoryView canCreateReceipt={Boolean(user&&can(user.permissions,"warehouse.receipt.create"))} canViewItems={Boolean(user&&can(user.permissions,"warehouse.item.view"))} canViewLedger={Boolean(user&&can(user.permissions,"warehouse.ledger.view"))}/></div>;}
