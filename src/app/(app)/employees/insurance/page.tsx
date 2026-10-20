import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { InsuranceConsole } from "@/features/insurance/InsuranceConsole";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page(){const user=await getRequestUser();if(!user||!can(user.permissions,"insurance.view"))return <PermissionDeniedState/>;return <div className="page-stack"><PageHeader title="Bảo hiểm xã hội"/><InsuranceConsole canEdit={can(user.permissions,"insurance.edit")} canUpload={can(user.permissions,"insurance.document.upload")}/></div>;}
