import { PermissionDeniedState } from "@/components/shared/States";
import { PayrollConsole } from "@/features/accounting/components/PayrollConsole";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getRequestUser();
  if (!user || (!can(user.permissions, "payroll.view") && !can(user.permissions, "payroll.create"))) {
    return <PermissionDeniedState />;
  }

  const query = await searchParams;
  const initialStatus = typeof query.status === "string" ? query.status : "pending";
  return <PayrollConsole canPublish={can(user.permissions, "payslip.publish")} initialStatus={initialStatus} key={initialStatus} />;
}
