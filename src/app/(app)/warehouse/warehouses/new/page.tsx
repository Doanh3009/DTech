import { PageHeader } from "@/components/shared/PageHeader"; import { WarehouseEditor } from "@/features/warehouse";
import { PermissionDeniedState } from "@/components/shared/States";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";
export default async function Page(){const user=await getRequestUser();if(!user||!can(user.permissions,"warehouse.master.manage"))return <PermissionDeniedState/>;return <div className="page-stack"><PageHeader title="Thêm kho"/><WarehouseEditor/></div>;}
