import { redirect } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { PayslipDetail } from "@/features/accounting/components/PayslipDetail";
import { payslipListQuery } from "@/features/accounting/payslipPresentation";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params, searchParams }: PageProps<"/accounting/payslips/[id]">) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getRequestUser()]);
  if (!user) return <PermissionDeniedState />;
  const selfOnly = query.scope === "self";
  const canManagePayroll = can(user.permissions, "payroll.view");
  const canViewOwnPayslip = can(user.permissions, "payslip.self.view");
  if (!canManagePayroll && canViewOwnPayslip) redirect(`/personal/payslips/${id}`);
  if ((!canManagePayroll && !canViewOwnPayslip) || (selfOnly && !canViewOwnPayslip)) return <PermissionDeniedState />;
  return (
    <div className="page-stack">
      <BackLink href={`/accounting/payslips${payslipListQuery(query.month, query.receipt, selfOnly)}`} label="Trở lại phiếu lương" />
      <PageHeader title="Chi tiết phiếu lương" />
      <PayslipDetail id={id} selfOnly={selfOnly} />
    </div>
  );
}
