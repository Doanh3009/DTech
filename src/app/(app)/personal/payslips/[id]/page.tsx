import { BackLink } from "@/components/shared/BackLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { PayslipDetail } from "@/features/accounting/components/PayslipDetail";
import { payslipListQuery } from "@/features/accounting/payslipPresentation";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params, searchParams }: PageProps<"/personal/payslips/[id]">) {
  const [{ id }, query, user] = await Promise.all([params, searchParams, getRequestUser()]);
  if (!user || !can(user.permissions, "payslip.self.view")) return <PermissionDeniedState />;
  return (
    <div className="page-stack">
      <BackLink href={`/personal/payslips${payslipListQuery(query.month, query.receipt)}`} label="Trở lại phiếu lương" />
      <PageHeader title="Chi tiết phiếu lương" />
      <PayslipDetail id={id} selfOnly />
    </div>
  );
}
