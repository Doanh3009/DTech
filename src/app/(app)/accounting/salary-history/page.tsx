import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { SalaryHistoryConsole } from "@/features/accounting/components/SalaryConsole";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page(){const user=await getRequestUser();if(!user||!can(user.permissions,"salary.history.view"))return <PermissionDeniedState/>;return <div className="page-stack"><PageHeader title="Nhật ký lương"/><SalaryHistoryConsole/></div>;}
