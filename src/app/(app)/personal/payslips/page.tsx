import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionDeniedState } from "@/components/shared/States";
import { PayslipConsole } from "@/features/accounting/components/PayslipConsole";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ searchParams }: PageProps<"/personal/payslips">) {
  const params = await searchParams;
  const user = await getRequestUser();
  if (!user || !can(user.permissions, "payslip.self.view")) return <PermissionDeniedState />;
  return (
    <div className="page-stack">
      <PageHeader title="Phiếu lương của tôi" />
      <PayslipConsole key={`${params.month ?? "default"}:${params.receipt ?? "all"}`} canRevoke={false} personalRoute selfOnly initialMonth={typeof params.month === "string" ? params.month : undefined} initialReceipt={typeof params.receipt === "string" ? params.receipt : undefined} />
    </div>
  );
}
