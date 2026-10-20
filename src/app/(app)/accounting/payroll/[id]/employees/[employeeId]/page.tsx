import { notFound } from "next/navigation";
import { PermissionDeniedState } from "@/components/shared/States";
import { PayrollEmployeeDetail } from "@/features/accounting/components/PayrollEmployeeDetail";
import { getPayroll } from "@/features/accounting/service";
import { can } from "@/lib/auth/permissions";
import { getRequestUser } from "@/services/auth/getRequestUser";

export default async function Page({ params }: { params: Promise<{ id: string; employeeId: string }> }) {
  const { id, employeeId } = await params;
  const user = await getRequestUser();
  if (!user || (!can(user.permissions, "payroll.view") && !can(user.permissions, "payroll.create"))) return <PermissionDeniedState />;
  const payroll = await getPayroll(user, id);
  const line = payroll.lines.find((item) => item.employeeId === employeeId);
  if (!line) notFound();
  return <PayrollEmployeeDetail canEdit={can(user.permissions, "payroll.edit")} canPublish={can(user.permissions, "payslip.publish")} line={line} payrollId={id} payrollMonth={payroll.periodMonth} payrollStatus={payroll.status} rowVersion={payroll.rowVersion} timesheetPeriodId={payroll.timesheetPeriodId} />;
}
