import { BackLink } from "@/components/shared/BackLink";
import { PermissionDeniedState } from "@/components/shared/States";
import { PayrollDetailConsole } from "@/features/accounting/components/PayrollDetailConsole";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({params}:{params:Promise<{id:string}>}) {
  const [{id},user]=await Promise.all([params,getRequestUser()]);
  if(!user||(!can(user.permissions,"payroll.view")&&!can(user.permissions,"payroll.create"))) return <PermissionDeniedState/>;
  const permissions={calculate:can(user.permissions,"payroll.create"),edit:can(user.permissions,"payroll.edit"),lock:can(user.permissions,"payroll.lock"),publish:can(user.permissions,"payslip.publish"),export:can(user.permissions,"payroll.export")};
  return <div className="page-stack"><BackLink href="/accounting/payroll"/><PayrollDetailConsole id={id} permissions={permissions}/></div>;
}
