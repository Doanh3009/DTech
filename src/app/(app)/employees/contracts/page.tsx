import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { EmployeeContractList } from "@/features/employees/components/OrganizationCatalog";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page(){const user=await getRequestUser();if(!user||!can(user.permissions,"contract.view"))return <PermissionDeniedState/>;return <div className="page-stack"><PageHeader title="Hợp đồng lao động"/><EmployeeContractList canEdit={can(user.permissions,"contract.edit")} canUpload={can(user.permissions,"contract.file.upload")} canViewEmployee={can(user.permissions,"employee.view")}/></div>;}
