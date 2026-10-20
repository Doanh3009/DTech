import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { PayslipConsole } from "@/features/accounting/components/PayslipConsole";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ searchParams }: PageProps<"/accounting/payslips">) {
  const params = await searchParams;
  const selfOnly = params.scope === "self";
  const user = await getRequestUser();
  if (!user) {
    return <PermissionDeniedState />;
  }
  const canManagePayroll = can(user.permissions, "payroll.view");
  const canViewOwnPayslip = can(user.permissions, "payslip.self.view");
  if (!canManagePayroll && canViewOwnPayslip) redirect("/personal/payslips");
  if (selfOnly ? !canViewOwnPayslip : !canManagePayroll && !canViewOwnPayslip) return <PermissionDeniedState />;
  return (
    <div className="page-stack">
      <PageHeader title="Phiếu lương" />
      <PayslipConsole key={`${params.month ?? "default"}:${params.receipt ?? "all"}:${selfOnly}`} canRevoke={!selfOnly && can(user.permissions, "payslip.revoke")} selfOnly={selfOnly} initialMonth={typeof params.month === "string" ? params.month : undefined} initialReceipt={typeof params.receipt === "string" ? params.receipt : undefined} />
    </div>
  );
}
