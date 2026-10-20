import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { OrganizationCatalog } from "@/features/employees/components/OrganizationCatalog";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page(){const user=await getRequestUser();if(!user||(!can(user.permissions,"employee.view")&&!can(user.permissions,"position.manage")))return <PermissionDeniedState/>;return <div className="page-stack"><PageHeader title="Chức vụ"/><OrganizationCatalog canManage={can(user.permissions,"position.manage")} kind="positions"/></div>;}
