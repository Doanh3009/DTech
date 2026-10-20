import { PageHeader } from "@/components/shared/PageHeader"; import { WarehouseEditor } from "@/features/warehouse";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
export default async function Page({params}:{params:Promise<{id:string}>}){const user=await getRequestUser();return <div className="page-stack"><PageHeader title="Chi tiết kho"/><WarehouseEditor canViewProjects={Boolean(user&&can(user.permissions,"project.view"))} canEdit={Boolean(user&&can(user.permissions,"warehouse.master.manage"))} canViewLedger={Boolean(user&&can(user.permissions,"warehouse.ledger.view"))} id={(await params).id}/></div>;}
